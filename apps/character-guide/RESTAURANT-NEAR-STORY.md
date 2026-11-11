# Restaurant AI, payments and staking story

New separate PR after the combined graph demo. Open `#restaurant-near` or the Restaurant AI, payments and staking tab. This implements the requested explanatory story and private local narration, not real money execution.

## Run and hear Adam without installing a voice model

From `apps/character-guide`, Node 22.12+:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed URL with `#restaurant-near`. No API key or proxy is needed for this page. Privately download the separately delivered `adam-restaurant-private-voice.zip` and extract it OUTSIDE the repository. Choose its five WAV files in Load private narration clips. Select a scene, then Play selected Adam clip. Stop and scene navigation cancel playback. Clear removes the clip URLs; reload requires importing again.

The private pack was generated locally using Adam's authorized reference. It is not bundled, uploaded, persisted or installed by Git. Do not put it in public/, source control, shared hosting or screenshots. No reference recording or model is included in that pack. The filenames are a matching convention, not authentication of a speaker. The fixed clip text is in `src/engine/restaurant-story.ts`. Arbitrary text cloning still requires the separate private Pocket runtime, model and reference; this file import does not install them.

## Source-backed capabilities, proposed integration

- NEAR Builders covers writing, testing and deploying smart contracts; NEAR AI's OpenAI-compatible private/verifiable cloud; and Agent Connect accounts operating within owner-signed rules. This demo deploys no contract and verifies no TEE attestation.
- Intents express desired token outcomes. Competing market makers offer quotes and approved quotes use atomic settlement. That is not a ready merchant checkout: supported routes, invoice matching, refunds, accounting and permissions remain integration work.
- Staking for inference redirects staking rewards, not the principal, into compute credits. Coverage depends on stake, token price, reward rate and fees. Actual wallet lock/exit terms remain unverified here; no fixed APY, capital safety or instant withdrawal is promised.
- A customer staking-linked loyalty perk is a separate proposal. No eligibility, funding, payout, free meal or reward amount is established.

No real restaurant records, wallet connection, Intents quote, payment, stake, order, staffing change or deployment is executed. The existing nine-metric graph is retained as a synthetic scenario, not expanded further or mistaken for real service counters.

## Sources inspected November 11, 2026

- https://nearbuilders.org/build?ref=KOBX2HPZ
- https://docs.near-intents.org/getting-started/what-are-intents
- https://docs.near.ai/cloud/staking-for-inference/overview

## Verification

`npm test`, `npm run test:server`, `npm run build`; `node e2e/story.mjs`. Set `TEST_STORY_PACK` to the private pack folder to test actual clip import/playback. Never commit that folder. Tests check actual mouth/audio state, Stop, navigation cancellation, no bundled voice or stock substitution, no persistence/uploads and narrow layouts.
