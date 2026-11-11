# Sensitive-data graph walkthrough

New isolated graph slice, based on the per-page clips branch. This does not include the separate integration/TTS server candidate.

Open the Sensitive-data graph tab or load `#sensitive-data`. Four invented restaurant daily totals illustrate data minimization, aggregate comparisons, avoiding unsupported employee inferences and the boundary before taking action. No real records, connected systems, voice assets or confidential-computing guarantee.

Cebollito walks horizontally between the selected data points, then poses the pointing arm toward the actual graph target. Navigation includes point buttons, Previous, Next, Replay and Stop; the selected explanation and accessible source table do not depend on animation. Reduced-motion handling comes from the existing character stage. No personal audio is included, and the page is silent by default. This graph PR does not deploy the separate private local speech server.

Local checks: unit tests, TypeScript/build, and real Chrome checks for all four movements/pointing, backward/endpoint/Stop behavior, original walkthrough return, 320/390/1200 layout and browser errors. Inspect actual screenshots before approval. Model display depends on the existing `public/character.glb` asset; no new asset is copied here.

## Combined branch: core metric scenarios

`demo/restaurant-complete-20261111` adds 14 daily synthetic points for nine selectable feature metrics: gross sales, food waste, labor-cost ratio, on-time deliveries, AI input tokens, Whisper clips, read-only tool requests, hypothetical Intents quote demand and illustrative inference-credit budget. Every value is invented, including the service counters and credits. These are scenarios, not observed restaurant records, collected provider telemetry, audit logs or earned yield. Optional commerce does not connect a wallet or execute a quote, trade or stake.

The selected metric and date drive the graph, table, summary, character target, written explanation and speech text from the same values in `restaurant-metrics.ts`. Ratio changes are described in percentage points. Gross sales are not profit. The feature map links the user-shared NEAR Builders and Intents documentation without signup or account changes.

Graph speech controls are explicit: stock browser speech (not cloned and may use a device/browser speech service), private local Pocket generation when its loopback proxy is configured, or a local point audio file. A different graph point cancels playback and does not reuse the prior point's clip. No private reference, model or generated personal audio is in Git. Your own computer needs the private runtime for cloning; a Git pull does not install it.

Checks: `node e2e/graph.mjs` runs the metric browser checks. `node e2e/graph-speech.mjs` requires explicitly supplied TEST_POCKET_PYTHON, TEST_POCKET_CONFIG, TEST_POCKET_REFERENCE and TEST_GRAPH_CLIP private local paths to verify actual offline generation and audio playback. Never commit those files or paths. Live NEAR inference remains disabled in these tests. Stock browser voice availability depends on the browser; no successful Mac voice output is asserted by these checks.
