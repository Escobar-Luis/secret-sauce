import { describe, it, expect } from "vitest";
import { StepController } from "./controller";
import { MockNarrator } from "./narrator";
import { recordVisit, loadHistory } from "./history";
const steps = [0, 1, 2].map((i) => ({ id: "s" + i, title: "T" + i, narration: "one two three", target: { x: i, y: 0 } }));
const mk = () => { const walks: number[] = []; const c = new StepController(steps, new MockNarrator(1000), { walkTo: async (s) => { walks.push(s.target.x); } }); return { c, walks }; };
describe("StepController", () => {
  it("plays a step to done", async () => { const { c } = mk(); await c.goTo(0); expect(c.snapshot().phase).toBe("done"); });
  it("clamps next/prev", async () => { const { c } = mk(); await c.prev(); expect(c.snapshot().index).toBe(0); await c.goTo(2); await c.next(); expect(c.snapshot().index).toBe(2); });
  it("going forward interrupts old speech; stale run does not overwrite state", async () => {
    const { c } = mk(); const seen: string[] = [];
    c.subscribe((s) => seen.push(`${s.index}:${s.phase}`));
    const a = c.goTo(0); const b = c.goTo(1); await Promise.all([a, b]);
    expect(c.snapshot()).toMatchObject({ index: 1, phase: "done" });
    expect(seen).not.toContain("0:done");
  });
  it("stop() marks interrupted", async () => { const slow = new StepController(steps, new MockNarrator(1), { walkTo: async () => {} }); const p = slow.goTo(0); await new Promise((r) => setTimeout(r, 10)); slow.stop(); await p; expect(slow.snapshot().phase).toBe("interrupted"); });
});
describe("history", () => {
  it("dedupes and orders newest first", () => {
    const m = new Map<string, string>(); const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    recordVisit({ id: "a", artifactId: "x", title: "A", lastStep: 0 }, st); recordVisit({ id: "b", artifactId: "x", title: "B", lastStep: 1 }, st); recordVisit({ id: "a", artifactId: "x", title: "A", lastStep: 2 }, st);
    expect(loadHistory(st).map((h) => h.id)).toEqual(["a", "b"]);
  });
});
