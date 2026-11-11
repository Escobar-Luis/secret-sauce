export interface HistoryEntry { id: string; artifactId: string; title: string; at: string; lastStep: number; }
const KEY = "pac.history.v1";
export function loadHistory(store: Pick<Storage, "getItem"> = localStorage): HistoryEntry[] {
  try { return JSON.parse(store.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function recordVisit(e: Omit<HistoryEntry, "at">, store: Pick<Storage, "getItem" | "setItem"> = localStorage, now = new Date()) {
  const rest = loadHistory(store).filter((h) => h.id !== e.id);
  const next = [{ ...e, at: now.toISOString() }, ...rest].slice(0, 50);
  store.setItem(KEY, JSON.stringify(next)); return next;
}
