import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { StepController } from "./engine/controller";
import { AudioNarrator, BrowserNarrator, MockNarrator } from "./engine/narrator";
(window as any).__AudioNarrator = AudioNarrator; // test hook only
import { loadHistory, recordVisit } from "./engine/history";
import type { Snapshot } from "./engine/types";
import "./style.css";
import { artifact, pages, steps } from "./fixture";
import { CharacterStage, type StageHandle } from "./ui/CharacterStage";

function historyReplace(id: string) { window.history.replaceState(null, "", "#" + id); }
function App() {
  const stage = useRef<StageHandle>(null);
  const [useBrowserVoice, setUseBrowserVoice] = useState(false);
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, pages.findIndex((p) => p.id === location.hash.slice(1))));
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [caption, setCaption] = useState("");
  const [history, setHistory] = useState(loadHistory());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState("");
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]); // release object URL on change/unmount
  const ctrl = useMemo(() => {
    const words = (i: number, text: string) => text.split(/\s+/).slice(0, i + 1).join(" ");
    let cur = "";
    const c = new StepController(steps, audioUrl ? new AudioNarrator(audioUrl) : useBrowserVoice ? new BrowserNarrator() : new MockNarrator(3.5), {
      walkTo: (s, sig) => { const i = steps.indexOf(s); setPageIndex(i); historyReplace(s.id); cur = s.narration; setCaption(audioUrl ? s.narration : ""); return stage.current!.walkTo(s, sig); },
      onWord: (i) => setCaption(words(i, cur)),
      onLevel: (l) => stage.current?.setMouthLevel(l),
    });
    return c;
  }, [useBrowserVoice, audioUrl]);
  useEffect(() => () => ctrl.stop(), [ctrl]);
  useEffect(() => { const onHash = () => { const i = pages.findIndex((p) => p.id === location.hash.slice(1)); if (i >= 0) { ctrl.stop(); setPageIndex(i); } }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, [ctrl]);
  const openPage = (i: number) => { ctrl.stop(); setPageIndex(i); setCaption(""); historyReplace(pages[i].id); };
  const page = pages[pageIndex];
  useEffect(() => { const un = ctrl.subscribe((s) => {
    setSnap(s); stage.current?.setTalking(s.phase === "speaking"); if (s.phase !== "speaking") stage.current?.setMouthLevel(null);
    if (s.phase === "speaking") setHistory(recordVisit({ id: artifact.id, artifactId: artifact.id, title: artifact.title, lastStep: s.index }));
  }); return () => { un(); }; }, [ctrl]);
  useEffect(() => { if (new URLSearchParams(location.search).get("autostart")) { const q = Number(new URLSearchParams(location.search).get("autostart")) - 1; setTimeout(() => ctrl.goTo(q), 300); } }, [ctrl]);
    return (
    <div className="layout">
      <main>
        <div className="head"><span className="brand" aria-hidden="true">SECRET SAUCE / DEMO</span><h1>{artifact.title}</h1></div>
        <p className="demo-warning">SYNTHETIC DATA ONLY. No real restaurant records, connected systems or verified confidential-computing protection. About 10 seconds of captions per page; silent by default.</p>
        <nav className="demo-nav" aria-label="Restaurant demo pages">{pages.map((p, i) => <a key={p.id} href={"#" + p.id} aria-current={pageIndex === i ? "page" : undefined} onClick={(e) => { e.preventDefault(); openPage(i); }}>{i + 1}. {p.title}</a>)}</nav>
        <section className="demo-page" aria-labelledby="demo-title" data-testid="demo-page">
          <p className="eyebrow">PAGE {pageIndex + 1} OF 4 / SYNTHETIC EXAMPLE</p><h2 id="demo-title">{page.title}</h2><p>{page.subtitle}</p>
          <dl>{page.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p>{page.takeaway}</p><p className="scope">{page.scope}</p>
          <button onClick={() => ctrl.goTo(pageIndex)}>Explain this page (~10s)</button>
        </section>
        <div className="stage">
          {steps.map((s, i) => (
            <div key={s.id} className={"pt" + (pageIndex === i ? " on" : "")} style={{ left: `${s.target.x * 100}%`, top: `${s.target.y * 100 - 14}%` }} aria-hidden="true">{i + 1}</div>
          ))}
          <CharacterStage ref={stage} />
        </div>
        <ol className="steps">{steps.map((s, i) => (<li key={s.id}><button className={pageIndex === i ? "cur" : ""} onClick={() => ctrl.goTo(i)}>{s.title}</button></li>))}</ol>
        <div className="caption" aria-live="polite" data-testid="caption">{caption || (snap?.phase === "walking" ? "(walking...)" : "")}</div>
        <div className="bar">
          <button onClick={() => ctrl.goTo(pageIndex - 1)} disabled={pageIndex === 0}>Back</button>
          <button className="cta" onClick={() => (snap?.phase === "idle" ? ctrl.goTo(pageIndex) : ctrl.goTo(pageIndex))}>{snap?.phase === "idle" ? "Start" : "Replay"}</button>
          <button onClick={() => ctrl.goTo(pageIndex + 1)} disabled={pageIndex === steps.length - 1}>Next</button>
          <button onClick={() => ctrl.stop()}>Stop</button>
          <label style={{ marginLeft: 16 }}>narration audio file (this device only, never uploaded) <input type="file" accept="audio/*" data-testid="audio-file" onChange={(e) => { ctrl.stop(); const f = e.target.files?.[0]; setAudioName(f?.name ?? ""); setAudioUrl(f ? URL.createObjectURL(f) : null); }} /></label>
          <label style={{ marginLeft: 16 }}><input type="checkbox" checked={useBrowserVoice} onChange={(e) => { ctrl.stop(); setUseBrowserVoice(e.target.checked); }} /> browser voice (may not be private)</label>
        </div>
        <p className="note" data-testid="status">Page {pageIndex + 1}/{steps.length}. Playback step {snap ? snap.index + 1 : 0}/{steps.length} - {snap?.phase}. Narration: {audioUrl ? "your local file " + audioName + " plays for every step (mouth follows its loudness; not generated voice)" : useBrowserVoice ? "browser voice" : "mock pacer (no audio; scripts average about 10s)"}. Character: recovered Cebollito GLB at public/character.glb (legs clip plays while walking; arms are posed in code from the skeleton to point at the step marker; mouth is a dark overlay shape that opens while speaking, not a morph in the model).</p>
      </main>
      <aside>
        <h3>History</h3>
        {history.length === 0 && <small>No walkthroughs yet</small>}
        {history.map((h) => (<div key={h.id} className="h"><button onClick={() => ctrl.goTo(h.lastStep)}>{h.title}</button><br /><small>{new Date(h.at).toLocaleTimeString()} - step {h.lastStep + 1}</small></div>))}
      </aside>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
