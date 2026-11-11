"""Weight Lab: a local MCP server that lets a sealed teacher model (NEAR) edit a
small student model's weights on this Mac.

The teacher never sees the weights or runs code here. It calls a few guarded
tools; this process does the math locally and reports back short numbers.

Tools
- add_lesson: store a (question, context, teacher_answer) example, train or exam.
- ask_student: run the student on a question + context.
- run_exam: student answers every exam lesson; local score vs the teacher.
- teach: rank-one weight edit on one layer's MLP, pulling the student toward
  the teacher's answers on the training lessons (a weight-space edit).
- lora_train: fallback, a short LoRA run on the training lessons.
- revert_last / list_edits / status.

State (lessons, edit log, weight backups, adapter) lives in WEIGHT_LAB_DIR,
which must be a git-ignored folder: lessons hold private business data.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
from mlx_lm import generate, load

try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP

MODEL_ID = os.environ.get("WEIGHT_LAB_MODEL", "mlx-community/Qwen3-1.7B-bf16")
LAB_DIR = Path(
    os.environ.get(
        "WEIGHT_LAB_DIR", str(Path.home() / "dev/secret-sauce/vault/weight-lab")
    )
)
LAB_DIR.mkdir(parents=True, exist_ok=True)
LESSONS = LAB_DIR / "lessons.jsonl"
EDITS = LAB_DIR / "edits.jsonl"
BACKUPS = LAB_DIR / "backups"
BACKUPS.mkdir(exist_ok=True)
ADAPTER = LAB_DIR / "adapter"

SYSTEM = (
    "You are the private analyst for this restaurant. Answer the owner's "
    "question using only the context. Be short and give the key numbers."
)
MAX_STRENGTH = 4.0
MAX_CONTEXT_CHARS = 12000

mcp = FastMCP("weight-lab")
_state: dict = {}


def log(msg: str) -> None:
    # stdout is the MCP channel; logs go to stderr and never include lesson text.
    print(f"[weight-lab] {msg}", file=sys.stderr, flush=True)


def _model():
    if "model" not in _state:
        adapter = str(ADAPTER) if (ADAPTER / "adapters.safetensors").exists() else None
        model, tok = load(MODEL_ID, adapter_path=adapter)
        _state.update(model=model, tok=tok)
        _replay_edits(model)
        log(f"loaded {MODEL_ID} adapter={bool(adapter)}")
    return _state["model"], _state["tok"]


def _layers(model):
    return model.model.layers


def _prompt_tokens(tok, question: str, context: str) -> list[int]:
    msgs = [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": f"Context:\n{context[:MAX_CONTEXT_CHARS]}\n\nQuestion: {question}",
        },
    ]
    text = tok.apply_chat_template(
        msgs, add_generation_prompt=True, tokenize=False, enable_thinking=False
    )
    return tok.encode(text, add_special_tokens=False)


def _clean(text: str) -> str:
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    return text.strip()


def _student_answer(question: str, context: str, max_tokens: int = 300) -> str:
    model, tok = _model()
    toks = _prompt_tokens(tok, question, context)
    return _clean(generate(model, tok, prompt=toks, max_tokens=max_tokens))


# ---------- scoring (local, no AI) ----------

_NUM = re.compile(r"-?\d[\d,]*\.?\d*")


def _nums(text: str) -> set[str]:
    out = set()
    for n in _NUM.findall(text):
        n = n.replace(",", "").rstrip(".")
        if n and n not in {"-"}:
            try:
                out.add(str(round(float(n), 1)))
            except ValueError:
                pass
    return out


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z]+", text.lower())


def score(student: str, teacher: str) -> dict:
    sw, tw = _words(student), _words(teacher)
    common = 0
    pool = list(sw)
    for w in tw:
        if w in pool:
            pool.remove(w)
            common += 1
    p = common / len(sw) if sw else 0.0
    r = common / len(tw) if tw else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    tn = _nums(teacher)
    num = len(tn & _nums(student)) / len(tn) if tn else 1.0
    return {"f1": round(f1, 3), "numbers": round(num, 3), "score": round(0.5 * f1 + 0.5 * num, 3)}


# ---------- lessons ----------


def _read_lessons() -> list[dict]:
    if not LESSONS.exists():
        return []
    return [json.loads(l) for l in LESSONS.read_text().splitlines() if l.strip()]


# ---------- activation capture + rank-one edit ----------


class _Capture(nn.Module):
    """Wraps a module and records its input (for down_proj) or output (block)."""

    def __init__(self, inner, mode: str):
        super().__init__()
        self.inner = inner
        self.mode = mode
        self.seen: list = []

    def __call__(self, x, *args, **kwargs):
        y = self.inner(x, *args, **kwargs)
        self.seen.append(x if self.mode == "input" else y)
        return y


def _answer_acts(model, tok, lesson: dict, answer: str, layer: int):
    """Mean down_proj input (key) and block output (hidden) over answer tokens."""
    prompt = _prompt_tokens(tok, lesson["question"], lesson.get("context", ""))
    ans = tok.encode(answer, add_special_tokens=False)[:256]
    if not ans:
        return None
    block = _layers(model)[layer]
    down = block.mlp.down_proj
    cap_k = _Capture(down, "input")
    cap_h = _Capture(block, "output")
    block.mlp.down_proj = cap_k
    _layers(model)[layer] = cap_h
    try:
        model(mx.array([prompt + ans]))
        k = cap_k.seen[-1][0, len(prompt):, :].astype(mx.float32).mean(axis=0)
        h = cap_h.seen[-1][0, len(prompt):, :].astype(mx.float32).mean(axis=0)
        mx.eval(k, h)
    finally:
        block.mlp.down_proj = down
        _layers(model)[layer] = block
    return k, h


def _apply_rank_one(model, layer: int, v: mx.array, k: mx.array, strength: float):
    lin = _layers(model)[layer].mlp.down_proj
    w = lin.weight  # (hidden, intermediate)
    delta = strength * mx.outer(v, k) / (mx.sum(k * k) + 1e-6)
    lin.weight = (w.astype(mx.float32) + delta).astype(w.dtype)
    mx.eval(lin.weight)


def _replay_edits(model) -> None:
    if not EDITS.exists():
        return
    for line in EDITS.read_text().splitlines():
        e = json.loads(line)
        if e.get("reverted"):
            continue
        arrs = mx.load(str(BACKUPS / f"{e['id']}-vk.safetensors"))
        _apply_rank_one(model, e["layer"], arrs["v"], arrs["k"], e["strength"])


# ---------- tools ----------


@mcp.tool()
def add_lesson(question: str, context: str, teacher_answer: str, exam: bool = False) -> str:
    """Store one lesson: the owner's question, the data context the teacher used,
    and the teacher's answer. exam=True keeps it out of teaching (held-out test)."""
    lessons = _read_lessons()
    lid = f"L{len(lessons) + 1:03d}"
    rec = {
        "id": lid,
        "question": question,
        "context": context[:MAX_CONTEXT_CHARS],
        "teacher_answer": _clean(teacher_answer),
        "exam": exam,
        "ts": time.time(),
    }
    with LESSONS.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    return json.dumps({"id": lid, "exam": exam, "total": len(lessons) + 1})


