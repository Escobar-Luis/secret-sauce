export interface Step { id: string; title: string; narration: string; target: { x: number; y: number }; }
export interface Narrator { speak(text: string, hooks: { onWord?: (i: number) => void; onLevel?: (level: number) => void; signal: AbortSignal }): Promise<void>; }
export type Phase = "idle" | "walking" | "speaking" | "done" | "interrupted";
export interface Snapshot { index: number; phase: Phase; step: Step; }
