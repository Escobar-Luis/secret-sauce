- source_spec: `_bmad-output/implementation-artifacts/spec-main-idea-chalk-talk-video.md`
  summary: Add a check (CI or script) that rebuilds docs/chalk-talk scenes so code traces can't drift after edits to server.py, lab.py or weight_lab.py.
  evidence: No .github/ in repo; build.mjs/check.mjs live outside the repo; built pages embed snippets at build time.
- source_spec: `_bmad-output/implementation-artifacts/spec-main-idea-chalk-talk-video.md`
  summary: README "How it works" step 5 and the results table say the edit is "undone automatically"; it is undone by NEAR following TEACH_PROMPT step 6, not by a Mac-side guard.
  evidence: apps/secret-sauce-web/lab.py:230; no score comparison in lab.py or weight_lab.py.
