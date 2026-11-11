import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { StepController } from "./engine/controller";
import { AudioNarrator, BrowserNarrator, MockNarrator } from "./engine/narrator";
import { SceneClipNarrator } from "./engine/scene-clips";
(window as any).__AudioNarrator = AudioNarrator; // test hook only
import { loadHistory, recordVisit } from "./engine/history";
import type { Snapshot } from "./engine/types";
import "./style.css";
import { RestaurantChat } from "./ui/RestaurantChat";
import { SensitiveGraph } from "./ui/SensitiveGraph";
import { artifact, pages, steps } from "./fixture";
import { CharacterStage, type StageHandle } from "./ui/CharacterStage";

function historyReplace(id: string) { window.history.replaceState(null, "", "#" + id); }
function WalkthroughApp() {
  const stage = useRef<StageHandle>(null);
  const [useBrowserVoice, setUseBrowserVoice] = useState(false);
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, pages.findIndex((p) => p.id === location.hash.slice(1))));
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [caption, setCaption] = useState("");
  const [history, setHistory] = useState(loadHistory());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState("");
  const [sceneClips, setSceneClips] = useState<Record<string, { url: string; name: string }>>({});
  const clipRefs = useRef<Record<string, { url: string; name: string }>>({});
  const [clipError, setClipError] = useState("");
  useEffect(() => () => { for (const clip of Object.values(clipRefs.current)) URL.revokeObjectURL(clip.url); }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]); // release object URL on change/unmount
  const ctrl = useMemo(() => {
    const words = (i: number, text: string) => text.split(/\s+/).slice(0, i + 1).join(" ");
    let cur = "";
    const fallback = audioUrl ? new AudioNarrator(audioUrl) : useBrowserVoice ? new BrowserNarrator() : new MockNarrator(3.5);
    const narrator = new SceneClipNarrator(steps, Object.fromEntries(Object.entries(sceneClips).map(([id, clip]) => [id, clip.url])), fallback, url => ({ speak: async (text, hooks) => {
      try { await new AudioNarrator(url).speak(text, hooks); }
      catch (error) { if ((error as Error).name !== "AbortError") { setClipError("This page clip could not play. Replace or clear it, then try again. No different voice was started."); throw new DOMException("clip playback failed", "AbortError"); } throw error; }
    } }));
    const c = new StepController(steps, narrator, {
      walkTo: (s, sig) => { const i = steps.indexOf(s); setPageIndex(i); historyReplace(s.id); cur = s.narration; setCaption(sceneClips[s.id] || audioUrl ? s.narration : ""); return stage.current!.walkTo(s, sig); },
      onWord: (i) => setCaption(words(i, cur)),
      onLevel: (l) => stage.current?.setMouthLevel(l),
    });
    return c;
  }, [useBrowserVoice, audioUrl, sceneClips]);
  useEffect(() => () => ctrl.stop(), [ctrl]);
  useEffect(() => { const onHash = () => { const i = pages.findIndex((p) => p.id === location.hash.slice(1)); if (i >= 0) { ctrl.stop(); setPageIndex(i); } }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, [ctrl]);
  const openPage = (i: number) => { ctrl.stop(); setPageIndex(i); setCaption(""); historyReplace(pages[i].id); };
  const page = pages[pageIndex];
  const replaceClip = (id: string, file?: File) => {
    ctrl.stop(); setClipError("");
    if (file && (!file.type.startsWith("audio/") || file.size === 0 || file.size > 50_000_000)) { setClipError("Choose a nonempty audio file under 50 MB. No file was loaded."); return; }
    const next = { ...clipRefs.current };
    if (next[id]) URL.revokeObjectURL(next[id].url);
    if (file) next[id] = { url: URL.createObjectURL(file), name: file.name }; else delete next[id];
    clipRefs.current = next; setSceneClips(next);
  };
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
          <button onClick={() => ctrl.goTo(pageIndex)}>Explain this page{sceneClips[page.id] || audioUrl || useBrowserVoice ? " (audio duration varies)" : " (~10s)"}</button>
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
          <label style={{ marginLeft: 16 }}>fallback audio file for missing page clips (this device only, never uploaded) <input type="file" accept="audio/*" data-testid="audio-file" onChange={(e) => { ctrl.stop(); const f = e.target.files?.[0]; setAudioName(f?.name ?? ""); setAudioUrl(f ? URL.createObjectURL(f) : null); }} /></label>
          <label style={{ marginLeft: 16 }}><input type="checkbox" checked={useBrowserVoice} onChange={(e) => { ctrl.stop(); setUseBrowserVoice(e.target.checked); }} /> fallback browser voice (may not be private)</label>
        </div>
        <fieldset className="scene-clips">
          <legend>Per-page narration clips (this device only)</legend>
          <p>Use a natural stock voice or your own approved recordings. No voice model is included and nothing is uploaded. Missing clips use the selected fallback below; silent captions are the default. Audio duration follows each recording, not the 10-second caption timer.</p>
          {pages.map(p => <div key={p.id}><label>{p.title} clip <input type="file" accept="audio/*" data-testid={"scene-audio-" + p.id} onChange={e => replaceClip(p.id, e.target.files?.[0])} /></label><span data-testid={"clip-status-" + p.id}>{sceneClips[p.id]?.name || "No clip - fallback"}</span><button disabled={!sceneClips[p.id]} onClick={() => replaceClip(p.id)}>Clear {p.title} clip</button></div>)}
          {clipError && <p role="alert">{clipError}</p>}
        </fieldset>
        <p className="note" data-testid="status">Page {pageIndex + 1}/{steps.length}. Playback step {snap ? snap.index + 1 : 0}/{steps.length} - {snap?.phase}. Narration: {sceneClips[page.id] ? "local page clip: " + sceneClips[page.id].name + " (not generated voice)" : audioUrl ? "your local file " + audioName + " (same clip for pages without their own)" : useBrowserVoice ? "fallback browser voice (may use a service)" : "mock pacer fallback (no audio; ~10s captions); no generated voice"}. Character: recovered Cebollito GLB at public/character.glb (legs clip plays while walking; arms are posed in code from the skeleton to point at the step marker; mouth is a dark overlay shape that opens while speaking, not a morph in the model).</p>
        <RestaurantChat onTalking={v=>{if(v)ctrl.stop();stage.current?.setTalking(v);}} onLevel={v=>stage.current?.setMouthLevel(v)} />
      </main>
      <aside>
        <h3>History</h3>
        {history.length === 0 && <small>No walkthroughs yet</small>}
        {history.map((h) => (<div key={h.id} className="h"><button onClick={() => ctrl.goTo(h.lastStep)}>{h.title}</button><br /><small>{new Date(h.at).toLocaleTimeString()} - step {h.lastStep + 1}</small></div>))}
      </aside>
    </div>
  );
}
function App(){const [graph,setGraph]=useState(location.hash==='#sensitive-data');return <><nav className="app-pages" aria-label="App pages"><button aria-current={!graph?'page':undefined} onClick={()=>{setGraph(false);history.replaceState(null,'','#sales');}}>Restaurant walkthrough</button><button aria-current={graph?'page':undefined} onClick={()=>{setGraph(true);history.replaceState(null,'','#sensitive-data');}}>Sensitive-data graph</button></nav>{graph?<SensitiveGraph/>:<WalkthroughApp/>}</>;}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
