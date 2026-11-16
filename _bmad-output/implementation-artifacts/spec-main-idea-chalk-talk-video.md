---
title: 'Main-idea chalk talk and video at the top of the README'
type: 'feature'
created: '2026-11-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0144b5848f46360f7eebf74fd9d059b5f77f399d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Secret Sauce's big idea (NEAR does the private work now and slowly teaches a small local model to do the job, until the owner runs it alone on their Mac) didn't come across at the hackathon or on X. The README states it in one line and shows only the 1-minute demo.

**Approach:** Retell Luis's chart-audit "Phase 1" chalk talks (why before/now, NEAR teaches and tests, hand-off) for a restaurant owner, traced to Secret Sauce's real code. Turn that chalk talk into a ~90 s narrated video with a free local Kokoro voice and word-timed captions. Put both at the top of the README as "The big idea", above the demo.

Decisions (Luis, 2026-11-16): big idea confirmed as stated; video about 90 seconds; free local voice plus captions; turn on free GitHub Pages from `main` `/docs` so the README links to a clickable chalk talk at `escobar-luis.github.io/secret-sauce/chalk-talk/`.

## Boundaries & Constraints

**Always:** dark mode; free tools only (chalk-talk engine, Kokoro, ffmpeg/HyperFrames, no card); every on-screen number comes from this repo (README results table, code constants); anything not built (graduation, running alone, monthly tutor, NEAR diploma) is visibly tagged "planned"; show Luis short pieces as they're made.

**Never:** post to X or anywhere else; open `.env` or `secrets/`; commit tokens; write to `~/dev/near-private-ai-hackathon` (read only); invent scores; claim the student has graduated.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GitHub visitor | Opens the repo page | Sees "The big idea" first: an inline animated chalk-talk GIF and a video poster, then the demo | N/A |
| Click poster | Clicks the video poster | Opens the main-idea mp4 in the repo | N/A |
| Interactive page | Clicks the chalk-talk link | Opens the stepping chalk talk (←/→, V for proof) | Falls back to the GIF if Pages is off |

</frozen-after-approval>

## Code Map

- `apps/secret-sauce-web/server.py:281-294` -- `system_prompt()`: memory file put into every prompt (NEAR is stateless).
- `apps/secret-sauce-web/server.py:297-315` -- `near_chat()`: POST to NEAR AI Cloud `/chat/completions` with tools.
- `apps/secret-sauce-web/server.py:336-436` -- `run_turn()`: tool loop; NEAR asks, the gate runs Bistro MCP / local / lab tools on the Mac and sends back only tool text.
- `apps/secret-sauce-web/server.py:495-515` -- `approve()`: memory and playbook rules saved only after the owner clicks Approve.
- `apps/secret-sauce-web/server.py:525-534` -- attestation endpoint (TEE badge).
- `apps/secret-sauce-web/lab.py:222-235` -- `TEACH_PROMPT`: lessons, held-out exam, exam before, teach, exam after, revert if worse.
- `apps/secret-sauce-web/lab.py:128-184` -- `_sync_call` / `run_lab_tool`: maps lab tools to weight_lab calls.
- `apps/weight-lab/weight_lab.py:129,218,243,260,301` -- `score`, `add_lesson`, `run_exam`, `teach` (rank-one MLP edit), `revert_last`.
- `README.md` -- results table (0.357→0.357 kept, 0.24→0.35 kept, 0.309→0.132 undone); "Graduate (the plan)".
- `~/dev/near-private-ai-hackathon/_bmad-output/chalk-talk/p1-why|p1-train|p1-handoff.scene.json` -- story shape to retell (read only).
- `~/dev/showcase-videos/secret-sauce-demo-2026-11-11/voice.py` + `tts-models/` -- working Kokoro voice to reuse.

## Tasks & Acceptance

**Execution:**
- [x] `docs/chalk-talk/*.scene.json` -- write 3 dark blueprint talks: `big-idea` (before/now), `how-it-learns` (traced teach lap), `road-to-alone` (planned hand-off), plus an `index.html` tab page -- one journey per talk, per chalk-talk limits.
- [x] `docs/chalk-talk/*.html`, `docs/media/big-idea.gif` -- build, check (0 errors), record GIF -- inline on GitHub.
- [x] `~/dev/showcase-videos/secret-sauce-big-idea-2026-11-16/` -- script, Kokoro voice, frames from the chalk talks, captions, render ~90 s mp4 -- video project lives with his other videos.
- [x] `docs/media/secret-sauce-big-idea.mp4`, `docs/media/big-idea-poster.jpg` -- copy the final cut and poster.
- [x] `README.md` -- add "The big idea" section above the demo: one plain paragraph, GIF, video poster, link to the chalk talk.
- [x] `.gitignore` -- ignore `_bmad/render/` (generated).

