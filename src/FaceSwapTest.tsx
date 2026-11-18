// FaceSwapTest v2 (TEST ONLY, 2026-11-18): 4.0 s = 120 frames, 30 fps, 1080x1920, silent. Imports kit modules only, changes nothing in the kit, STYLE_NOTES or any video.
// The troll SVG REPLACES THE WHOLE HEAD (own outline and shape). Frames 0-30 rage_ffuuu, 30-60 smug_pleased, 60-90 crying, 90-120 the ORIGINAL head (3D flat cap + short hair) comes back with the same pop.
// How the head is hidden without touching the kit: the torso card is drawn with a BLANK troll (`BLANK`, a 1x1 transparent face) so drawRick skips the head art; the 3D cap + hair (`HeadGear`) are hidden (group.visible) while a troll face is on.
// The head (troll art, or the original head art from the kit's drawHead) is drawn into ONE overlay canvas on a plane in the same pivot chain HeadGear uses (head position incl. body bounce, roll, pitch affine, yaw shift / squeeze).
// POP: whole head (overlay + cap + hair) scaled about the NECK point: 70 % -> 125 % in 0.1 s (ease-out), then a damped spring to exactly 100 % at 0.35 s. Head squash / stretch (parent scale about the neck) and a small body bounce come from the same curve.
// SIZE: the troll art's head shape (white_bg bounding box) is scaled to TROLL_K = 1.04 x the original head height, bottom on the original head bottom (+2 %), centred on the head axis.
// Camera: ONE medium shot (head + upper body), straight push-in 12 % with an S-curve (easeS), head circle inside SAFE_BOX (checked at setup, console "[faceswap]").
// PALETTE (5 hues): teal #2aa7ad / deep teal #176b80 (wall), indigo #2a2a6e, coral #e5604d (cap), mustard #f0b03c, cream #fff0c8 (light). Estimates, untested vs a reference: pop timing and amounts (70 / 125 / 100 % and 0.35 s were given), squash and bounce amounts.
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {Composition, useDelayRender, useRemotionEnvironment} from 'remotion';
import {useThree} from '@react-three/fiber';
import {EffectComposer, ToneMapping} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {CamFn, Pose, ShotSpec, SingleCanvasVideo, V3, makeTex, shared} from './kit/kit';
import {SHAPES} from './kit/data/shapes';
import {Bounce, CX, GROUND, Kind, REST, Rick, RickPose, build, cardTilt, clampPitch, drawHead, headCard, headPts, headYaw, pitchAffine, solve, wrapAng, yawTo} from './kit/rickRig';
import type {ReactionDraw, ReactionFace} from './kit/reactionFace';
import {GearSpec, HeadGear} from './kit/headgear';
import {SAFE_BOX, easeS} from './kit/camera';
import {Glow} from './kit/finish';
import {PXM} from './kit/rickRig';
import rageUrl from '../characters/faces/rage_ffuuu.svg';
import smugUrl from '../characters/faces/smug_pleased.svg';
import cryUrl from '../characters/faces/crying.svg';

export const FS_FPS = 30;
export const FS_FRAMES = 120;
const FACE_SEC = 1.0, N_TROLL = 3;
const FACES = [
  {name: 'rage_ffuuu', url: rageUrl, pitch: -0.08, roll: 0.0, yaw: -0.1},
  {name: 'smug_pleased', url: smugUrl, pitch: 0.08, roll: -0.07, yaw: 0.14},
  {name: 'crying', url: cryUrl, pitch: -0.1, roll: 0.06, yaw: 0.0},
  {name: 'original', url: '', pitch: 0.0, roll: 0.0, yaw: 0.06},
] as const;
const TROLL_K = 1.04;

