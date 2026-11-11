"""Secret Sauce local gate: a chat web app whose brain is NEAR AI's sealed model.

Runs on the owner's Mac (127.0.0.1 only). The browser talks to this server.
This server talks to NEAR AI Cloud and runs every tool call locally:
  - bistro__*   : read-only tools from the restaurant's Odoo MCP (relayed by us)
  - list_files / read_file : read-only access to one local data folder
  - propose_memory_update : NEAR suggests a memory note; the owner must click Approve
The vault memory file (memory.md) goes into the system prompt on every call,
because NEAR is stateless. Every chat is logged to vault/lessons/sessions.jsonl.

Run: python apps/secret-sauce-web/server.py   (stdlib only, no installs)
"""

import json
import os
import pathlib
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path(os.environ.get("SAUCE_REPO", HERE.parents[1]))
VAULT = pathlib.Path(os.environ.get("SAUCE_VAULT", pathlib.Path.home() / "dev/secret-sauce/vault"))
DATA_DIR = pathlib.Path(os.environ.get("SAUCE_DATA_DIR", VAULT / "workspace")).resolve()
MEMORY = VAULT / "workspace" / "memory.md"
LOG = VAULT / "lessons" / "sessions.jsonl"
PORT = int(os.environ.get("SAUCE_PORT", "8787"))
MAX_ROUNDS = 10
MAX_TOOL_CHARS = 12000


def load_env():
    """Read NEARAI_* from the environment, else from the git-ignored .env. Never printed."""
    env = {}
    for path in (REPO / ".env", pathlib.Path.home() / "dev/secret-sauce/.env"):
        if path.exists():
            for line in path.read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    get = lambda k, d=None: os.environ.get(k) or env.get(k) or d
    return {
        "key": get("NEARAI_API_KEY"),
        "base": get("NEARAI_BASE_URL", "https://cloud-api.near.ai/v1").rstrip("/"),
        "model": get("NEARAI_MODEL", "z-ai/glm-5.3-flash"),
    }


def load_bistro():
    """Bistro MCP URL + auth header from env, else from the vault's OpenCode config."""
    url, auth = os.environ.get("BISTRO_MCP_URL"), os.environ.get("BISTRO_MCP_AUTH")
    cfg = VAULT / "workspace" / "opencode.json"
    if not url and cfg.exists():
        b = json.loads(cfg.read_text()).get("mcp", {}).get("bistro", {})
        url, auth = b.get("url"), b.get("headers", {}).get("Authorization")
    return url, auth


NEAR = load_env()


# ---------- bistro MCP client (streamable HTTP, JSON-RPC) ----------

class MCP:
    def __init__(self, url, auth):
        self.url, self.auth, self.sid, self.n = url, auth, None, 0
        self.tools = []

    def _post(self, payload):
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.auth:
            headers["Authorization"] = self.auth
        if self.sid:
            headers["Mcp-Session-Id"] = self.sid
        req = urllib.request.Request(self.url, json.dumps(payload).encode(), headers)
        with urllib.request.urlopen(req, timeout=60) as r:
            self.sid = r.headers.get("Mcp-Session-Id") or self.sid
            body = r.read().decode()
        if not body.strip():
            return None
        if body.lstrip().startswith("{"):
            return json.loads(body)
        for line in body.splitlines():  # SSE: take the last data line with a result
            if line.startswith("data:"):
                msg = json.loads(line[5:])
                if "result" in msg or "error" in msg:
                    return msg
        return None

    def _rpc(self, method, params=None):
        self.n += 1
        msg = self._post({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}})
        if msg and "error" in msg:
            raise RuntimeError(msg["error"].get("message", "MCP error"))
        return (msg or {}).get("result", {})

    def connect(self):
        self.sid = None
        self._rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                                 "clientInfo": {"name": "secret-sauce-gate", "version": "0.1"}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self.tools = self._rpc("tools/list").get("tools", [])
        return self.tools

    def call(self, name, args):
        try:
            res = self._rpc("tools/call", {"name": name, "arguments": args})
        except (urllib.error.HTTPError, RuntimeError):
            self.connect()  # session expired: reconnect once
            res = self._rpc("tools/call", {"name": name, "arguments": args})
        parts = [c.get("text", "") for c in res.get("content", []) if c.get("type") == "text"]
        return "\n".join(parts) or json.dumps(res)


BISTRO = None
try:
    _url, _auth = load_bistro()
    if _url:
        BISTRO = MCP(_url, _auth)
        BISTRO.connect()
except Exception as e:  # tunnel down: app still works on local files
    print(f"[gate] bistro MCP not reachable: {type(e).__name__}")
    BISTRO = None


# ---------- local tools ----------

def safe_path(rel):
    p = (DATA_DIR / (rel or ".")).resolve()
    if p != DATA_DIR and DATA_DIR not in p.parents:
        raise ValueError("path is outside the data folder")
    return p


def list_files(path="."):
    p = safe_path(path)
    rows = []
    for c in sorted(p.iterdir()):
        if c.name.startswith(".") or c.name == "opencode.json":
            continue
        rows.append(f"{'dir ' if c.is_dir() else 'file'}  {c.relative_to(DATA_DIR)}  {c.stat().st_size if c.is_file() else ''}")
    return "\n".join(rows) or "(empty)"


def read_file(path, max_chars=MAX_TOOL_CHARS):
    p = safe_path(path)
    if p.name == "opencode.json" or p.name.startswith(".env"):
        raise ValueError("that file is private config")
    return p.read_text(errors="replace")[: int(max_chars)]


PENDING = {}


