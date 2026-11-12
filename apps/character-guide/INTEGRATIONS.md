# Restaurant inputs and local speech prototype

Post-cutoff development slice, November 11, 2026. Separate from the stable restaurant walkthrough. Do not deploy this local prototype as a public API.

## Implemented and checked locally

- CSV/PDF picker and drag/drop, bounded local text preview, removable memory-only documents. No OCR, document upload, model indexing or spreadsheet formula evaluation. Uploaded text is untrusted data, not instructions for tools.
- Editable chat composer and deterministic synthetic restaurant replies. There is no live NEAR chat completion yet. Documents are not secretly sent to a model.
- NEAR Whisper multipart server adapter, validation, timeout, error handling and fake-transport tests. The browser never receives an API key. Live Whisper is OFF by default and has not been called in this implementation.
- Fixed synthetic read-only CLI summary executes as a child process with `shell: false`, no browser-supplied command/arguments/environment. Actual restaurant systems are not connected.
- MCP adapter seam accepts an already initialized trusted client and operator-approved read-only tool binding. This is not a deployed MCP client, auth flow, or verified restaurant POS connection.
- Private local Pocket TTS server bridge, explicit composer-to-speech action, and audio-driven character playback. It requires a local offline model/config and authorized reference outside the repository. No personal recording, embedding or generated speech is included.

## Run locally

Requirements: Node 22+, npm; for speech, Python 3.10+, Pocket TTS and CPU PyTorch installed separately. Bind only to loopback. Keep private assets outside the checkout.

```sh
npm ci
npm test
npm run test:server
npm run build
node e2e/integrations.mjs
```

Start the local integration proxy in one terminal:

```sh
# Optional offline speech. Set these to YOUR private local files/runtime.
export POCKET_LOCAL_ENABLED=true
export POCKET_PYTHON=/absolute/path/to/venv/bin/python
export POCKET_MODEL_CONFIG=/absolute/private/path/local-english.yaml
export POCKET_REFERENCE_FILE=/absolute/private/path/authorized-reference.wav
npm run integrations
```

In another terminal:

```sh
npm run dev -- --host 127.0.0.1 --port 4177
```

Open `http://127.0.0.1:4177`. This dev server proxies `/api/integrations` to loopback port 8787. The proxy requires the exact browser Origin; set `APP_ORIGIN` explicitly if using another local port. It rejects unexpected Host/Origin values and has no wildcard CORS. This is not production authentication or a multitenant service.

Without the optional private runtime, the app works with local document inputs and synthetic chat/tools and shows TTS as not connected. A static build alone cannot execute Python or connect a server-side secret.

## NEAR Whisper activation remains gated

Official endpoint: `POST https://cloud-api.near.ai/v1/audio/transcriptions`, model `openai/whisper-large-v3`, file + model multipart fields. Formats: MP3/WAV/WEBM/FLAC/OGG/M4A, at most 25 MB. Transcript is placed in the composer for review, never automatically sent as a chat message or turned into a tool call.

The operator may enable this server route only after agreeing the actual credential/account, source audio disclosure and bounded cost. Supply `NEAR_API_KEY` securely on the server and set `NEAR_LIVE_ENABLED=true`; never put it in a Vite-prefixed/browser variable, source file, screenshot, log or chat. The operator switch is not itself proof of billing/upload authorization. The app also requires an explicit selected-file confirmation. The private cloning reference is not a transcription test fixture.

No live NEAR request was made for this slice. Fake-transport contract tests do not prove account access, billing, model availability or successful live inference. No per-minute cost is assumed; inspect current model pricing and actual usage before a permitted smoke test.

## Tool and restaurant boundaries

NEAR Responses currently supports client-managed custom function calls, not arbitrary server-executed remote MCP or `input_file`. Parse files locally and build an app-owned, read-only connector with explicit permissions. A model's function-call proposal and any tool output remain untrusted; neither grants permission to write a POS order, payroll entry, supplier purchase or wallet transaction.

Before connecting a real restaurant, resolve the provider, restaurant account owner, permitted fields, read/write scope, auth and retention. No POS brand/account is assumed. No uploaded command/script is executed. The MCP seam cannot be selected from a URL in a document. CLI command names are server-owned allowlist entries; do not broaden them into arbitrary shell access.

## Tokens and staking are separate

Text tokens are model billing units. NEAR is the blockchain asset. NEAR AI documents staking rewards funding inference credits through its staking-for-inference mechanism. This is not a separate restaurant token, live loyalty economy or guarantee of free compute. No wallet, staking, contract deployment or reward payout is connected here.

Coverage varies with stake, price, yield and fees. Actual lock/exit/credit-expiry terms for the chosen wallet route remain unverified. Do not promise immediate withdrawal, fixed APY, perpetual credits, capital safety or a particular amount needed. Restaurant incentives remain a proposal until their economic and permission design is reviewed.

## Sources

- https://docs.near.ai/api-reference/audio/audio-transcription-endpoint
- https://docs.near.ai/cloud/guides/specialized-endpoints
- https://docs.near.ai/cloud/guides/stateless-responses
- https://docs.near.ai/cloud/staking-for-inference/overview
- https://docs.near.ai/api-reference/models/list-models-with-pricing
- https://huggingface.co/kyutai/pocket-tts
- https://github.com/kyutai-labs/pocket-tts

## Optional local speech browser verification

The browser test defaults to no private voice runtime and no live NEAR calls. To verify your own authorized offline reference through the app, set `TEST_POCKET_PYTHON`, `TEST_POCKET_CONFIG`, and `TEST_POCKET_REFERENCE` to your private local paths before running it. Those paths and files must stay outside source control. It generates one short test sentence locally; no output is saved or uploaded. The test explicitly disables live NEAR inference even if the surrounding environment enabled it.
