# Secret Sauce character walkthrough prototype

A local React/TypeScript walkthrough page with the Cebollito character, numbered steps, Back/Next/Replay/Stop, captions and browser-local history. The monochrome layout uses the current NWF style as its starting point.

## Run privately on your computer

With Node.js 22.12+ installed, clone this private repository and check out the character-prototype branch, then:

```sh
cd apps/character-guide
npm ci
npm run dev -- --host 127.0.0.1
```

Open the localhost URL printed by Vite. Do not expose the development server to the internet. No API keys, model account or database are needed. The source is in a private repository; no hosted app has been deployed.

```sh
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

For real-browser regressions, run a preview server in one terminal after the build:

```sh
npx vite preview --host 127.0.0.1 --port 4173
```

Then in another terminal, run `npm run e2e`. This uses `playwright-core` and an installed Chrome. Set `CHROME` to your Chrome executable path if it is not `/usr/bin/google-chrome`.

## Four restaurant demo pages

Open `#sales`, `#inventory`, `#staffing` or `#suppliers` after the localhost URL, or use the page navigation. Each page has synthetic sample figures, its own explanation and explicit limits. No real restaurant, guest, employee or supplier records are included. The four scripts average about 10 seconds in the default silent caption mode at 3.5 words per second. Walking is additional; browser speech and chosen audio follow their own duration. Click "Explain this page" to play, or use Next/Back/Replay/Stop. Nothing auto-advances or changes business systems.

After starting a built preview, `URL=http://localhost:4173/ node e2e/demos.mjs` checks all four direct links, measured caption timing, navigation and narrow layouts.

## Audio and privacy

The default narrator is a silent timing fixture, not generated speech. The local audio chooser plays an audio file from your device through a temporary browser blob URL, without uploading it. The same clip plays on every step. Captions show the full step text; there is no word alignment. Clear the selected audio to return to the silent fixture.

Browser voice is separately opt-in and may use an external service depending on your browser and installed voice. Do not enable it for private content unless you accept that browser's behavior.

## Character and limits

`public/character.glb` is the provided Cebollito7 model. SHA256: `c31c43cce8b1b5b1c973e055d3145fa9683c35f147791381ceb72e345b6f0565`.

The legs clip plays while walking. Arm vertices are re-skinned at runtime so the arms can point; the source GLB is unchanged. The mouth is a crude dark overlay parented to the face bone. Audio loudness drives its opening, not phonemes or real lip sync. It can leave a thin line during silence and disappears on Stop.

This is a functional prototype with fixture content, not an own-voice training/generation system or an app connected to your other work apps. No voice cloning, recording upload, model calls, paid service, shared history backend or private hosting is included. Real speech, Safari and long audio remain untested. History is stored in this browser's localStorage only.

## Integration boundary

This is a self-contained character-guide UI prototype added alongside the existing Secret Sauce bootstrap. The four restaurant demo pages use synthetic sales, inventory, staffing and supplier-cost fixtures, not real private restaurant data or an implemented restaurant assistant. The existing project README, environment template and hackathon setup are unchanged. Connecting restaurant data, a server-side AI service, per-step narration and private hosted delivery are separate work. No API key is read or used by this prototype.