// ---------------------------------------------------------------- the character (the data registerRole would write; person.tsx is not imported)
const KIND = 'c90' as Kind;
const HEAD = {idx: 6, flip: false, sx: 1.0}, BODY = {idx: 1, flip: false, sx: 0.95}, RY = 116;
const GEAR: GearSpec = {hair: {kind: 'short', color: '#5A3A22', male: true}, hat: {kind: 'flatcap', color: '#e5604d', band: '#8a2f2a', trim: 'button', trimColor: '#f0b03c'}};
{
  const b = build(KIND);
  Object.assign(b, {gear: 'bald', outfit: 'plain', faceDy: 0, ry: RY, cy: 330 - RY, hs: HEAD, bs: BODY, persona: 'm', facial: undefined});
  b.rx = Math.round(SHAPES.heads[HEAD.idx].aspect * HEAD.sx * RY * 10) / 10;
  b.tw = Math.round(SHAPES.bodies[BODY.idx].aspect * BODY.sx * b.th);
  b.tr = Math.min(72, Math.round(b.tw * 0.32));
}
const S0 = 0.9, KM = PXM * S0; // scale, metres per card px
const HEAD_PTS = headPts(KIND);
const HEAD_W = Math.max(...HEAD_PTS.map((q) => q[0])) - Math.min(...HEAD_PTS.map((q) => q[0]));
const HEAD_H = Math.max(...HEAD_PTS.map((q) => q[1])) - Math.min(...HEAD_PTS.map((q) => q[1]));
const HEAD_BOTTOM = Math.max(...HEAD_PTS.map((q) => q[1])); // y down, relative to the head centre
const HEAD_C_Y = (GROUND - build(KIND).cy) * KM; // head centre height (m)
const NECK_Y = (GROUND - (build(KIND).cy + RY)) * KM; // squash pivot (m)
const HEAD_R = 0.25; // metres, head + cap circle for the safe-area check

// the blank face that makes drawRick skip the head art (it draws bg / lines / eyes of the face it is given: all transparent, 1x1)
const BLANK: ReactionDraw = (() => { const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const f: ReactionFace = {name: 'blank', vbW: 1, vbH: 1, bg: cv, lines: cv, eyes: [{cv, cx: 0, cy: 0}, {cv, cx: 0, cy: 0}]}; return {face: f, scale: 1, blink: 0, flip: false, tint: null, tintK: 0}; })();

// ---------------------------------------------------------------- troll art (CPU canvases, rasterized once)
interface FaceArt { name: string; cv: HTMLCanvasElement; bx0: number; bx1: number; by1: number; bgW: number; bgH: number }
const RS = 5; // raster px per SVG unit
const ART = new Map<string, Promise<FaceArt>>();

async function loadFace(name: string, url: string): Promise<FaceArt> {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const vb = (doc.documentElement.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const IDS = ['white_bg', 'lines', 'right_eye', 'left_eye'];
  for (const id of IDS) if (!doc.querySelector(`#${id}`)) throw new Error(`[faceswap] ${name}: layer ${id} missing`);
  const W = Math.round(vb[2] * RS), H = Math.round(vb[3] * RS);
  const layer = async (keep: string[]): Promise<HTMLCanvasElement> => {
    const d = doc.cloneNode(true) as Document;
    for (const id of IDS) if (!keep.includes(id)) d.querySelector(`#${id}`)?.remove();
    const svg = d.documentElement; svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
    const href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}));
    try { const img = new Image(); img.src = href; await img.decode(); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d')!.drawImage(img, 0, 0, W, H); return cv; } finally { URL.revokeObjectURL(href); }
  };
  const bg = await layer(['white_bg']), all = await layer(IDS);
  const bp = bg.getContext('2d')!.getImageData(0, 0, W, H).data; let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bp[(y * W + x) * 4 + 3] > 128) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 <= bx0) throw new Error(`[faceswap] ${name}: white_bg is empty`);
  return {name, cv: all, bx0, bx1: bx1 + 1, by1: by1 + 1, bgW: bx1 - bx0 + 1, bgH: by1 - by0 + 1};
}
function useFaces(): FaceArt[] | null {
  const {delayRender, continueRender} = useDelayRender();
  const [faces, setFaces] = useState<FaceArt[] | null>(null);
  const [handle] = useState(() => delayRender('troll face art'));
  const advance = useThree((st) => st.advance), invalidate = useThree((st) => st.invalidate), {isRendering} = useRemotionEnvironment();
  useEffect(() => {
    let live = true;
    Promise.all(FACES.slice(0, N_TROLL).map((f) => { let p = ART.get(f.name); if (!p) { p = loadFace(f.name, f.url); ART.set(f.name, p); } return p; })).then((a) => { a.forEach((x) => console.info('[faceswap] scale', JSON.stringify(scaleReport(x)))); if (live) setFaces(a); }, (e) => { console.error(e); continueRender(handle); });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // release the frame only after the scene re-rendered with the art and the overlay drew it (two animation frames)
    if (!faces) return;
    const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; // the art arrived after the first draw: force the canvas to draw the re-rendered scene
    let r2 = 0, tm = 0; const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(() => { draw(); tm = window.setTimeout(() => { draw(); continueRender(handle); }, 300); }); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(tm); };
  }, [faces]); // eslint-disable-line react-hooks/exhaustive-deps
  return faces;
}
/** card px per raster px: the troll head shape (white_bg height) becomes TROLL_K x the original head height */
const fitOf = (a: FaceArt) => (TROLL_K * HEAD_H) / a.bgH;
export const scaleReport = (a: FaceArt) => { const F = fitOf(a); return {face: a.name, heightVsOriginalHead: +((F * a.bgH) / HEAD_H).toFixed(3), widthVsOriginalHead: +((F * a.bgW) / HEAD_W).toFixed(3), cardPxPerSvgUnit: +(F * RS).toFixed(3)}; };

