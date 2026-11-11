# Secret Sauce web (local chat)

A Claude-Desktop-like chat page that runs on the owner's Mac.
NEAR AI Cloud (GLM 5.3 Flash, inside a confidential TEE) is the brain.
A small local server, the "gate", runs the tools NEAR asks for.

```
browser  ->  gate (server.py, 127.0.0.1:8790)  ->  NEAR AI Cloud
                 |-> Bistro MCP (read-only Odoo)
                 |-> local files in SAUCE_DATA_DIR (read-only)
                 |-> memory proposals (owner approves)
```

## Run

```bash
~/dev/secret-sauce/.venv/bin/python apps/secret-sauce-web/server.py
```

Then open http://localhost:8790. Or use the `secret-sauce-web` entry in `.claude/launch.json`.

## Settings (read from `~/dev/secret-sauce/.env`, never sent to the browser)

| Name | What it is |
|---|---|
| `NEARAI_API_KEY` | NEAR AI Cloud key |
| `NEARAI_BASE_URL`, `NEARAI_MODEL` | optional, default `https://cloud-api.near.ai/v1`, `z-ai/glm-5.3-flash` |
| `BISTRO_MCP_URL`, `BISTRO_MCP_TOKEN` | Bondan's Bistro MCP (see `Restaurant-MCP_GUIDE.md`) |
| `SAUCE_DATA_DIR` | the one folder NEAR may read; default `vault/owner-files` |
| `SAUCE_PORT` | default 8790 |

## What it writes (all in the git-ignored `vault/`)

- reads `vault/workspace/memory.md` into the system prompt on every chat
- `vault/memory-proposals.md`: every memory NEAR proposes
- `vault/workspace/memory.md`: gets a proposal appended when the owner clicks Approve
- `vault/lessons/sessions.jsonl`: one line per finished chat (on "New chat" or closing the tab)

## API

- `POST /api/chat` `{session_id?, message}` streams NDJSON events: `session`, `thinking`, `tool_start`, `tool_done`, then `done` (answer, trace with row counts, proposals) or `error`.
- `POST /api/approve` `{id}`, `POST /api/end` `{session_id}`, `GET /api/attestation`, `GET /api/health`.
