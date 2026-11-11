# Secret Sauce web (local chat + gate)

A chat page on the owner's Mac. The brain is NEAR AI's sealed model (GLM 5.3 Flash).
The server (`server.py`, the "gate") runs every tool call locally and only sends NEAR
what a tool returned.

- `bistro__*` tools: read-only Odoo restaurant data, relayed from the bistro MCP.
- `list_files`, `read_file`: read-only, locked to one data folder (`SAUCE_DATA_DIR`).
- `propose_memory_update`: NEAR suggests a memory note; nothing is saved until you click Approve.
- `memory.md` from the vault goes into every prompt, because NEAR keeps no state.
- Each chat is logged to `vault/lessons/sessions.jsonl` (git-ignored) for later teaching.

## Run

```bash
python3 apps/secret-sauce-web/server.py   # stdlib only
open http://127.0.0.1:8787
```

Reads `NEARAI_API_KEY` from the env or the git-ignored `.env`. The bistro MCP URL and
auth come from `BISTRO_MCP_URL` / `BISTRO_MCP_AUTH` or the vault's `workspace/opencode.json`.
Binds to 127.0.0.1 only. Use made-up demo data only.
