"""Training lab bridge: lets NEAR teach the local student model (apps/weight-lab).

The student (Qwen3-1.7B via MLX) loads lazily on the first lab call.
Every lab call and rule event goes into EVENTS, which the Training pane polls.
Lessons, edits and backups stay in WEIGHT_LAB_DIR (git-ignored vault).
"""

from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
LAB_SRC = HERE.parent / "weight-lab"
DEFAULT_MODEL = os.environ.get("WEIGHT_LAB_MODEL", "mlx-community/Qwen3-1.7B-bf16")

EVENTS: list[dict] = []
STATE: dict[str, Any] = {"loaded": False, "layers": None, "compare": None}
_lock = asyncio.Lock()
_wl = None


def add_event(kind: str, **data: Any) -> dict:
    ev = {"seq": len(EVENTS) + 1, "ts": time.time(), "kind": kind, **data}
    EVENTS.append(ev)
    return ev


def _lab():
    """Import weight_lab on first use (it pulls in MLX)."""
    global _wl
    if _wl is None:
        os.environ.setdefault("WEIGHT_LAB_DIR", str(Path.home() / "dev/secret-sauce/vault/weight-lab"))
        if str(LAB_SRC) not in sys.path:
            sys.path.insert(0, str(LAB_SRC))
        _wl = importlib.import_module("weight_lab")
    return _wl


