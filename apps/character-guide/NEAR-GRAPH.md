# NEAR graph walkthrough with Adam's private narration

Open the NEAR graph walkthrough tab or `#near-graph`. This is the requested working DEMO page: actual Cebollito walking, pointing, selected-point speech and a full seven-point narrated sequence. It does not connect payment, staking or AI accounts.

From `apps/character-guide`, Node 22.12+:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed origin followed by `/#near-graph`. If the dev server says 5173, use `http://127.0.0.1:5173/#near-graph`.

Extract the separately delivered `adam-near-graph-private-voice.zip` OUTSIDE the repo. Choose all seven `near-0.wav` through `near-6.wav` in Load seven private NEAR graph WAV files. Click Play full NEAR walkthrough, or select a point then Walk and speak selected point. Stop and point navigation cancel playback. No Python, key, model or local proxy needed for these fixed clips. No stock substitute. Reload requires choosing the clips again.

The clips are locally generated from Adam's authorized reference. No voice/reference/model is in Git or uploaded by this page. Filenames match scenes but are not speaker authentication. Do not copy the private ZIP/WAVs into public/, Git or shared hosting. Arbitrary text cloning is a separate private runtime feature.

Seven synthetic sales points are visual anchors for source-backed explanations: NEAR Protocol/smart contracts, NEAR AI private cloud, Agent Connect owner-signed rules, desired token outcomes and competing Intents quotes, atomic settlement and merchant integration limits, staking rewards funding inference credits, and customer incentives as a separate proposal. These are not observed usage or reward metrics. No contract deployment, live inference, payment, quote, stake, signature or upload occurs. No privacy proof, fixed APY, guaranteed reward, capital safety or instant withdrawal is promised.

Sources inspected November 11, 2026:
- https://nearbuilders.org/build?ref=KOBX2HPZ
- https://docs.near-intents.org/getting-started/what-are-intents
- https://docs.near.ai/cloud/staking-for-inference/overview

Tests: `npm test`, `npm run test:server`, `npm run build`, `node e2e/near-graph.mjs`. Set TEST_NEAR_PACK to the external private pack folder to test actual narration. Never commit the folder or private paths.
