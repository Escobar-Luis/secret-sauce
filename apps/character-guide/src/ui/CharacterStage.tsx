import { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Step } from "../engine/types";

export interface StageHandle { walkTo(step: Step, signal: AbortSignal): Promise<void>; setTalking(on: boolean): void; setMouthLevel(level: number | null): void; }
const MOUTH = { x: 0.246, y: -0.147, z: 0.96, w: 0.5, h: 0.03 }; // located by raycasting the baked smile on cebollito7 // model-local, tuned by eye
const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const H = 6; const FEET_Y = -1.8, STAND = 1.1, EDGE = 1.6; // world height; world width = H * element aspect so shapes are never stretched

/** Placeholder "onion" character used when /character.glb is absent. Mock geometry, not Cebollito. */
function placeholder() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  body.scale.y = 1.25; body.position.y = 0.6; g.add(body);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  mouth.position.set(0, 0.75, 0.42); mouth.name = "mouth"; g.add(mouth);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  arm.geometry.translate(0, 0.25, 0); arm.position.set(0.42, 0.6, 0); arm.name = "arm"; g.add(arm);
  return g;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion();
function aim(b: THREE.Bone, from: THREE.Object3D, to: THREE.Object3D, dir: THREE.Vector3, amt: number) {
  from.getWorldPosition(_v); to.getWorldPosition(_w); _w.sub(_v).normalize();
  _q.setFromUnitVectors(_w, dir);
  if (amt < 1) _q.slerp(_p.identity(), 1 - amt);
  b.getWorldQuaternion(_p); _q.multiply(_p);
  (b.parent as THREE.Object3D).getWorldQuaternion(_p); _p.invert(); b.quaternion.copy(_p.multiply(_q));
}
/** The GLB's arm bones (Bone004-007) carry no vertex weights: the arms are baked into the body bone. This re-skins vertices near each arm segment to the arm bone so the arms can be posed in code. Runtime-only; the GLB file is unchanged. */
function reskinArms(mesh: THREE.SkinnedMesh, arms: { shoulder: THREE.Bone; tip: THREE.Bone }[]) {
  const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const sk = mesh.skeleton, rest = (b: THREE.Bone) => new THREE.Matrix4().copy(sk.boneInverses[sk.bones.indexOf(b)]).invert().premultiply(new THREE.Matrix4().copy(mesh.bindMatrix).invert());
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), AB = new THREE.Vector3(), AP = new THREE.Vector3(), C = new THREE.Vector3();
  let moved = 0;
  for (const arm of arms) {
    A.setFromMatrixPosition(rest(arm.shoulder)); B.setFromMatrixPosition(rest(arm.tip));
    const len = B.distanceTo(A); AB.subVectors(B, A).normalize(); const bi = sk.bones.indexOf(arm.shoulder);
    for (let v = 0; v < pos.count; v++) {
      P.fromBufferAttribute(pos, v); AP.subVectors(P, A); const t = AP.dot(AB);
      C.copy(AB).multiplyScalar(t); const d = AP.sub(C).length();
      if (t < -0.2 || t > len * 2.5 || d > 0.4 || sw.getX(v) < 0.99) continue;
      const w = Math.min(1, Math.max(0, (t + 0.2) / 0.2)); if (w < 0.02) continue;
      const body = si.getX(v);
      si.setXYZW(v, body, bi, 0, 0); sw.setXYZW(v, 1 - w, w, 0, 0); moved++;
    }
  }
  si.needsUpdate = true; sw.needsUpdate = true; return moved;
}
function poseRig(s: any, t: number, dt: number) {
  const r = s.rig; s.point += ((s.pointing ? 1 : 0) - s.point) * (1 - Math.exp(-dt * 8));
  s.root.updateMatrixWorld(true);
  const side = r.arms.slice().sort((a: any, b: any) => { a.shoulder.getWorldPosition(_v); b.shoulder.getWorldPosition(_w); return _v.x - _w.x; });
  if (s.point > 0.01 && side.length === 2) {
    const arm = s.markerWorld.x < s.pos.x ? side[0] : side[1];
    arm.shoulder.getWorldPosition(_v);
    const dir = s.markerWorld.clone().sub(_v).setZ(0).normalize(); dir.y += Math.sin(t * 5) * 0.04; dir.normalize();
    aim(arm.shoulder, arm.shoulder, arm.tip, dir, s.point);
    s.root.updateMatrixWorld(true);
  }
  if (r.mouth) { const open = s.level != null ? s.level * 0.1 : s.talking ? Math.abs(Math.sin(t * 13)) * 0.08 : 0; r.mouth.visible = s.talking; const b0 = r.mouth.userData.bs0 as THREE.Vector3; r.mouth.scale.set(b0.x * MOUTH.w, b0.y * (MOUTH.h + open), b0.z); }
}
export const CharacterStage = forwardRef<StageHandle, { glbUrl?: string }>(({ glbUrl = "/character.glb" }, ref) => {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef({ W: 10, pos: new THREE.Vector3(-3, FEET_Y, 0), talking: false, pointing: 0, walking: false, level: null as number | null, markerWorld: new THREE.Vector3(), rig: null as null | { arms: { shoulder: THREE.Bone; tip: THREE.Bone }[]; mouth: THREE.Mesh | null }, point: 0, actions: null as null | { setWalking(w: boolean): void }, root: new THREE.Group(), usingGlb: false });

  useImperativeHandle(ref, () => ({
    setTalking: (on) => { st.current.talking = on; },
    setMouthLevel: (l) => { st.current.level = l; },
    walkTo: (step, signal) => new Promise<void>((resolve, reject) => {
      const s = st.current;
      const mx = (step.target.x - 0.5) * s.W, my = (0.5 - (step.target.y - 0.14)) * H;
      s.markerWorld.set(mx, my, 0);
      const lim = Math.max(0, s.W / 2 - EDGE);
      const goal = new THREE.Vector3(Math.max(-lim, Math.min(lim, mx + (step.target.x < 0.5 ? STAND : -STAND))), FEET_Y, 0);
      s.walking = true; s.pointing = 0;
      let raf = 0;
      const onAbort = () => { cancelAnimationFrame(raf); s.walking = false; reject(new DOMException("aborted", "AbortError")); };
      const done = () => signal.removeEventListener("abort", onAbort);
      if (signal.aborted) return onAbort();
      const tick = () => {
        const d = goal.clone().sub(s.pos);
        if (reduced) s.pos.copy(goal), d.set(0, 0, 0);
        if (d.length() < 0.05) { s.walking = false; s.pointing = 1; done(); return resolve(); }
        s.pos.add(d.setLength(Math.min(0.06, d.length())));
        s.root.rotation.y = d.x >= 0 ? 0.4 : -0.4;
        raf = requestAnimationFrame(tick);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(tick);
    }),
  }));

  useEffect(() => {
    const el = host.current!; const s = st.current;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-5, 5, H / 2, -H / 2, 0.1, 50); cam.position.z = 10;
    const fit = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); s.W = H * (w / h); cam.left = -s.W / 2; cam.right = s.W / 2; cam.updateProjectionMatrix(); const l = Math.max(0, s.W / 2 - EDGE); s.pos.x = Math.max(-l, Math.min(l, s.pos.x)); };
    const ro = new ResizeObserver(fit); ro.observe(el); fit();
    scene.add(new THREE.AmbientLight(0xffffff, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2, 4, 6); scene.add(dl);
    s.root.add(placeholder()); scene.add(s.root);
    let mixer: THREE.AnimationMixer | null = null;
    let walkAction: THREE.AnimationAction | null = null;
    new GLTFLoader().load(glbUrl, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
      const k = 2.0 / Math.max(size.x, size.y, size.z); // fit ~2.0 world units tall regardless of export scale
      model.scale.setScalar(k); model.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      const holder = new THREE.Group(); holder.add(model); holder.add(new THREE.AmbientLight(0xffffff, 0.2));
      s.root.clear(); s.root.add(holder); s.usingGlb = true;
      const bone = (n: string) => model.getObjectByName(n) as THREE.Bone | undefined;
      const pairs = [["Bone004", "Bone005"], ["Bone006", "Bone007"]].map(([a, b]) => ({ shoulder: bone(a)!, tip: bone(b)! })).filter((p) => p.shoulder && p.tip);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false }));
      mouth.position.set(MOUTH.x, MOUTH.y + 0.03, MOUTH.z); mouth.scale.set(MOUTH.w, MOUTH.h, 1); mouth.renderOrder = 10; mouth.visible = false; model.add(mouth);
      // Follow the body: parent the overlay to the bone that skins the face vertices nearest the smile (keeps world transform).
      let bs0 = new THREE.Vector3(1, 1, 1);
      model.updateMatrixWorld(true);
      { let sm0: THREE.SkinnedMesh | undefined; model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sm0 = o as THREE.SkinnedMesh; });
        if (sm0) { const g = sm0.geometry, ps = g.attributes.position, si0 = g.attributes.skinIndex; let best = 1e9, bi = 0; const q = new THREE.Vector3(), tgt = new THREE.Vector3(MOUTH.x, MOUTH.y, MOUTH.z);
          for (let v = 0; v < ps.count; v++) { q.fromBufferAttribute(ps, v); const d = q.distanceTo(tgt); if (d < best) { best = d; bi = si0.getX(v); } }
          const bone0 = sm0.skeleton.bones[bi]; if (bone0) { bone0.attach(mouth); bs0 = mouth.scale.clone().divide(new THREE.Vector3(MOUTH.w, MOUTH.h, 1)); } } }
      mouth.userData.bs0 = bs0;
      let sm: THREE.SkinnedMesh | undefined; model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sm = o as THREE.SkinnedMesh; });
      if (sm) console.info('re-skinned arm vertices:', reskinArms(sm, pairs));
      s.rig = { arms: pairs, mouth };
      (window as any).__pac = { model, holder, THREE, s, cam, mouth };
      const clip = gltf.animations.find((a) => a.name === "legs") ?? gltf.animations[0];
      if (clip) { mixer = new THREE.AnimationMixer(model); walkAction = mixer.clipAction(clip); walkAction.play(); walkAction.paused = true; }
      s.actions = { setWalking: (w: boolean) => { if (walkAction) walkAction.paused = !w; } };
    }, undefined, () => { /* no GLB present: keep placeholder */ });
    const clock = new THREE.Clock(); let raf = 0;
    const loop = () => {
      const dt = clock.getDelta(); const t = clock.elapsedTime; mixer?.update(dt); if (s.rig) poseRig(s, t, dt); s.actions?.setWalking(s.walking);
      s.root.position.copy(s.pos); s.root.position.y += s.walking ? Math.abs(Math.sin(t * 10)) * 0.08 : 0;
      if (s.usingGlb) { // GLB has no arm/mouth keyframes: talking = body bob, pointing = lean (MOCK expressions)
        
      }
      if (!s.usingGlb) {
        const mouth = s.root.getObjectByName("mouth"); if (mouth) mouth.scale.y = s.talking ? 1 + Math.abs(Math.sin(t * 14)) * 5 : 1;
        const arm = s.root.getObjectByName("arm"); if (arm) arm.rotation.z = -(s.pointing ? 1.2 + Math.sin(t * 6) * 0.1 : 0.1);
      }
      renderer.render(scene, cam); raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, [glbUrl]);

  return <div ref={host} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
});