@mcp.tool()
def ask_student(question: str, context: str) -> str:
    """Run the local student model on a question plus context. Returns its answer."""
    return _student_answer(question, context)


@mcp.tool()
def run_exam(include_train: bool = False) -> str:
    """Student answers every exam lesson (and training lessons if asked).
    Returns per-lesson scores vs the teacher (0-1) and the average."""
    rows = []
    for l in _read_lessons():
        if not l["exam"] and not include_train:
            continue
        ans = _student_answer(l["question"], l["context"])
        s = score(ans, l["teacher_answer"])
        rows.append({"id": l["id"], "exam": l["exam"], **s, "student_answer": ans[:400]})
    avg = round(sum(r["score"] for r in rows) / len(rows), 3) if rows else None
    with (LAB_DIR / "exam-history.jsonl").open("a") as f:
        f.write(json.dumps({"ts": time.time(), "avg": avg, "n": len(rows)}) + "\n")
    return json.dumps({"average": avg, "results": rows})


@mcp.tool()
def teach(layer: int, strength: float = 1.0, lesson_ids: list[str] | None = None) -> str:
    """Weight-space edit: on one layer's MLP (down_proj), add a rank-one change
    that moves the student's internal state on its own answers toward its state
    on the teacher's answers, averaged over the training lessons. Saves a backup
    so it can be reverted. Pick a middle layer first (for example 10-20)."""
    model, tok = _model()
    n_layers = len(_layers(model))
    if not 0 <= layer < n_layers:
        return json.dumps({"error": f"layer must be 0..{n_layers - 1}"})
    strength = max(-MAX_STRENGTH, min(MAX_STRENGTH, float(strength)))
    train = [l for l in _read_lessons() if not l["exam"]]
    if lesson_ids:
        train = [l for l in train if l["id"] in set(lesson_ids)]
    if not train:
        return json.dumps({"error": "no training lessons; add_lesson with exam=false first"})
    vs, ks = [], []
    for l in train:
        student = _student_answer(l["question"], l["context"], max_tokens=200)
        t = _answer_acts(model, tok, l, l["teacher_answer"], layer)
        s = _answer_acts(model, tok, l, student, layer)
        if t is None or s is None:
            continue
        vs.append(t[1] - s[1])
        ks.append(s[0])
    if not vs:
        return json.dumps({"error": "could not build an edit from these lessons"})
    v = mx.stack(vs).mean(axis=0)
    k = mx.stack(ks).mean(axis=0)
    edits = EDITS.read_text().splitlines() if EDITS.exists() else []
    eid = f"E{len(edits) + 1:03d}"
    mx.save_safetensors(str(BACKUPS / f"{eid}-vk.safetensors"), {"v": v, "k": k})
    _apply_rank_one(model, layer, v, k, strength)
    rec = {"id": eid, "layer": layer, "strength": strength, "lessons": [l["id"] for l in train],
           "v_norm": round(float(mx.linalg.norm(v)), 3), "ts": time.time()}
    with EDITS.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    log(f"edit {eid} layer={layer} strength={strength}")
    return json.dumps(rec)


