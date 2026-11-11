import { describe, it, expect } from "vitest";
import { SceneClipNarrator } from "./scene-clips";
import type { Narrator } from "./types";

const scenes = [{id:"sales",narration:"sales script"},{id:"inventory",narration:"inventory script"}];
describe("per-scene local clips", () => {
  it("routes different scripts to different clips", async () => {
    const seen: string[]=[];
    const fallback: Narrator={speak:async()=>{seen.push("fallback");}};
    const n=new SceneClipNarrator(scenes,{sales:"blob:sales",inventory:"blob:inventory"},fallback,url=>({speak:async()=>{seen.push(url);}}));
    const hooks={signal:new AbortController().signal};
    await n.speak("sales script",hooks);await n.speak("inventory script",hooks);
    expect(seen).toEqual(["blob:sales","blob:inventory"]);
  });
  it("missing or unknown scripts use only explicit fallback", async()=>{
    let count=0;const n=new SceneClipNarrator(scenes,{}, {speak:async()=>{count++;}});
    await n.speak("sales script",{signal:new AbortController().signal});await n.speak("unknown",{signal:new AbortController().signal});expect(count).toBe(2);
  });
  it("passes cancellation and audio hooks through", async()=>{
    const signal=new AbortController().signal;const hooks={signal,onLevel:()=>{},onWord:()=>{}};let got:unknown;
    const n=new SceneClipNarrator(scenes,{sales:"blob:sales"},{speak:async()=>{}},()=>({speak:async(_t,h)=>{got=h;}}));await n.speak("sales script",hooks);expect(got).toBe(hooks);
  });
  it("does not swallow audio failure or silently change voices",async()=>{
    let fallback=false;const n=new SceneClipNarrator(scenes,{sales:"blob:sales"},{speak:async()=>{fallback=true;}},()=>({speak:async()=>{throw new Error("decode failed");}}));await expect(n.speak("sales script",{signal:new AbortController().signal})).rejects.toThrow("decode failed");expect(fallback).toBe(false);
  });
  it("rejects ambiguous duplicate narration",()=>{
    expect(()=>new SceneClipNarrator([{id:"a",narration:"same"},{id:"b",narration:"same"}],{},{speak:async()=>{}})).toThrow("unique");
  });
});
