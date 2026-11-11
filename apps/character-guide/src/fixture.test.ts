import { describe, it, expect } from "vitest";
import { pages, steps } from "./fixture";
describe("restaurant demos", () => {
  it("has four distinct pages with matching narration and stable links", () => {
    expect(pages.length).toBe(4); expect(new Set(pages.map(p => p.id)).size).toBe(4);
    expect(steps.map(s => s.id)).toEqual(pages.map(p => p.id));
  });
  it("averages about ten seconds at the default 3.5 words per second", () => {
    const seconds = steps.map(s => s.narration.split(/\s+/).length / 3.5);
    expect(seconds.every(t => t >= 8 && t <= 12)).toBe(true);
    expect(seconds.reduce((a,b) => a+b) / 4).toBeGreaterThanOrEqual(9.5);
    expect(seconds.reduce((a,b) => a+b) / 4).toBeLessThanOrEqual(10.5);
  });
  it("labels invented data and retains effect limits", () => {
    expect(steps.every(s => /invented|synthetic/.test(s.narration))).toBe(true);
    expect(pages.every(p => p.scope.length > 40 && p.rows.length === 3)).toBe(true);
  });
});