@mcp.tool()
def revert_last() -> str:
    """Undo the most recent active weight edit."""
    if not EDITS.exists():
        return json.dumps({"error": "no edits"})
    lines = [json.loads(l) for l in EDITS.read_text().splitlines()]
    active = [e for e in lines if not e.get("reverted")]
    if not active:
        return json.dumps({"error": "no active edits"})
    last = active[-1]
    model, _ = _model()
    arrs = mx.load(str(BACKUPS / f"{last['id']}-vk.safetensors"))
    _apply_rank_one(model, last["layer"], arrs["v"], arrs["k"], -last["strength"])
    last["reverted"] = True
    EDITS.write_text("".join(json.dumps(e) + "\n" for e in lines))
    return json.dumps({"reverted": last["id"]})


@mcp.tool()
def list_edits() -> str:
    """List weight edits so far (id, layer, strength, reverted)."""
    if not EDITS.exists():
        return "[]"
    return json.dumps([json.loads(l) for l in EDITS.read_text().splitlines()])


@mcp.tool()
def lora_train(iters: int = 60) -> str:
    """Fallback: short LoRA fine-tune on the training lessons (gradient training,
    not a direct weight edit). Reloads the student with the new adapter."""
    train = [l for l in _read_lessons() if not l["exam"]]
    if len(train) < 2:
        return json.dumps({"error": "need at least 2 training lessons"})
    data = LAB_DIR / "lora-data"
    data.mkdir(exist_ok=True)
    rows = [
        json.dumps({"messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Context:\n{l['context']}\n\nQuestion: {l['question']}"},
            {"role": "assistant", "content": l["teacher_answer"]},
        ]})
        for l in train
    ]
    (data / "train.jsonl").write_text("\n".join(rows) + "\n")
    (data / "valid.jsonl").write_text(rows[0] + "\n")
    iters = max(10, min(300, int(iters)))
    cmd = [sys.executable, "-m", "mlx_lm", "lora", "--model", MODEL_ID, "--train",
           "--data", str(data), "--iters", str(iters), "--batch-size", "1",
           "--num-layers", "8", "--adapter-path", str(ADAPTER), "--max-seq-length", "4096"]
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        return json.dumps({"error": "lora failed", "tail": p.stderr[-800:]})
    _state.clear()  # reload with adapter on next call
    losses = re.findall(r"Train loss ([\d.]+)", p.stdout + p.stderr)
    return json.dumps({"iters": iters, "seconds": round(time.time() - t0),
                       "first_loss": losses[0] if losses else None,
                       "last_loss": losses[-1] if losses else None})


@mcp.tool()
def status() -> str:
    """Model id, layer count, lesson counts, active edits, adapter present."""
    model, _ = _model()
    lessons = _read_lessons()
    edits = [json.loads(l) for l in EDITS.read_text().splitlines()] if EDITS.exists() else []
    return json.dumps({
        "model": MODEL_ID,
        "layers": len(_layers(model)),
        "train_lessons": sum(not l["exam"] for l in lessons),
        "exam_lessons": sum(l["exam"] for l in lessons),
        "active_edits": [e["id"] for e in edits if not e.get("reverted")],
        "lora_adapter": (ADAPTER / "adapters.safetensors").exists(),
    })


if __name__ == "__main__":
    mcp.run()
