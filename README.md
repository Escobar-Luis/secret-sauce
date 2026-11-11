# Secret Sauce

A private AI assistant for restaurant owners. Built at the NEAR Private AI Hackathon NYC (Nov 11, 2026). Track 3: Privacy & Private AI.

## The idea

Restaurant owners sit on sensitive data: sales, open tabs, inventory, costs, staff hours and pay. They can't paste that into a public chatbot.
Secret Sauce lets an owner chat with their own numbers. The model runs in a Confidential TEE on NEAR AI Cloud, so nobody, NEAR included, can see the prompts or answers.

Status: just started. Details to come.

## Setup

1. Copy `.env.example` to `.env` and put your NEAR AI Cloud key in it. Never commit `.env`.
2. Test the key:

```bash
set -a; source .env; set +a
curl https://cloud-api.near.ai/v1/chat/completions \
  -H "Authorization: Bearer $NEARAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "z-ai/glm-5.3-flash", "messages": [{"role": "user", "content": "Say hello in one sentence."}], "chat_template_kwargs": {"enable_thinking": false}}'
```

## OpenCode + NEAR AI Cloud

`opencode.json` sets the default model to `nearai/z-ai/glm-5.3-flash` (Confidential TEE). In OpenCode, run `/connect`, pick NEAR AI Cloud and paste your key.
If replies come from `big-pickle` instead, OpenCode's background helper has no key: use `/connect`, or run `opencode --standalone` after loading `.env`.

## Hackathon notes

- `HACKATHON.md` is the official guide for coding agents. Live copy: https://nearhackathon.com/HACKATHON.md
- Deadline: Sat Nov 14, 6:59 PM ET. The repo must be public by then.
- Base URL: `https://cloud-api.near.ai/v1` (OpenAI-compatible). Model: `z-ai/glm-5.3-flash`.
- Never put the API key in the repo or the demo video.