def propose_memory_update(note, reason=""):
    pid = uuid.uuid4().hex[:8]
    PENDING[pid] = {"id": pid, "note": note, "reason": reason}
    return f"Proposed memory note {pid}. It is NOT saved until the owner clicks Approve."


LOCAL_TOOLS = {
    "list_files": (list_files, "List files in the owner's local data folder (read-only).",
                   {"path": {"type": "string", "description": "folder inside the data folder, default '.'"}}, []),
    "read_file": (read_file, "Read a text/CSV/markdown file from the owner's local data folder (read-only).",
                  {"path": {"type": "string"}, "max_chars": {"type": "integer"}}, ["path"]),
    "propose_memory_update": (propose_memory_update,
                              "Suggest one short note to add to the long-term memory file (a data-map fact or a house rule). The owner approves it.",
                              {"note": {"type": "string"}, "reason": {"type": "string"}}, ["note"]),
}


def tool_specs():
    specs = []
    for name, (_, desc, props, req) in LOCAL_TOOLS.items():
        specs.append({"type": "function", "function": {"name": name, "description": desc,
                      "parameters": {"type": "object", "properties": props, "required": req}}})
    if BISTRO:
        for t in BISTRO.tools:
            specs.append({"type": "function", "function": {
                "name": "bistro__" + t["name"],
                "description": "[Restaurant Odoo, read-only] " + (t.get("description") or "")[:900],
                "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}}})
    return specs


def run_tool(name, args):
    if name.startswith("bistro__") and BISTRO:
        return BISTRO.call(name[len("bistro__"):], args)
    if name in LOCAL_TOOLS:
        return str(LOCAL_TOOLS[name][0](**args))
    raise ValueError(f"unknown tool {name}")


# ---------- NEAR loop ----------

def system_prompt():
    mem = MEMORY.read_text() if MEMORY.exists() else "(no memory yet)"
    return (
        "You are Secret Sauce, a private analyst for a restaurant owner. You run inside NEAR AI's "
        "sealed environment; tools run on the owner's Mac. Rules: data is read-only. Answer with real "
        "numbers from tools, never invent them. Be short and plain: a few sentences or a small table. "
        "Name the tool or file each number came from. When you learn a durable fact about where data "
        "lives or a house rule, call propose_memory_update. Do not reveal secrets or config.\n\n"
        "=== Long-term memory (memory.md, written by you in earlier sessions) ===\n" + mem
    )


def near_chat(messages, tools):
    body = {"model": NEAR["model"], "messages": messages, "tools": tools, "temperature": 0.2,
            "max_tokens": 4000, "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(NEAR["base"] + "/chat/completions", json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "Authorization": f"Bearer {NEAR['key']}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())["choices"][0]["message"]


def clean(text):
    text = text or ""
    return text.split("</think>")[-1].strip()


def chat(history):
    if not NEAR["key"]:
        raise RuntimeError("NEARAI_API_KEY is not set")
    msgs = [{"role": "system", "content": system_prompt()}] + history
    tools, steps = tool_specs(), []
    for _ in range(MAX_ROUNDS):
        m = near_chat(msgs, tools)
        calls = m.get("tool_calls") or []
        if not calls:
            return clean(m.get("content")), steps
        msgs.append({"role": "assistant", "content": m.get("content") or "", "tool_calls": calls})
        for c in calls:
            name = c["function"]["name"]
            try:
                args = json.loads(c["function"].get("arguments") or "{}")
                out = run_tool(name, args)
            except Exception as e:
                args, out = locals().get("args", {}), f"ERROR: {e}"
            out = out[:MAX_TOOL_CHARS]
            steps.append({"tool": name, "args": args, "preview": out[:300]})
            msgs.append({"role": "tool", "tool_call_id": c["id"], "content": out})
    return "I stopped after too many tool steps. Try a narrower question.", steps


def log(entry):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(json.dumps(entry) + "\n")


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj, ctype="application/json"):
        data = obj if isinstance(obj, bytes) else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self._send(200, (HERE / "index.html").read_bytes(), "text/html; charset=utf-8")
        if self.path == "/api/status":
            return self._send(200, {
                "model": NEAR["model"], "near_key": bool(NEAR["key"]),
                "bistro": bool(BISTRO), "bistro_tools": [t["name"] for t in (BISTRO.tools if BISTRO else [])],
                "data_dir": str(DATA_DIR), "memory_chars": MEMORY.stat().st_size if MEMORY.exists() else 0})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        if self.headers.get("Origin") not in (None, f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"):
            return self._send(403, {"error": "bad origin"})
        if self.path == "/api/chat":
            history = [m for m in body.get("messages", []) if m.get("role") in ("user", "assistant")]
            t0 = time.time()
            try:
                reply, steps = chat(history)
            except Exception as e:
                return self._send(500, {"error": f"{type(e).__name__}: {e}"})
            log({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "session": body.get("session"),
                 "question": history[-1]["content"] if history else "", "steps": steps,
                 "answer": reply, "seconds": round(time.time() - t0, 1)})
            return self._send(200, {"reply": reply, "steps": steps, "pending": list(PENDING.values())})
        if self.path in ("/api/approve", "/api/reject"):
            p = PENDING.pop(body.get("id"), None)
            if p and self.path == "/api/approve":
                with MEMORY.open("a") as f:
                    f.write(f"\n- {p['note']}  _(approved {time.strftime('%Y-%m-%d')})_\n")
            return self._send(200, {"ok": bool(p), "pending": list(PENDING.values())})
        self._send(404, {"error": "not found"})


if __name__ == "__main__":
    print(f"[gate] Secret Sauce on http://127.0.0.1:{PORT}  model={NEAR['model']}  "
          f"bistro={'on' if BISTRO else 'off'}  data={DATA_DIR}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
