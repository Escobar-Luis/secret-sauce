import type { Narrator } from "./types";
/** MOCK narrator: no audio. Paces text at a fixed words/sec so timing/cancellation can be tested. */
export class MockNarrator implements Narrator {
  constructor(private wordsPerSec = 3.5) {}
  speak(text: string, { onWord, signal }: { onWord?: (i: number) => void; signal: AbortSignal }) {
    const words = text.split(/\s+/).filter(Boolean);
    return new Promise<void>((resolve, reject) => {
      let i = 0;
      const abort = () => { clearInterval(t); reject(new DOMException("aborted", "AbortError")); };
      const t = setInterval(() => { const k = i++; onWord?.(k); if (i >= words.length) { clearInterval(t); signal.removeEventListener("abort", abort); resolve(); } }, 1000 / this.wordsPerSec);
      if (signal.aborted) return abort();
      signal.addEventListener("abort", abort, { once: true });
    });
  }
}
/** Browser built-in speechSynthesis. Not private/offline-guaranteed, voice varies by device; opt-in only. */
export class BrowserNarrator implements Narrator {
  speak(text: string, { onWord, signal }: { onWord?: (i: number) => void; signal: AbortSignal }) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
      const u = new SpeechSynthesisUtterance(text);
      let w = 0;
      const onAbort = () => { speechSynthesis.cancel(); reject(new DOMException("aborted", "AbortError")); };
      const clean = () => signal.removeEventListener("abort", onAbort);
      u.onboundary = (e) => { if (e.name === "word") onWord?.(w++); };
      u.onend = () => { clean(); resolve(); };
      u.onerror = (e) => (clean(), e.error === "canceled" || e.error === "interrupted" ? reject(new DOMException("aborted", "AbortError")) : reject(e));
      signal.addEventListener("abort", onAbort, { once: true });
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
  }
}

/** Plays a local audio URL and reports loudness 0..1 each frame via onLevel (drives the mouth). No upload, no network beyond the URL given. */
export class AudioNarrator implements Narrator {
  constructor(private url: string) {}
  async speak(_text: string, { onLevel, signal }: { onWord?: (i: number) => void; onLevel?: (level: number) => void; signal: AbortSignal }) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const audio = new Audio(this.url); const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaElementSource(audio).connect(an); an.connect(ctx.destination);
    const buf = new Uint8Array(an.fftSize); let raf = 0;
    const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2; onLevel?.(Math.min(1, Math.sqrt(sum / buf.length) * 4)); raf = requestAnimationFrame(tick); };
    const stop = () => { cancelAnimationFrame(raf); onLevel?.(0); audio.pause(); void ctx.close(); };
    await new Promise<void>((resolve, reject) => {
      signal.addEventListener("abort", () => { stop(); reject(new DOMException("aborted", "AbortError")); }, { once: true });
      audio.onended = () => { stop(); resolve(); }; audio.onerror = () => { stop(); reject(new Error("audio failed")); };
      audio.play().then(() => tick(), (e) => { stop(); reject(e); });
    });
  }
}