**Acceptance Criteria:**
- Given the chalk talks are built, when `build.mjs` runs, then every main-path hop in `how-it-learns` is traced to code or marked inferred, and `check.mjs` reports 0 errors.
- Given the video, when watched muted, then captions carry the story and planned parts read "planned".
- Given the README on GitHub, when opened, then the big idea appears before the demo and all media links resolve.

### Review Findings

- [x] [Review][Patch] README now contradicts itself on who undoes a bad edit ("undone automatically", "guards itself" vs "the plan tells NEAR") [README.md:62,83,85]
- [x] [Review][Patch] "A backup is saved first" overstates: teach() saves only the edit's v/k vectors; revert applies the opposite edit [docs/chalk-talk/how-it-learns.scene.json step 5; weight_lab.py:289,312]
- [x] [Review][Patch] Talk 2 hides NEAR's tool calls during exam, edit and undo, so the Mac looks like it runs the loop alone [docs/chalk-talk/how-it-learns.scene.json steps 4-6]
- [x] [Review][Patch] Exam and edit cover all lessons saved so far, not only this lap's; the score is word + number overlap, not % correct [how-it-learns steps 3-4; weight_lab.py:129,243-258]
- [x] [Review][Patch] Talk 1 tag "misses the theft" is unsupported (no such run; the data shows shortages, not theft) [docs/chalk-talk/big-idea.scene.json step 3]
- [x] [Review][Patch] "Only tool results leave the Mac" is too broad: the question, memory file and teaching plan also go to NEAR [README.md:25; server.py:281-294]
- [x] [Review][Patch] README says V shows traced arrows for all 3 parts; only part 2 is traced [README.md:29]
- [x] [Review][Patch] Transcript "as in lap 3" comes before laps are explained [README.md transcript, video line]
- [x] [Review][Patch] Talk 1 edge #2 says "question + tool results" before the books are read [big-idea.scene.json edge think]
- [x] [Review][Patch] Student code anchor 102-112 runs past _student_answer (102-105) [how-it-learns.scene.json node student]
- [x] [Review][Patch] Tab click moves focus into the iframe, so keyboard users lose their place in the tab list [docs/chalk-talk/index.html:47]
- [x] [Review][Patch] Chalk-talk check snapshots are not git-ignored [.gitignore]
- [x] [Review][Defer] No CI re-checks the scenes' code traces after app edits [docs/chalk-talk/*.scene.json] — deferred: already in deferred-work.md; needs vendored build scripts or CI
- [x] [Review][Defer] GitHub Pages link 404s until Pages is on [README.md:29] — deferred: maybe-false; settled by enabling Pages right after merge and loading the URL

Rejected:
- Spec notes say 1:29, Verification lacks CHALK_SHARE=1, empty change log (fix edits the spec under review)
- No explicit GIF fallback (low; the GIF is always shown under the link, which serves as the fallback)
- Section is a list, not one paragraph (low; split on purpose in the build review to separate built from planned)
- Rebuild steps not reproducible outside Luis's setup (low; build note links the open-source skill; video scripts live with his other videos)
- ARIA tab pattern gaps beyond focus (low; adds keyboard machinery for a 3-tab page)
- Hash with odd case or step suffix opens talk 1 (low; nobody shares such links)
- pick() with unknown src throws (false; byHash maps only to the three tab srcs and the default)
- Muted captions not watched by the auditor (false; captions come from the same text, and Luis watched drafts 1 and 2)

## Implementation Notes

