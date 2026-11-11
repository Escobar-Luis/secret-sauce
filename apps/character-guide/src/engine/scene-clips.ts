import type { Narrator } from "./types";
import { AudioNarrator } from "./narrator";

/** Per-scene local recording playback. Missing clips use an explicit fallback.
 * URLs come only from device file selections in the UI, never a provider call.
 * Text matching keeps the existing Narrator/controller contract unchanged.
 */
export class SceneClipNarrator implements Narrator {
  constructor(
    private scenes: readonly { id: string; narration: string }[],
    private urls: Readonly<Record<string, string>>,
    private fallback: Narrator,
    private makeAudio: (url: string) => Narrator = (url) => new AudioNarrator(url),
  ) {
    if (new Set(scenes.map(s => s.narration)).size !== scenes.length) throw new Error("Scene narration must be unique");
  }
  speak(text: string, hooks: Parameters<Narrator["speak"]>[1]) {
    const scene = this.scenes.find(s => s.narration === text);
    const url = scene ? this.urls[scene.id] : undefined;
    return (url ? this.makeAudio(url) : this.fallback).speak(text, hooks);
  }
}
