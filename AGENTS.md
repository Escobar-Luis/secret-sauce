<!-- bmad:context -->
<!-- Verified 2026-11-16 against 9724583. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## secret-sauce

A private AI analyst for small restaurants, built at the NEAR Private AI Hackathon (Nov 2026) and already submitted. Python 3.12 gate server (Starlette) that calls NEAR AI Cloud, a local MLX weight lab, and a React/Vite prototype. `README.md` is the page judges read; BMad planning output goes in `_bmad-output/`.

## Policy

- Never open or commit `.env`, `secrets/` or `vault/`; owner books, lessons and weight edits stay on the Mac. Add new keys to `.env.example` as empty placeholders.
- Never commit a token or a tokened MCP URL; a bistro token already had to be redacted once. Write `BISTRO_MCP_*` placeholders instead.
- Never post to X or call nearhackathon.com; Luis posts himself, and the project is submitted (one submission per project, see `HACKATHON.md`).
- Never commit to main; one branch and PR per task.

## Where things are

- Gate server, NEAR tool loop, read-only tools, memory approvals: `apps/secret-sauce-web/server.py`
- "Teach from this chat" lap: `apps/secret-sauce-web/lab.py`
- Exams, rank-one weight edits, undo: `apps/weight-lab/weight_lab.py`
- Demo video, poster and other README media: `docs/media/`

## Running and verifying

- Start the app with `SAUCE_ROOT=$PWD .venv/bin/python apps/secret-sauce-web/server.py` from the repo root; without `SAUCE_ROOT` it reads `~/dev/secret-sauce`, so a worktree silently runs against the main checkout's files and vault.

<!-- /bmad:context -->
