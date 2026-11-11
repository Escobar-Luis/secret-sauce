"""Secret Sauce gate server.

A small local server between the chat page and NEAR AI Cloud.
- The browser never sees the NEAR key. Only this process reads .env.
- NEAR decides which tools to call. This server runs them and sends results back.
- Tools: Bondan's Bistro MCP (read-only), local files in one folder (read-only),
  and a memory proposal tool that needs the owner's approval.

Run:  ~/dev/secret-sauce/.venv/bin/python apps/secret-sauce-web/server.py
"""

from __future__ import annotations

import asyncio
import contextlib
import datetime as dt
import json
import os
import re
import secrets
import time
import uuid
from pathlib import Path
from typing import Any

import anyio
import httpx2
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, StreamingResponse
from starlette.routing import Route

import lab
from mcp.client import Client
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("SAUCE_ROOT", Path.home() / "dev" / "secret-sauce"))


def load_env(path: Path) -> None:
    """Read KEY=VALUE lines into os.environ (existing env wins). Never print values."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env(Path(os.environ.get("SAUCE_ENV_FILE", ROOT / ".env")))

NEAR_BASE = os.environ.get("NEARAI_BASE_URL") or "https://cloud-api.near.ai/v1"
NEAR_MODEL = os.environ.get("NEARAI_MODEL") or "z-ai/glm-5.3-flash"
NEAR_KEY = os.environ.get("NEARAI_API_KEY", "")
BISTRO_URL = os.environ.get("BISTRO_MCP_URL", "")
BISTRO_TOKEN = os.environ.get("BISTRO_MCP_TOKEN", "")
VAULT = Path(os.environ.get("SAUCE_VAULT_DIR", ROOT / "vault"))
DATA_DIR = Path(os.environ.get("SAUCE_DATA_DIR", VAULT / "owner-files")).resolve()
MEMORY_FILE = VAULT / "workspace" / "memory.md"
PROPOSALS_FILE = VAULT / "memory-proposals.md"
PLAYBOOK_FILE = VAULT / "playbook.md"
SESSIONS_FILE = VAULT / "lessons" / "sessions.jsonl"
PORT = int(os.environ.get("SAUCE_PORT") or os.environ.get("PORT") or "8790")
MAX_ROUNDS = 8
MAX_TOOL_CHARS = 60_000

# session_id -> {"messages": [...], "turns": [...]}
SESSIONS: dict[str, dict[str, Any]] = {}
# proposal_id -> {"text": str, "status": "pending" | "approved", "kind": "memory" | "rule"}
PROPOSALS: dict[str, dict[str, str]] = {}

# ---------------------------------------------------------------- local tools

LOCAL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and folders in the owner's private data folder (read-only). Use '.' for the top.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Folder path relative to the data folder"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a text or CSV file from the owner's private data folder (read-only).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to the data folder"},
                    "max_bytes": {"type": "integer", "description": "Max bytes to read (default 20000)"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search all text files in the owner's private data folder for a word or phrase. Returns matching lines.",
            "parameters": {
                "type": "object",
                "properties": {"term": {"type": "string"}},
                "required": ["term"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_memory_update",
            "description": (
                "Propose a short, durable fact or lesson to add to the owner's long-term memory "
                "(for example a new data quirk or a confirmed finding). The owner must approve it. "
                "Use sparingly, only for things worth remembering next time."
            ),
            "parameters": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "The memory to add, in markdown"}},
                "required": ["text"],
            },
        },
    },
]
LOCAL_TOOLS += [t for t in lab.LAB_TOOLS if t["function"]["name"] == "propose_playbook_rule"]
LOCAL_NAMES = {t["function"]["name"] for t in LOCAL_TOOLS}


BLOCKED_NAMES = {"opencode.json"}


def is_blocked(p: Path) -> bool:
    """Secrets and agent config never go to NEAR, even inside the data folder."""
    return p.name in BLOCKED_NAMES or p.name == ".env" or p.name.startswith(".env.")


def safe_path(rel: str | None) -> Path:
    """Resolve a path inside DATA_DIR. Raise if it escapes the folder or is a blocked file."""
    p = (DATA_DIR / (rel or ".")).resolve()
    if p != DATA_DIR and not p.is_relative_to(DATA_DIR):
        raise PermissionError("Path is outside the owner's data folder.")
    if is_blocked(p):
        raise PermissionError("That file is blocked.")
    return p


def run_local_tool(name: str, args: dict[str, Any]) -> tuple[str, int | None, dict | None]:
    """Return (result_text, row_count, proposal_or_None)."""
    if name == "list_files":
        p = safe_path(args.get("path"))
        if not p.is_dir():
            return "Not a folder.", 0, None
        items = sorted(
            (f"{c.name}/" if c.is_dir() else f"{c.name} ({c.stat().st_size} bytes)") for c in p.iterdir() if not c.name.startswith(".") and not is_blocked(c)
        )
        return "\n".join(items) or "(empty)", len(items), None
    if name == "read_file":
        p = safe_path(args.get("path"))
        if not p.is_file():
            return "File not found.", 0, None
        max_bytes = min(int(args.get("max_bytes") or 20_000), 200_000)
        with p.open("rb") as fh:
            text = fh.read(max_bytes).decode("utf-8", errors="replace")
        return text, text.count("\n"), None
    if name == "search_files":
        term = str(args.get("term", "")).lower()
        if not term:
            return "Empty search term.", 0, None
        hits: list[str] = []
        for f in DATA_DIR.rglob("*"):
            if len(hits) >= 50:
                break
            if f.is_symlink() or is_blocked(f) or not f.resolve().is_relative_to(DATA_DIR):
                continue
            if not f.is_file() or f.stat().st_size > 2_000_000 or any(part.startswith(".") for part in f.relative_to(DATA_DIR).parts):
                continue
            try:
                for i, line in enumerate(f.read_text(errors="ignore").splitlines(), 1):
                    if term in line.lower():
                        hits.append(f"{f.relative_to(DATA_DIR)}:{i}: {line[:200]}")
                        if len(hits) >= 50:
                            break
            except OSError:
                continue
        return "\n".join(hits) or "No matches.", len(hits), None
    if name == "propose_memory_update":
        text = str(args.get("text", "")).strip()
        if not text:
            return "Empty proposal.", 0, None
        pid = uuid.uuid4().hex[:8]
        PROPOSALS[pid] = {"text": text, "status": "pending", "kind": "memory"}
        PROPOSALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with PROPOSALS_FILE.open("a") as fh:
            fh.write(f"\n## Proposal {pid} ({dt.datetime.now().isoformat(timespec='seconds')}) - pending\n\n{text}\n")
        return "Proposal saved. The owner will see an Approve button.", None, {"id": pid, "text": text, "kind": "memory"}
    if name == "propose_playbook_rule":
        rule = str(args.get("rule", "")).strip()
        reason = str(args.get("reason", "")).strip()
        if not rule:
            return "Empty rule.", 0, None
        pid = uuid.uuid4().hex[:8]
        text = f"{rule} (why: {reason})" if reason else rule
        PROPOSALS[pid] = {"text": text, "status": "pending", "kind": "rule"}
        PROPOSALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with PROPOSALS_FILE.open("a") as fh:
            fh.write(f"\n## Rule proposal {pid} ({dt.datetime.now().isoformat(timespec='seconds')}) - pending\n\n{text}\n")
        lab.add_event("rule_proposed", id=pid, text=text)
        return "Rule proposal saved. The owner will see an Approve button.", None, {"id": pid, "text": text, "kind": "rule"}
    return f"Unknown tool {name}", 0, None


# ---------------------------------------------------------------- helpers


def strip_think(content: str | None) -> str:
    """GLM can leak its reasoning. Drop everything up to and including </think>."""
    if not content:
        return ""
    if "</think>" in content:
        content = content.rsplit("</think>", 1)[1]
    return re.sub(r"<think>.*", "", content, flags=re.S).strip()


def count_rows(text: str) -> int | None:
    """Guess how many records a tool result holds, so the UI shows counts, not data."""
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return None
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        for key in ("count", "total_count", "rows"):
            if isinstance(data.get(key), int):
                return data[key]
        lists = [v for v in data.values() if isinstance(v, list)]
        if lists:
            return max(len(v) for v in lists)
        return 1
    return None


def preview_rows(text: str, limit: int = 15) -> dict:
    """Turn a tool result into a small table for the data panel (first `limit` rows)."""
    def cell(v):
        v = v if isinstance(v, str) else json.dumps(v)
        return v if len(v) <= 60 else v[:57] + "..."
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        lines = [l for l in (text or "").splitlines() if l.strip()]
        return {"columns": ["text"], "rows": [[cell(l)] for l in lines[:limit]], "total": len(lines)}
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        if lists:
            data = max(lists, key=len)
        else:
            return {"columns": ["field", "value"], "rows": [[cell(k), cell(v)] for k, v in list(data.items())[:limit]], "total": len(data)}
    if not isinstance(data, list):
        return {"columns": ["value"], "rows": [[cell(data)]], "total": 1}
    cols: list[str] = []
    for r in data[:limit]:
        if isinstance(r, dict):
            cols += [k for k in r if k not in cols]
    if not cols:
        return {"columns": ["value"], "rows": [[cell(r)] for r in data[:limit]], "total": len(data)}
    cols = cols[:8]
    rows = [[cell(r.get(c, "")) if isinstance(r, dict) else cell(r) for c in cols] for r in data[:limit]]
    return {"columns": cols, "rows": rows, "total": len(data)}


def system_prompt() -> str:
    memory = MEMORY_FILE.read_text() if MEMORY_FILE.exists() else "(no memory yet)"
    return (
        "You are Secret Sauce, a private analyst for a small restaurant owner (Bondan's Bistro). "
        "You run inside NEAR AI Cloud's confidential environment. The owner's data stays private.\n\n"
        "You can call tools: the weight lab (lab_*) that teaches a small local student model on the owner's Mac, propose_playbook_rule, the Bistro's read-only Odoo tools (P&L, orders, POS sessions, cash differences, "
        "stock, bills, employees, attendance, maintenance, search_records), the owner's local files "
        "(list_files, read_file, search_files), and propose_memory_update.\n"
        "Rules: look at real data with tools before you answer. Cite numbers, dates and names you found. "
        "Say plainly when evidence is weak. Keep answers short and clear for a busy owner. "
        "Never invent data. If you learn a durable new fact, call propose_memory_update once.\n"
        "The sim's 'today' is 2026-11-11.\n\n"
        "## Your memory (data map and playbook from earlier work)\n\n" + memory
    )


async def near_chat(http: httpx2.AsyncClient, messages: list[dict], tools: list[dict]) -> dict:
    resp = await http.post(
        f"{NEAR_BASE}/chat/completions",
        headers={"Authorization": f"Bearer {NEAR_KEY}"},
        json={
            "model": NEAR_MODEL,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False},
        },
    )
    if resp.status_code != 200:
        raise RuntimeError(f"NEAR returned {resp.status_code}: {resp.text[:300]}")
    return resp.json()["choices"][0]["message"]


def bistro_client() -> Client:
    http = create_mcp_http_client(headers={"Authorization": f"Bearer {BISTRO_TOKEN}"})
    return Client(streamable_http_client(BISTRO_URL, http_client=http))


def mcp_result_text(result: Any) -> str:
    parts = []
    for block in getattr(result, "content", []) or []:
        parts.append(getattr(block, "text", None) or str(block))
    text = "\n".join(parts)
    if not text and getattr(result, "structured_content", None) is not None:
        text = json.dumps(result.structured_content)
    return text


# ---------------------------------------------------------------- the loop


async def run_turn(session: dict, user_text: str, emit=None) -> dict:
    """Run one user turn. `emit(event)` gets live progress events for the UI."""

    async def send(event: dict) -> None:
        if emit:
            await emit(event)

    messages = session["messages"]
    messages[0] = {"role": "system", "content": system_prompt()}  # fresh memory every chat
    messages.append({"role": "user", "content": user_text})
    trace: list[dict] = []
    proposals: list[dict] = []
    answer = ""

    async with contextlib.AsyncExitStack() as stack:
        http = await stack.enter_async_context(httpx2.AsyncClient(timeout=240))
        bistro = None
        mcp_tools: list[dict] = []
        try:  # the Bistro tunnel can be down; keep chatting with local tools if so
            health = await http.get(BISTRO_URL.rsplit("/mcp", 1)[0] + "/health", timeout=8)
            if health.status_code != 200:
                raise RuntimeError(f"health {health.status_code}")
            with anyio.fail_after(15):
                bistro = await stack.enter_async_context(bistro_client())
                listed = await bistro.list_tools()
            mcp_tools = [
                {
                    "type": "function",
                    "function": {"name": t.name, "description": t.description or "", "parameters": t.input_schema or {"type": "object"}},
                }
                for t in listed.tools
            ]
        except Exception as exc:
            bistro = None
            print(f"[gate] Bistro MCP unavailable: {type(exc).__name__}", flush=True)
            await send({"type": "notice", "text": "The Bistro data server is offline right now. NEAR can only use local tools."})
            messages.append({"role": "system", "content": "Note: the Bistro data server is offline this turn. Its tools are unavailable; say so if the question needs them."})
        tools = mcp_tools + LOCAL_TOOLS + [t for t in lab.LAB_TOOLS if t["function"]["name"] in lab.LAB_NAMES]

        for rnd in range(MAX_ROUNDS):
            await send({"type": "thinking", "round": rnd + 1})
            t0 = time.time()
            msg = await near_chat(http, messages, tools)
            calls = msg.get("tool_calls") or []
            print(f"[gate] round {rnd + 1}: NEAR took {time.time() - t0:.1f}s, tool calls: {[c['function']['name'] for c in calls]}", flush=True)
            content = strip_think(msg.get("content"))
            if not calls:
                answer = content
                messages.append({"role": "assistant", "content": answer})
                break
            messages.append({"role": "assistant", "content": content or None, "tool_calls": calls})
            for call in calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"].get("arguments") or "{}")
                except ValueError:
                    args = {}
                source = "lab" if name in lab.LAB_NAMES else "local" if name in LOCAL_NAMES else "bistro"
                entry = {"tool": name, "args": args, "source": source}
                await send({"type": "tool_start", **entry})
                t_call = time.time()
                try:
                    if name in lab.LAB_NAMES:
                        text = await lab.run_lab_tool(name, args)
                        rows = None
                        if text.startswith("Lab error") or '"error"' in text[:40]:
                            entry["error"] = True
                    elif name in LOCAL_NAMES:
                        text, rows, proposal = run_local_tool(name, args)
                        if proposal:
                            proposals.append(proposal)
                    else:
                        if bistro is None:
                            raise RuntimeError("Bistro data server is offline")
                        result = await bistro.call_tool(name, args)
                        text = mcp_result_text(result)
                        rows = count_rows(text)
                        if getattr(result, "is_error", False):
                            entry["error"] = True
                    entry["rows"] = rows
                except Exception as exc:  # report the error back to NEAR, keep going
                    text = f"Tool error: {exc}"
                    entry["error"] = True
                entry["ms"] = int((time.time() - t_call) * 1000)
                trace.append(entry)
                # rows go to the owner's own browser only; they are not stored in the trace
                await send({"type": "tool_done", **entry, "preview": preview_rows(text)})
                if len(text) > MAX_TOOL_CHARS:
                    text = text[:MAX_TOOL_CHARS] + "\n...(truncated)"
                messages.append({"role": "tool", "tool_call_id": call.get("id", ""), "content": text})
        else:
            answer = "I ran out of tool rounds before finishing. Try a narrower question."
            messages.append({"role": "assistant", "content": answer})

    turn = {"user": user_text, "answer": answer, "trace": trace, "proposals": proposals}
    session["turns"].append(turn)
    return turn


def save_session(sid: str) -> bool:
    session = SESSIONS.pop(sid, None)
    if not session or not session["turns"]:
        return False
    SESSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "session_id": sid,
        "saved_at": dt.datetime.now().isoformat(timespec="seconds"),
        "model": NEAR_MODEL,
        "messages": session["messages"][1:],  # skip the big system prompt
        "turns": session["turns"],
    }
    with SESSIONS_FILE.open("a") as fh:
        fh.write(json.dumps(record) + "\n")
    return True


# ---------------------------------------------------------------- routes


async def index(_: Request):
    return FileResponse(HERE / "index.html")


async def chat(request: Request):
    """Stream newline-delimited JSON events: thinking, tool_start, tool_done, then done or error."""
    body = await request.json()
    text = lab.TEACH_PROMPT if body.get("teach") else str(body.get("message", "")).strip()
    if not text:
        return JSONResponse({"error": "Empty message"}, status_code=400)
    sid = str(body.get("session_id") or uuid.uuid4().hex)
    session = SESSIONS.setdefault(sid, {"messages": [{"role": "system", "content": ""}], "turns": []})
    queue: asyncio.Queue = asyncio.Queue()

    async def worker() -> None:
        before = len(session["messages"])
        try:
            turn = await run_turn(session, text, emit=queue.put)
            await queue.put({"type": "done", "session_id": sid, **turn})
        except Exception as exc:
            # roll back this half-finished turn so the history stays valid
            del session["messages"][before:]
            await queue.put({"type": "error", "session_id": sid, "error": str(exc)[:500]})
        await queue.put(None)

    async def stream():
        task = asyncio.create_task(worker())
        try:
            yield json.dumps({"type": "session", "session_id": sid}) + "\n"
            while (event := await queue.get()) is not None:
                yield json.dumps(event) + "\n"
        finally:
            await task

    return StreamingResponse(stream(), media_type="application/x-ndjson")


async def approve(request: Request):
    body = await request.json()
    pid = str(body.get("id", ""))
    prop = PROPOSALS.get(pid)
    if not prop:
        return JSONResponse({"error": "Unknown proposal"}, status_code=404)
    if prop["status"] != "approved":
        if prop.get("kind") == "rule":
            with PLAYBOOK_FILE.open("a") as fh:
                fh.write(f"\n- **New rule ({dt.date.today().isoformat()}, approved by owner):** {prop['text']}\n")
            with MEMORY_FILE.open("a") as fh:
                fh.write(f"\n\n## Playbook rule {dt.date.today().isoformat()} (approved by owner)\n\n{prop['text']}\n")
            lab.add_event("rule_approved", id=pid, text=prop["text"])
        else:
            with MEMORY_FILE.open("a") as fh:
                fh.write(f"\n\n## Learned {dt.date.today().isoformat()} (approved by owner)\n\n{prop['text']}\n")
        with PROPOSALS_FILE.open("a") as fh:
            fh.write(f"\n_Proposal {pid} approved {dt.datetime.now().isoformat(timespec='seconds')}_\n")
        prop["status"] = "approved"
    return JSONResponse({"ok": True})


async def end_session(request: Request):
    try:
        body = json.loads(await request.body() or b"{}")
    except ValueError:
        body = {}
    return JSONResponse({"saved": save_session(str(body.get("session_id", "")))})


async def attestation(_: Request):
    nonce = secrets.token_hex(32)
    url = f"{NEAR_BASE}/attestation/report?nonce={nonce}"
    try:
        async with httpx2.AsyncClient(timeout=20) as http:
            resp = await http.get(url)
        return JSONResponse({"ok": resp.status_code == 200, "status": resp.status_code, "url": url})
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)[:200], "url": url})


async def lab_events(request: Request):
    try:
        after = int(request.query_params.get("after", "0"))
    except ValueError:
        after = 0
    return JSONResponse(lab.snapshot(after, PLAYBOOK_FILE, PROPOSALS))


async def health(_: Request):
    return JSONResponse(
        {
            "near_key": bool(NEAR_KEY),
            "bistro": bool(BISTRO_URL and BISTRO_TOKEN),
            "data_dir": DATA_DIR.name,
            "memory": MEMORY_FILE.exists(),
        }
    )


ALLOWED_ORIGINS = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}


class OriginGuard:
    """Refuse POSTs from any other site, so a web page can't drive the gate."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["method"] == "POST":
            headers = dict(scope.get("headers") or [])
            origin = headers.get(b"origin", b"").decode()
            if origin and origin not in ALLOWED_ORIGINS:
                await JSONResponse({"error": "Origin not allowed"}, status_code=403)(scope, receive, send)
                return
        await self.app(scope, receive, send)


app = Starlette(
    routes=[
        Route("/", index),
        Route("/api/chat", chat, methods=["POST"]),
        Route("/api/approve", approve, methods=["POST"]),
        Route("/api/end", end_session, methods=["POST"]),
        Route("/api/attestation", attestation),
        Route("/api/health", health),
        Route("/api/lab/events", lab_events),
    ]
)
app.add_middleware(OriginGuard)

if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
