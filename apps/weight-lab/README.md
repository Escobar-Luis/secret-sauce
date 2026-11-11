# Weight Lab (research prototype)

A local MCP server that lets NEAR's sealed model (the teacher, via OpenCode) improve a
small local model (the student) by editing its weights on this Mac.

- The teacher never sees the weights and never runs code here. It calls guarded tools.
- Lessons, edits, weight backups and any adapter live in `WEIGHT_LAB_DIR`
  (default `~/dev/secret-sauce/vault/weight-lab`, git-ignored). Lessons hold private data.
- Student: `mlx-community/Qwen3-1.7B-bf16` (override with `WEIGHT_LAB_MODEL`).

## Tools

| Tool | What it does |
|---|---|
| `add_lesson(question, context, teacher_answer, exam)` | Save a lesson; `exam=true` keeps it held out |
| `ask_student(question, context)` | Student answers on the Mac |
| `run_exam()` | Student answers exam lessons; local score vs teacher (word F1 + numbers) |
| `teach(layer, strength)` | Rank-one edit to one layer's MLP `down_proj`, toward the teacher's answers |
| `revert_last()` | Undo the last edit |
| `lora_train(iters)` | Fallback: short LoRA run on training lessons |
| `list_edits()`, `status()` | Inspect state |

## How `teach` works

For each training lesson, the lab runs the student on its own answer and on the teacher's
answer, and records the MLP input (`k`) and the layer output (`h`) averaged over answer
tokens. It sets `v = h_teacher - h_student` and adds `strength * v kᵀ / (kᵀk)` to that
layer's `down_proj` weight. This is a ROME-style rank-one edit: research, not proven to
help on this task. Always compare `run_exam` before and after, and `revert_last` if worse.

## Run

```bash
# one local lap with a made-up lesson
WEIGHT_LAB_DIR=/tmp/wl-smoke ../../.venv/bin/python smoke_test.py
```

OpenCode config (in a git-ignored folder):

```json
"mcp": { "weight-lab": { "type": "local",
  "command": ["<repo>/.venv/bin/python", "<repo>/apps/weight-lab/weight_lab.py"] } }
```