LAB_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "lab_add_lesson",
            "description": "Save one lesson for the local student model: owner's question, the data context (short, key rows only), and your answer. exam=true keeps it held out for testing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "context": {"type": "string", "description": "The key data the answer is based on, under 3000 chars"},
                    "teacher_answer": {"type": "string", "description": "Short answer with the key numbers"},
                    "exam": {"type": "boolean"},
                },
                "required": ["question", "context", "teacher_answer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lab_ask_student",
            "description": "Ask the local student model a question with context. Returns its answer.",
            "parameters": {
                "type": "object",
                "properties": {"question": {"type": "string"}, "context": {"type": "string"}},
                "required": ["question", "context"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lab_run_exam",
            "description": "Student answers every held-out exam lesson. Returns per-question scores (0-1) vs your answers and the average.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lab_teach",
            "description": "One rank-one weight edit to a single layer's MLP, moving the student toward your answers on the training lessons. Use a middle layer (10-20) and strength 0.5-2.",
            "parameters": {
                "type": "object",
                "properties": {"layer": {"type": "integer"}, "strength": {"type": "number"}},
                "required": ["layer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lab_revert_last",
            "description": "Undo the most recent weight edit. Use when the exam score got worse.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lab_status",
            "description": "Student model id, layer count, lesson counts and active edits.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_playbook_rule",
            "description": "Propose a new house rule for the playbook (how to read this restaurant's data). The owner must approve it.",
            "parameters": {
                "type": "object",
                "properties": {"rule": {"type": "string"}, "reason": {"type": "string"}},
                "required": ["rule", "reason"],
            },
        },
    },
]
LAB_NAMES = {t["function"]["name"] for t in LAB_TOOLS} - {"propose_playbook_rule"}


def _sync_call(name: str, args: dict) -> tuple[str, dict]:
    """Run one lab tool (blocking, MLX). Returns (result text, summary for the pane)."""
    wl = _lab()
    if name == "lab_add_lesson":
        out = wl.add_lesson(str(args.get("question", "")), str(args.get("context", "")),
                            str(args.get("teacher_answer", "")), bool(args.get("exam", False)))
        r = json.loads(out)
        return out, {"lesson": r.get("id"), "exam": r.get("exam")}
    if name == "lab_ask_student":
        q, ctx = str(args.get("question", "")), str(args.get("context", ""))
        ans = wl.ask_student(q, ctx)
        STATE["compare"] = {"question": q, "student": ans, "teacher": None}
        return ans, {"answer_chars": len(ans)}
    if name == "lab_run_exam":
        out = wl.run_exam()
        r = json.loads(out)
        lessons = {l["id"]: l for l in wl._read_lessons()}
        if r.get("results"):
            last = r["results"][-1]
            lesson = lessons.get(last["id"], {})
            STATE["compare"] = {"question": lesson.get("question"), "student": last.get("student_answer"),
                                "teacher": lesson.get("teacher_answer"), "score": last.get("score")}
        return out, {"average": r.get("average"), "questions": len(r.get("results") or [])}
    if name == "lab_teach":
        out = wl.teach(int(args.get("layer", 14)), float(args.get("strength", 1.0)))
        r = json.loads(out)
        if "error" in r:
            return out, {"error": r["error"]}
        return out, {"edit": r["id"], "layer": r["layer"], "strength": r["strength"],
                     "delta": round(abs(r["strength"]) * r["v_norm"], 3)}
    if name == "lab_revert_last":
        out = wl.revert_last()
        return out, json.loads(out)
    if name == "lab_status":
        out = wl.status()
        r = json.loads(out)
        STATE["layers"] = r.get("layers")
        return out, {"layers": r.get("layers"), "active_edits": len(r.get("active_edits") or [])}
    return f"Unknown lab tool {name}", {"error": "unknown"}


async def run_lab_tool(name: str, args: dict) -> str:
    shown_args = {k: (v[:80] + "…" if isinstance(v, str) and len(v) > 80 else v) for k, v in args.items()}
    start = add_event("lab_start", tool=name, args=shown_args)
    async with _lock:  # MLX model is shared; one call at a time
        t0 = time.time()
        try:
            text, summary = await asyncio.to_thread(_sync_call, name, args)
            ok = "error" not in summary
        except Exception as exc:
            text, summary, ok = f"Lab error: {exc}", {"error": str(exc)[:200]}, False
        STATE["loaded"] = _wl is not None and "model" in getattr(_wl, "_state", {})
        if STATE["loaded"] and STATE["layers"] is None:
            STATE["layers"] = len(_wl._layers(_wl._state["model"]))
        add_event("lab_call", start=start["seq"], tool=name, args=shown_args, ms=int((time.time() - t0) * 1000), ok=ok, result=summary)
        return text


def edits() -> list[dict]:
    if _wl is None:
        p = Path(os.environ.get("WEIGHT_LAB_DIR", Path.home() / "dev/secret-sauce/vault/weight-lab")) / "edits.jsonl"
    else:
        p = _wl.EDITS
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()]


def snapshot(after: int, playbook_file: Path, proposals: dict) -> dict:
    all_edits = edits()
    rules = []
    if playbook_file.exists():
        for line in playbook_file.read_text().splitlines():
            s = line.strip()
            if s and (s[0].isdigit() or s.startswith("- ")):
                rules.append(s)
    pending = [{"id": k, **v} for k, v in proposals.items() if v.get("kind") == "rule" and v["status"] == "pending"]
    approved = [v["text"] for v in proposals.values() if v.get("kind") == "rule" and v["status"] == "approved"]
    return {
        "events": [e for e in EVENTS if e["seq"] > after],
        "model": {
            "name": DEFAULT_MODEL,
            "loaded": STATE["loaded"],
            "layers": STATE["layers"] or 28,
            "edited_layers": sorted({e["layer"] for e in all_edits if not e.get("reverted")}),
            "active_edits": sum(not e.get("reverted") for e in all_edits),
        },
        "compare": STATE["compare"],
        "rules": rules[-15:],
        "new_rules": approved,
        "pending_rules": pending,
    }


TEACH_PROMPT = (
    "TEACH MODE. Use the weight lab to teach the local student model from your last answer in this chat. Do these steps in order:\n"
    "1. lab_add_lesson twice with exam=false: two different owner questions your last answer covers. "
    "context = only the key data rows you used (under 2000 chars). teacher_answer = 1-3 sentences with the key numbers.\n"
    "2. lab_add_lesson once with exam=true: a held-out question on the same facts, worded differently from both lessons.\n"
    "3. lab_run_exam (score before).\n"
    "4. lab_teach on one middle layer (for example 14) with strength 1.0.\n"
    "5. lab_run_exam again (score after).\n"
    "6. If the average went down, lab_revert_last.\n"
    "7. If you learned a durable house rule about reading this restaurant's data, call propose_playbook_rule once.\n"
    "Before EACH tool call, write one short plain sentence saying what you are about to do, for example "
    "\"I'll write a lesson about the payroll vendor switch.\"\n"
    "Then reply in 3 short lines: score before, score after, and whether the edit was kept or reverted."
)
