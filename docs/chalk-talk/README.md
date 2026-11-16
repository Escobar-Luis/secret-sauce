# The big-idea chalk talk

Three voiced, step-by-step pages that explain Secret Sauce's main idea. `index.html` shows them as tabs. GitHub Pages serves them at https://escobar-luis.github.io/secret-sauce/chalk-talk/.

| Page | What it shows |
|---|---|
| `big-idea` | Why: before and now. A concept talk. |
| `how-it-learns` | One "Teach from this chat" lap, as built. Every arrow is traced to a line of code (press `V`). |
| `road-to-alone` | The planned road to running the local model alone. Nothing in it is built yet. |

The `.scene.json` files are the sources. The `.html` pages are generated from them with the [chalk-talk](https://github.com/oztrkemree/chalk-talk) Claude Code skill (MIT). The voice comes from Kokoro, which runs locally for free. To rebuild one, run the commands below from the repo root, with Kokoro running on port 8880:

```bash
CHALK_SHARE=1 node <chalk-talk skill>/scripts/build.mjs docs/chalk-talk/how-it-learns.scene.json
node <chalk-talk skill>/scripts/check.mjs docs/chalk-talk/how-it-learns.html
```

The build re-checks every code trace. Rebuild after editing `apps/secret-sauce-web/server.py`, `lab.py` or `apps/weight-lab/weight_lab.py`, because the line numbers in the scenes can move.

The video in `docs/media/secret-sauce-big-idea.mp4` is a tighter cut of the same three talks. It was recorded frame by frame from the pages, with the same Kokoro voice, and mixed with ffmpeg.