// ---------------------------------------------------------------- overlay: the head (troll art or the original head art) in head px, origin = head centre
const OV_K = 2, OV_R = Math.max(...HEAD_PTS.map((q) => Math.hypot(q[0], q[1]))) * 1.2 + 20, OV_S = Math.ceil(2 * OV_R);
function drawOverlay(c: CanvasRenderingContext2D, art: FaceArt | null, o: {yaw: number}): void {
  const b = build(KIND), w = wrapAng(o.yaw);
  c.setTransform(OV_K, 0, 0, OV_K, 0, 0); c.clearRect(0, 0, OV_S, OV_S); c.translate(OV_S / 2, OV_S / 2);
  if (art) { // the troll head: its own outline and shape; bottom on the original head bottom (+2 %), centred; yaw shifts and squeezes it a little like the kit's head art
    const F = fitOf(art);
    c.save(); c.translate(Math.sin(w) * b.rx * 0.2, HEAD_BOTTOM + 0.02 * HEAD_H); c.scale(Math.max(0.6, Math.cos(w)), 1); c.scale(F, F); c.translate(-(art.bx0 + art.bx1) / 2, -art.by1); c.drawImage(art.cv, 0, 0); c.restore();
  } else drawHead(c, KIND, 'smug', o.yaw, [], 0); // original head art (silhouette, outline, relief, face); pitch comes from the group affine
}

// ---------------------------------------------------------------- motion
const sstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** head scale after a swap: 70 % -> 125 % in 0.1 s (ease-out), then a damped spring to exactly 100 % at 0.35 s */
export const popAt = (t: number): number => {
  if (t < 0) return 1;
  if (t < 0.1) { const x = t / 0.1; return 0.7 + 0.55 * (1 - (1 - x) ** 3); }
  const tau = t - 0.1;
  return 1 + 0.25 * Math.exp(-8 * tau) * Math.cos((2 * Math.PI * tau) / 0.2) * (1 - sstep((tau - 0.1) / 0.15));
};
/** squash while the head is small, stretch while it overshoots (parent scale about the neck) */
export const squash = (pop: number): {sx: number; sy: number} => { const e = pop - 1; return {sx: 1 - 0.1 * e, sy: 1 + 0.15 * e}; };
interface Mo { idx: number; age: number; pop: number; sx: number; sy: number; yaw: number; pitch: number; roll: number; lean: number; bounce: Bounce }
function motionAt(frame: number): Mo {
  const idx = Math.min(FACES.length - 1, Math.floor(frame / (FACE_SEC * FS_FPS))), age = frame - idx * FACE_SEC * FS_FPS, t = age / FS_FPS, abs = frame / FS_FPS;
  const cur = FACES[idx], prev = FACES[Math.max(0, idx - 1)], m = idx === 0 ? 1 : easeS(Math.min(1, t / 0.3)); // the new attitude is reached in 0.3 s
  const mix = (a: number, b: number) => a + (b - a) * m, sg = idx % 2 ? -1 : 1;
  const pop = popAt(t), sq = squash(pop), kick = sg * 0.06 * Math.exp(-9 * t) * Math.sin((2 * Math.PI * t) / 0.28);
  return {
    idx, age, pop, sx: sq.sx, sy: sq.sy,
    yaw: mix(prev.yaw, cur.yaw) + 0.1 * Math.sin((2 * Math.PI * abs) / 2.2),
    pitch: mix(prev.pitch, cur.pitch) + 0.035 * Math.sin((2 * Math.PI * abs) / 1.7 + 1),
    roll: mix(prev.roll, cur.roll) + 0.03 * Math.sin((2 * Math.PI * abs) / 2.9) + kick,
    lean: 0.012 * Math.sin((2 * Math.PI * abs) / 2.6),
    bounce: {dy: -12 * (pop - 1), sx: 1, sy: 1, rock: 0.02 * (pop - 1) * sg, headDy: 0}, // upper body hops up as the head overshoots (px), tiny rock; squash is the parent scale
  };
}

