import type { Narrator, Phase, Snapshot, Step } from "./types";
export interface Hooks { walkTo(step: Step, signal: AbortSignal): Promise<void>; onWord?(i: number): void; onLevel?(level: number): void; }
type Listener = (s: Snapshot) => void;
export class StepController {
  private index = 0; private phase: Phase = "idle"; private ctl: AbortController | null = null; private run = 0;
  private listeners = new Set<Listener>();
  constructor(private steps: Step[], private narrator: Narrator, private hooks: Hooks) {
    if (!steps.length) throw new Error("no steps");
  }
  subscribe(l: Listener) { this.listeners.add(l); l(this.snapshot()); return () => this.listeners.delete(l); }
  snapshot(): Snapshot { return { index: this.index, phase: this.phase, step: this.steps[this.index] }; }
  private emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
  /** Stop any in-flight walk/speech, then play step i. Stale runs never touch state. */
  async goTo(i: number) {
    const idx = Math.max(0, Math.min(this.steps.length - 1, i));
    this.ctl?.abort();
    const ctl = (this.ctl = new AbortController()); const my = ++this.run;
    this.index = idx; this.phase = "walking"; this.emit();
    const step = this.steps[idx];
    try {
      await this.hooks.walkTo(step, ctl.signal);
      if (my !== this.run) return;
      this.phase = "speaking"; this.emit();
      await this.narrator.speak(step.narration, { onWord: this.hooks.onWord, onLevel: this.hooks.onLevel, signal: ctl.signal });
      if (my !== this.run) return;
      this.phase = "done"; this.emit();
    } catch (e) {
      if ((e as Error).name !== "AbortError") throw e;
      if (my === this.run) { this.phase = "interrupted"; this.emit(); }
    }
  }
  next() { return this.goTo(this.index + 1); }
  prev() { return this.goTo(this.index - 1); }
  replay() { return this.goTo(this.index); }
  stop() { this.ctl?.abort(); }
}
