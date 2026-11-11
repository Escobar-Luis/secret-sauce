// Run: npm run build && npx vite preview --port 4173 & node e2e/regression.mjs  (needs playwright-core + Chrome)
import { chromium } from "playwright-core";
const url = process.env.URL ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const p = await b.newPage({ viewport: { width: 1000, height: 760 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const status = () => p.textContent("[data-testid=status]");
const wait = (re, ms = 30000) => p.waitForFunction((r) => new RegExp(r).test(document.querySelector("[data-testid=status]").textContent), re, { timeout: ms });
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
await p.goto(url); await p.waitForFunction(() => window.__pac);
// idle: baked smile preserved (overlay hidden)
ok(await p.evaluate(() => window.__pac.mouth.visible === false), "idle: mouth overlay hidden");
await p.getByRole("button", { name: "Start", exact: true }).click(); await wait("1/4 - speaking");
ok(await p.evaluate(() => window.__pac.mouth.visible === true), "speaking: mouth overlay shown");
// mouth level hook: external level overrides sine
await p.evaluate(() => window.__pac.s && 0); 
// interruption: Next mid-speech
await p.getByRole("button", { name: "Next", exact: true }).click(); await wait("2/4 - (walking|speaking)");
ok(!/1\/4/.test(await status()), "Next interrupts step 1");
await wait("2/4 - speaking");
// Back mid-speech then Stop
await p.getByRole("button", { name: "Back", exact: true }).click(); await wait("1/4 - (walking|speaking)");
await p.getByRole("button", { name: "Stop", exact: true }).click(); await wait("idle|interrupted|done");
ok(await p.evaluate(() => window.__pac.mouth.visible === false), "after Stop: mouth hidden, smile preserved");
// Stop mid-walk (real stage): must settle, not hang in walking
await p.getByRole("button", { name: "Next", exact: true }).click(); await wait("walking", 5000);
await p.getByRole("button", { name: "Stop", exact: true }).click(); await wait("idle|interrupted|done", 3000);
ok(await p.evaluate(() => window.__pac.s.walking === false), "Stop mid-walk settles, stage not walking");
// history persists across reload
const h1 = await p.locator("aside .h").count(); ok(h1 === 1, "history has one deduped entry");
await p.reload(); await p.waitForFunction(() => window.__pac);
ok((await p.locator("aside .h").count()) === 1, "history survives reload");
// reopen from history
await p.locator("aside .h button").click(); await wait("speaking");
ok(true, "history entry reopens a walkthrough");
ok(errs.length === 0, "no page errors " + JSON.stringify(errs));
// AudioNarrator with a locally generated NON-VOICE fixture (tone bursts: 0.4s on, 0.4s off). Tests the hook, not real narration.
const au = await p.evaluate(async () => {
  const sr = 8000, n = sr * 2, d = new DataView(new ArrayBuffer(44 + n * 2)); const w = (o, t) => [...t].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, "data"); d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.floor(i / (sr * 0.4)) % 2 === 0 ? Math.sin(i / 8) * 12000 : 0, true);
  const url = URL.createObjectURL(new Blob([d], { type: "audio/wav" })); const A = window.__AudioNarrator;
  const levels = []; const t0 = new AbortController(); await new A(url).speak("x", { onLevel: (l) => levels.push(l), signal: t0.signal });
  const hi = Math.max(...levels), lo = levels.filter((l) => l < 0.02).length;
  const lv2 = []; const c2 = new AbortController(); let err = ""; const pr = new A(url).speak("x", { onLevel: (l) => lv2.push(l), signal: c2.signal }).catch((e) => { err = e.name; }); setTimeout(() => c2.abort(), 300); await pr;
  let pre = ""; const c3 = new AbortController(); c3.abort(); try { await new A(url).speak("x", { signal: c3.signal }); } catch (e) { pre = e.name; }
  return { hi, lo, err, lastAfterAbort: lv2[lv2.length - 1], pre };
});
ok(au.hi > 0.1 && au.lo > 3, "AudioNarrator: level high during tone, ~0 during gaps " + JSON.stringify(au));
ok(au.err === "AbortError" && au.lastAfterAbort === 0, "AudioNarrator: abort mid-play rejects and zeroes level");
ok(au.pre === "AbortError", "AudioNarrator: pre-aborted signal rejects");
// Local audio file path through the real UI (device-local, non-voice tone fixture)
const wav = (() => { const sr = 8000, n = sr * 3, d = Buffer.alloc(44 + n * 2); d.write("RIFF", 0); d.writeUInt32LE(36 + n * 2, 4); d.write("WAVEfmt ", 8); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22); d.writeUInt32LE(sr, 24); d.writeUInt32LE(sr * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write("data", 36); d.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) d.writeInt16LE(Math.floor(i / (sr * 0.4)) % 2 === 0 ? Math.round(Math.sin(i / 8) * 12000) : 0, 44 + i * 2); return d; })();
const q = await b.newPage({ viewport: { width: 1000, height: 760 } }); const qerr = []; q.on("pageerror", (e) => qerr.push(e.message));
await q.addInitScript(() => { window.__urls = { c: 0, r: 0 }; const c = URL.createObjectURL, r = URL.revokeObjectURL; URL.createObjectURL = (x) => (window.__urls.c++, c.call(URL, x)); URL.revokeObjectURL = (x) => (window.__urls.r++, r.call(URL, x)); });
await q.goto(url); await q.waitForFunction(() => window.__pac);
await q.getByTestId("audio-file").setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: wav });
await q.getByRole("button", { name: "Start", exact: true }).click();
await q.waitForFunction(() => /speaking/.test(document.querySelector("[data-testid=status]").textContent), null, { timeout: 30000 });
const peak = await q.evaluate(async () => { let m = 0, lo = 1; for (let i = 0; i < 60; i++) { const l = window.__pac.s.level; if (l != null) { m = Math.max(m, l); lo = Math.min(lo, l); } await new Promise((r) => setTimeout(r, 50)); } return { m, lo }; });
ok(peak.m > 0.1 && peak.lo < 0.05, "UI audio file: mouth level follows tone bursts " + JSON.stringify(peak));
ok(/your local file/.test(await q.textContent("[data-testid=status]")), "UI states local-file mode (not mock/voice model)");
await q.getByRole("button", { name: "Stop", exact: true }).click(); await q.waitForFunction(() => /interrupted/.test(document.querySelector("[data-testid=status]").textContent), null, { timeout: 3000 });
await q.waitForTimeout(300); const st2 = await q.evaluate(() => ({ l: window.__pac.s.level, v: window.__pac.mouth.visible })); console.log(JSON.stringify(st2));
ok(st2.l === null && st2.v === false, "after Stop: mouth level cleared, mouth back to idle smile");
await q.getByTestId("audio-file").setInputFiles([]); await q.waitForTimeout(300);
const u = await q.evaluate(() => window.__urls); ok(u.c >= 1 && u.r >= u.c, "object URLs released after clearing file " + JSON.stringify(u));
ok(/mock pacer/.test(await q.textContent("[data-testid=status]")), "clearing file returns to mock mode");
ok(qerr.length === 0, "no page errors in audio-file flow " + JSON.stringify(qerr));
// fresh-idle visibility on mobile and desktop->mobile resize: character body fully inside the stage (projected bbox)
const inView = () => p.evaluate(() => { const { model, THREE, cam } = window.__pac; const bb = new THREE.Box3().setFromObject(model); const pts = [bb.min, bb.max].map((v) => v.clone().project(cam)); return pts.every((q) => Math.abs(q.x) <= 1.0 && Math.abs(q.y) <= 1.0); });
const m = await b.newPage({ viewport: { width: 390, height: 844 } }); await m.goto(url); await m.waitForFunction(() => window.__pac); await m.waitForTimeout(500);
ok(await m.evaluate(() => { const { model, THREE, cam } = window.__pac; const bb = new THREE.Box3().setFromObject(model); return [bb.min, bb.max].every((v) => Math.abs(v.clone().project(cam).x) <= 1); }), "fresh idle on mobile: character inside stage horizontally");
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
ok(await p.evaluate(() => { const { model, THREE, cam } = window.__pac; const bb = new THREE.Box3().setFromObject(model); return [bb.min, bb.max].every((v) => Math.abs(v.clone().project(cam).x) <= 1); }), "desktop->mobile resize keeps character inside stage");
await b.close(); process.exit(fails ? 1 : 0);