// ---------------------------------------------------------------- camera: ONE medium shot (head + upper body), straight push-in with an S-curve
const D0 = 1.6, PUSH = 0.12, FOV = 60, LOOK_DY = -0.24;
const buildCam = (): CamFn => {
  const look: V3 = [0, HEAD_C_Y + LOOK_DY, 0], pitch = (2 * Math.PI) / 180;
  const dir: V3 = [0, -Math.sin(pitch), -Math.cos(pitch)];
  const at = (d: number): V3 => [look[0] - dir[0] * d, look[1] - dir[1] * d, look[2] - dir[2] * d];
  return (u): Pose => ({p: at(D0 * (1 - PUSH * easeS(u))), l: look, fov: FOV});
};
function project(pose: Pose, w: V3): {x: number; y: number; z: number} { // pixels on 1080x1920
  const f = pose.fov ?? 50, tv = Math.tan((f * Math.PI) / 360), fw: V3 = [pose.l[0] - pose.p[0], pose.l[1] - pose.p[1], pose.l[2] - pose.p[2]], n = Math.hypot(...fw), z: V3 = [fw[0] / n, fw[1] / n, fw[2] / n];
  const r: V3 = [-z[2], 0, z[0]], rn = Math.hypot(r[0], r[2]) || 1, rr: V3 = [r[0] / rn, 0, r[2] / rn], up: V3 = [rr[1] * z[2] - rr[2] * z[1], rr[2] * z[0] - rr[0] * z[2], rr[0] * z[1] - rr[1] * z[0]];
  const d: V3 = [w[0] - pose.p[0], w[1] - pose.p[1], w[2] - pose.p[2]], dz = d[0] * z[0] + d[1] * z[1] + d[2] * z[2], dx = d[0] * rr[0] + d[1] * rr[1] + d[2] * rr[2], dy = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
  return {x: 540 + (dx / (dz * tv * (1080 / 1920))) * 540, y: 960 - (dy / (dz * tv)) * 960, z: dz};
}