- Implemented in the lead session, not a fresh subagent: Luis asked to see short pieces and react as they were made, which a subagent cannot do.
- `docs/chalk-talk/`: `big-idea` (8 steps, concept, proof off), `how-it-learns` (7 steps, 5/5 hops verified against code), `road-to-alone` (6 steps, every step tagged planned), `index.html` tabs, voiced by local Kokoro (af_heart, 1.1x). Built with `CHALK_SHARE=1` so no local paths are embedded. Check snapshots are not committed.
- `docs/index.html` redirects the Pages root to `chalk-talk/`; `docs/.nojekyll` skips Jekyll.
- Video project: `~/dev/showcase-videos/secret-sauce-big-idea-2026-11-16/`. `make-scenes.py` derives a tighter video cut of the three talks (shorter lines, voice 1.25x, no repeat recaps); `record-video.mjs` records frames with `chalk.seek()` and lights caption words with the page's own Kokoro word timings; `assemble.py` mixes the per-step voice clips with ffmpeg. Draft 1 ran 1:41; Luis: "make the transitions faster" → draft 2 at 1:29 (steps advance when the voice ends, drawings at 1.35x). Draft 1 kept in `archive/v1/`.
- README: new "The big idea" section above a renamed "The demo" section; layout table lists `docs/chalk-talk/`; fixed the broken Sahil Pardasani link in Team.
- `.gitignore`: `_bmad/render/`.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | blind | "Every good answer becomes a lesson" contradicts Teach-only training | medium | `server.py:465`, `index.html:244`: lessons only on Teach. patch: README, talk 1 step 7, video line reworded |
| 2 | blind | README put the built teach lap under "Tomorrow" | medium | Lessons + weight edits are built (`lab.py`, `weight_lab.py`). patch: stages split built / planned |
| 3 | blind, edge | Talks imply the Mac guarantees the undo | medium | Revert is step 6 of `TEACH_PROMPT` (`lab.py:230`), NEAR follows it. patch: talk 2 step 6 and video say "the plan tells NEAR to undo" |
| 4 | blind | `plan` edge traced to generic `near_chat`, not the TEACH_PROMPT swap | low | patch: edge now `server.py:462-466`, calls `lab.TEACH_PROMPT if body.get("teach")`, verified |
| 5 | blind | Talk 3 drew student reading books directly | medium | Today the gate runs read-only tools. patch: `read` edge is gate → books |
| 6 | blind | Talk 3 last step shows planned parts untagged | medium | Spec Always: planned parts tagged. patch: planned tags on student and diploma |
| 7 | blind, edge | Arrow keys dead until the iframe is clicked | low | patch: iframe focused on load |
| 8 | blind, edge | No hashchange; hash deep link loads talk 1 first | low | patch: hashchange listener, src set once from hash |
| 9 | blind, edge | Pages link 404 until Pages is on | maybe-false | Pages gets enabled right after merge (approved by Luis); verified then |
| 10 | blind | Talks and video can't be rebuilt from repo | low | patch: `docs/chalk-talk/README.md` build note |
| 11 | blind | Spec lists local paths in a public repo | low | Paths are folder names, no secrets; frozen block cites them. rejected |
| 12 | blind | No transcript | low | patch: collapsed transcript under the video |
| 13 | blind | Kokoro / chalk-talk not credited | low | patch: Built with line |
| 14 | blind | Unused `say_as`, `docs/index.html` lacks lang/viewport, header-only code anchors, mixed JSON formatting | low | patch first two and formatting; anchors rejected (cosmetic) |
| 15 | verification-gap | No CI re-checks code traces after code edits | medium | No `.github/`, build scripts outside repo. defer |
| 16 | verification-gap, edge | Built talk pages not in reviewed diff | false | Excluded from the review diff on purpose (generated, ~1 MB each); they are committed; spot checks: no `/Users/` paths, no tokens |
| 17 | blind | README "undone automatically" table cell and README step 5 line pre-date this change | low | pre-existing wording. defer |

## Verification

**Commands:**
- `node ~/.claude/skills/chalk-talk/scripts/build.mjs docs/chalk-talk/<slug>.scene.json` -- expected: proof line, no WARNING proof
- `node ~/.claude/skills/chalk-talk/scripts/check.mjs docs/chalk-talk/<slug>.html` -- expected: 0 errors
- `ffprobe docs/media/secret-sauce-big-idea.mp4` -- expected: ~85-100 s, h264, has audio
- `git diff --cached | grep -iE "token|sk-|key="` -- expected: nothing secret

**Manual checks (if no CLI):**
- Read the GIF and contact frames; open README preview on the PR.
