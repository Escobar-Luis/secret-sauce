import type { Step } from "./engine/types";
/** FIXTURE content (harmless, non-personal). Targets are stage coords 0..1 (x right, y down). */
export const artifact = { id: "private-ai-pipeline", title: "How a private voice character works (fixture)" };
export const steps: Step[] = [
  { id: "record", title: "1. Authorized recording", narration: "First, you record your own voice with permission. The recordings stay on your device and you keep the rights to them.", target: { x: 0.15, y: 0.3 } },
  { id: "model", title: "2. Open-weight speech model", narration: "Next, an open weight speech model learns from those recordings. You can back it up and move it, so you are not locked into one vendor.", target: { x: 0.4, y: 0.45 } },
  { id: "script", title: "3. Review the script", narration: "Then you write a script and approve it. Nothing is generated until you say so.", target: { x: 0.65, y: 0.3 } },
  { id: "listen", title: "4. Listen and approve", narration: "Finally you listen, edit, and approve the audio. Only then does it go out as a voice memo.", target: { x: 0.88, y: 0.45 } },
];