// ---------------------------------------------------------------- set
const BOX = () => shared('fs-box', () => new THREE.BoxGeometry(1, 1, 1));
const SPH = () => shared('fs-sph', () => new THREE.SphereGeometry(1, 20, 14));
const MAT = (c: string, r = 0.6, ei = 0) => shared(`fs-m${c}${r}${ei}`, () => new THREE.MeshStandardMaterial({color: c, roughness: r, emissive: ei ? c : '#000000', emissiveIntensity: ei}));
const Wall: React.FC = () => {
  const tex = useMemo(() => makeTex(1024, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2fb2b6'); g.addColorStop(0.55, '#2aa7ad'); g.addColorStop(1, '#176b80'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const pool = c.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.5); pool.addColorStop(0, 'rgba(255,240,200,0.55)'); pool.addColorStop(0.5, 'rgba(255,214,140,0.18)'); pool.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = pool; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(42,42,110,0.18)'; for (let i = 0; i < 9; i++) c.fillRect(i * (w / 9) + 6, 0, w / 18, h);
    c.fillStyle = 'rgba(240,176,60,0.22)'; for (const [x, y, r] of [[0.16, 0.22, 0.07], [0.82, 0.3, 0.05], [0.72, 0.12, 0.035], [0.3, 0.1, 0.03]]) { c.beginPath(); c.arc(x * w, y * h, r * w, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(229,96,77,0.28)'; c.fillRect(0, h * 0.8, w, h * 0.04);
  }), []);
  return <mesh position={[0, 1.6, -2.1]}><planeGeometry args={[7, 7]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
};
const Set: React.FC = () => (
  <>
    <Wall />
    <mesh geometry={BOX()} material={MAT('#2a2a6e', 0.7)} position={[-1.25, 1.2, -1.7]} scale={[0.7, 2.4, 0.5]} />
    <mesh geometry={BOX()} material={MAT('#f0b03c', 0.6)} position={[1.25, 0.95, -1.7]} scale={[0.6, 1.9, 0.5]} />
    <mesh geometry={SPH()} material={MAT('#e5604d', 0.5)} position={[1.25, 2.0, -1.7]} scale={[0.22, 0.22, 0.22]} />
    <mesh geometry={SPH()} material={MAT('#fff0c8', 0.4, 2.2)} position={[-1.25, 2.55, -1.6]} scale={[0.1, 0.1, 0.1]} />
    <Glow p={[-1.25, 2.55, -1.5]} size={1.6} color="#ffd98a" intensity={0.9} />
    <mesh geometry={BOX()} material={MAT('#176b80', 0.8)} position={[0, -0.05, -0.5]} scale={[7, 0.1, 5]} />
  </>
);
const Lights: React.FC = () => (
  <>
    <hemisphereLight args={['#d4f1ee', '#4a3a8a', 1.15]} />
    <ambientLight intensity={0.25} />
    <directionalLight color="#ffd9a0" intensity={2.3} position={[-3, 4.2, 4]} />
  </>
);

// ---------------------------------------------------------------- scene
const CAM_FOR_CARD: V3 = [0, 0.85 * S0, 1.4]; // only fixes the card's orientation (face-on, no tilt)
const Scene: React.FC<{frame: number}> = ({frame}) => {
  const faces = useFaces();
  const mo = motionAt(frame), P: V3 = [0, 0, 0], troll = mo.idx < N_TROLL;
  const ov = useMemo(() => { const tex = makeTex(OV_S * OV_K, OV_S * OV_K, () => undefined); return {canvas: tex.image as HTMLCanvasElement, tex}; }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({map: ov.tex, transparent: true, alphaTest: 0.02, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), [ov]);
  const pose: RickPose = {...REST, fwd: [0, 1], face: 'deadpan', lean: mo.lean, headRoll: mo.roll, headPitch: clampPitch(mo.pitch), headFwd: [Math.sin(mo.yaw), Math.cos(mo.yaw)], bounce: mo.bounce, troll: BLANK};
  const yawC = yawTo(CAM_FOR_CARD, P), sol = solve(KIND, pose, yawC), hc = headCard(KIND, sol, pose), tilt = cardTilt(CAM_FOR_CARD, P, S0), k = KM;
  const hy = wrapAng(headYaw(pose, yawC)), pa = pitchAffine(build(KIND).ry, mo.pitch), roll = pose.lean + mo.bounce.rock + pose.headRoll;
  drawOverlay(ov.canvas.getContext('2d')!, troll && faces ? faces[mo.idx] : null, {yaw: hy});
  ov.tex.needsUpdate = true;
  const hcw: V3 = [(hc[0] - CX) * k, (GROUND - hc[1]) * k, 0], neck = -RY * k, s = mo.pop; // head centre in the card frame (card yaw 0, tilt 0), neck point 'RY' below it
  return (
    <>
      <Lights />
      <Set />
      <group position={[0, NECK_Y, 0]} scale={[mo.sx, mo.sy, mo.sx]}>{/* squash / stretch: one parent scale about the neck */}
        <group position={[0, -NECK_Y, 0]}>
          <Rick kind={KIND} pose={pose} p={P} cam={CAM_FOR_CARD} s={S0} />
          {/* the whole head (overlay + cap + hair) pops about the neck point: scale s about N = head centre + (0, neck): position = head centre + (1 - s) N */}
          <group position={[hcw[0], hcw[1] + (1 - s) * neck, 0]} scale={[s, s, s]}>
            <group visible={!troll}>
              <HeadGear kind={KIND} spec={GEAR} pos={[-hcw[0], -hcw[1], 0]} cardYaw={yawC} tilt={tilt} hx={hc[0]} hy={hc[1]} roll={roll} yaw={hy} s={S0} cx={CX} ground={GROUND} pitch={pose.headPitch ?? 0} />
            </group>
            <group position={[0, 0, 0.004]}><group rotation={[0, 0, -roll]}><group position={[0, -pa.sil * k, 0]} scale={[1, pa.sy, 1]}>
              <mesh material={mat} renderOrder={2} scale={[OV_S * k, OV_S * k, 1]}><planeGeometry args={[1, 1]} /></mesh>
            </group></group></group>
          </group>
        </group>
      </group>
    </>
  );
};

// ---------------------------------------------------------------- checks (setup time)
function runChecks(cam: CamFn): string[] {
  const out: string[] = [], bad: number[] = []; let minM = 1e9;
  for (let f = 0; f < FS_FRAMES; f++) {
    const pose = cam(f / (FS_FRAMES - 1), f / FS_FPS), hc = project(pose, [0, HEAD_C_Y, 0]), rad = (HEAD_R * 1920) / (2 * Math.tan((FOV * Math.PI) / 360) * hc.z) * 1.25; // x1.25: the pop
    const m = Math.min(hc.x - rad - SAFE_BOX.x0 * 1080, SAFE_BOX.x1 * 1080 - (hc.x + rad), hc.y - rad - SAFE_BOX.y0 * 1920, SAFE_BOX.y1 * 1920 - (hc.y + rad)); minM = Math.min(minM, m);
    if (m < 0) bad.push(f);
  }
  out.push(bad.length ? `FAIL head circle (r ${HEAD_R} m x 1.25 pop) leaves SAFE_BOX on ${bad.length} frames, first ${bad.slice(0, 5).join(',')}, worst ${minM.toFixed(0)} px` : `PASS head circle (r ${HEAD_R} m x 1.25 pop) inside SAFE_BOX on all ${FS_FRAMES} frames, min margin ${minM.toFixed(0)} px`);
  const c0 = project(cam(0, 0), [0, HEAD_C_Y, 0]), c1 = project(cam(1, 3), [0, HEAD_C_Y, 0]);
  out.push(`head centre on screen: start (${c0.x.toFixed(0)}, ${c0.y.toFixed(0)}), end (${c1.x.toFixed(0)}, ${c1.y.toFixed(0)})`);
  out.push(`pop: frame 0 ${popAt(0).toFixed(2)}, frame 3 ${popAt(0.1).toFixed(2)}, frames 10-13: ${[10, 11, 12, 13].map((a) => popAt(a / FS_FPS).toFixed(3)).join(' ')}; swaps at frames 0, 30, 60, 90 (90 = original head back)`);
  out.push(`original head ${HEAD_W.toFixed(0)} x ${HEAD_H.toFixed(0)} card px; troll head height = ${TROLL_K} x original`);
  return out;
}

export const FaceSwapTest: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    const cam = buildCam(), lines = runChecks(cam);
    (window as unknown as {__faceswap?: unknown}).__faceswap = {lines};
    lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[faceswap]', l) : console.info('[faceswap]', l)));
    return [{
      from: 0, to: FS_FRAMES, light: 'indoor', ownLights: true, cam,
      post: () => (<EffectComposer multisampling={4}><ToneMapping mode={ToneMappingMode.LINEAR} /></EffectComposer>),
      render: (t) => <Scene frame={Math.round(t * FS_FPS)} />,
    }];
  }, []);
  return <SingleCanvasVideo shots={shots} fps={FS_FPS} />;
};

/** Standalone root: `npx remotion studio src/faceSwapEntry.ts` */
export const FaceSwapRoot: React.FC = () => <Composition id="FaceSwapTest" component={FaceSwapTest} durationInFrames={FS_FRAMES} fps={FS_FPS} width={1080} height={1920} />;
