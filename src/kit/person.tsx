// KIT CHARACTER (2026-11-17, default for all future videos): white card characters (rickRig) + clothes overlay + 3D head gear (headgear.tsx) + age / gender personas.
//   registerRole(name, spec): one head SVG + one body SVG (+ flip, scale) per character; persona 'm' | 'f' | 'c' (child) | 'e' (elder) picks the face details (lashes + lips, round cheeks, wrinkles);
//   age scales the card (child 0.68-0.75, a larger head ratio via ry) and slows the walk (elder). Hats, hair, beards, mustaches, glasses, earrings, headbands, scarves and canes are 3D (GearSpec).
//   Clothes (flat, unlit overlay card in front of the torso): vest, suit, dress, apron, stripes, sweater, skirt, blouse, coat, overalls, shorts, uniform, cardigan, shawl.
//   Relief shadow: DARK translucent crescent on the lower right of head, torso and clothes (RELIEF_COLOR), never light.
// TROLL FACES: `<Person troll />` swaps the head for the reaction face; face props (mustache, glasses, beard, earrings) hide while it is on, hats and hair stay.
// Render stability: card textures via makeTex (the kit frees them with the shot), gear geometry is shared per role, Path2D caches are CPU only.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, makeTex} from './kit';
import {SHAPES} from './data/shapes';
import {FacialSpec, cardTilt, CW, CH, CX, GROUND, HIP_Y, PXM, REST, RELIEF_COLOR, Rick, RickPose, Kind, NO_BOUNCE, build, handWorld, headCard, solve, torsoPts, torsoYaw, yawTo, headYaw, wrapAng, headPts, relief} from './rickRig';
import {ReactionDraw, makeReactionDraw, makeZoneTint, reactionDraw, showReaction, useReactionFace} from './reactionFace';
import {TINT_COLORS, TintState, TintZone} from './tint';
import {GearSpec, HeadGear} from './headgear';

export type Style = 'vest' | 'suit' | 'dress' | 'apron' | 'stripes' | 'sweater' | 'skirt' | 'blouse' | 'coat' | 'overalls' | 'shorts' | 'uniform' | 'cardigan' | 'shawl';
export type Persona = 'm' | 'f' | 'c' | 'e';
export type Age = 'adult' | 'child' | 'elder';
export interface CharSpec {kind: Kind; head: [number, boolean, number]; body: [number, boolean, number]; ry: number; persona: Persona; age: Age; scale: number; style: Style; top: string; accent: string; bottom: string; gear: GearSpec; facial?: FacialSpec; scarf?: string; cane?: boolean}
export const SPECS: Record<string, CharSpec> = {};
export const KIND: Record<string, Kind> = {};
export const AGE_GAIT: Record<Age, number> = {adult: 1, child: 0.92, elder: 0.7}; // leg swing factor: elders take shorter steps (and bob less, see AGE_BOB)
export const AGE_BOB: Record<Age, number> = {adult: 1, child: 1.1, elder: 0.5};
export const AGE_LEAN: Record<Age, number> = {adult: 0, child: 0, elder: 0.05}; // forward lean of elders (rad, toward the walk direction)
let nextKind = 21;
export function registerRole(name: string, spec: Omit<CharSpec, 'kind'> & {kind?: Kind}): CharSpec {
  const kind: Kind = spec.kind ?? (`c${nextKind++}` as Kind), full: CharSpec = {...spec, kind}, b = build(kind);
  Object.assign(b, {gear: 'bald', outfit: 'plain', faceDy: 0, ry: spec.ry, cy: 330 - spec.ry, hs: {idx: spec.head[0], flip: spec.head[1], sx: spec.head[2]}, bs: {idx: spec.body[0], flip: spec.body[1], sx: spec.body[2]}, persona: spec.persona, facial: spec.facial});
  b.rx = Math.round(SHAPES.heads[spec.head[0]].aspect * spec.head[2] * spec.ry * 10) / 10;
  b.tw = Math.round(SHAPES.bodies[spec.body[0]].aspect * spec.body[2] * b.th); b.tr = Math.min(72, Math.round(b.tw * 0.32));
  const hk = spec.gear.hair?.kind, male = spec.persona === 'm' || (spec.persona === 'e' && (hk === 'balding' || hk === 'short' || hk === 'messy')) || (spec.persona === 'c' && (hk === 'short' || hk === 'messy' || hk === 'curls'));
  if (spec.gear.hair) full.gear = {...spec.gear, hair: {...spec.gear.hair, male}}; // men's hair stays on the crown and at the back (headgear.tsx vThrM)
  SPECS[name] = full; KIND[name] = kind; return full;
}
const INK = '#120a14', K = 1.5, RIM = 'rgba(255,176,110,0.7)';
const PATHS = new Map<string, Path2D>();
const torsoPath = (kind: Kind, wT: number): Path2D => { const key = `${kind}|${Math.round(wT)}`; let p = PATHS.get(key); if (!p) { p = new Path2D(); torsoPts(kind, wT).forEach((q, i) => (i ? p!.lineTo(q[0], q[1]) : p!.moveTo(q[0], q[1]))); p.closePath(); PATHS.set(key, p); } return p; };
export const dirTo = (a: V3, b: V3): [number, number] => { const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
export const poseOf = (p: V3, cam: V3, po: Partial<RickPose> = {}): RickPose => ({...REST, fwd: dirTo(p, cam), ...po});
export const scaleOf = (role: string) => SPECS[role].scale;
export function handPos(role: string, pose: RickPose, p: V3, cam: V3, s: number, slot: number): V3 { const kind = KIND[role], yaw = yawTo(cam, p), sol = solve(kind, pose, yaw); return handWorld(kind, pose, sol, yaw, slot, p, s * SPECS[role].scale); }
export function headPos(role: string, p: V3, s: number): V3 { const b = build(KIND[role]); return [p[0], p[1] + (GROUND - b.cy) * PXM * s * SPECS[role].scale, p[2]]; }

// ---------------------------------------------------------------- clothes
function drawBody(c: CanvasRenderingContext2D, sp: CharSpec, front: boolean, sinT: number, cosT: number, tx: number, ty: number, wT: number, th: number, tone?: string): void {
  const top = tone ?? sp.top, W = wT + 24, X = tx - 12, line = (y: number) => { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(X, y); c.lineTo(X + W, y); c.stroke(); };
  const shift = CX + sinT * wT * 0.36, fr = (fn: () => void) => { if (!front) return; c.save(); c.translate(shift, 0); c.scale(Math.max(0.2, cosT), 1); c.translate(-CX, 0); fn(); c.restore(); };
  const tri = (pts: [number, number][], fill: string, stroke = true) => { c.fillStyle = fill; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); if (stroke) { c.strokeStyle = INK; c.lineWidth = 4; c.stroke(); } };
  const dots = (col: string) => { c.fillStyle = col; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(X + ((i * 53) % W), ty + 30 + ((i * 71) % (th - 40)), 7, 0, 7); c.fill(); } };
  const st = sp.style;
  if (st === 'dress' || st === 'apron' || st === 'shawl') {
    c.fillStyle = top; c.fillRect(X, ty - 6, W, th + 12); if (st === 'dress') dots('rgba(255,255,255,0.55)');
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(X, ty + th * 0.8, W, th * 0.2 + 12); line(ty + th * 0.8);
    fr(() => {
      if (st === 'apron') { tri([[CX - 60, ty + th * 0.2], [CX + 60, ty + th * 0.2], [CX + 82, ty + th + 6], [CX - 82, ty + th + 6]], sp.accent); }
      else if (st === 'shawl') { tri([[CX - 100, ty - 6], [CX + 100, ty - 6], [CX + 70, ty + th * 0.55], [CX, ty + th * 0.78], [CX - 70, ty + th * 0.55]], sp.accent); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(CX - 80 + i * 20, ty + 10); c.lineTo(CX - 40 + i * 12, ty + th * 0.5); c.stroke(); } }
      else tri([[CX - 44, ty - 4], [CX, ty + 46], [CX + 44, ty - 4]], sp.accent);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(CX - 60, ty + th * 0.46, 120, 12);
    });
    return;
  }
  if (st === 'coat') { // long coat: big buttons, fur-style collar, belt
    c.fillStyle = top; c.fillRect(X, ty - 6, W, th + 12); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(X, ty + th * 0.86, W, th * 0.14 + 12);
    fr(() => { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(CX, ty + 30); c.lineTo(CX, ty + th); c.stroke(); tri([[CX - 90, ty - 6], [CX - 10, ty + 70], [CX - 4, ty + 10]], sp.accent); tri([[CX + 90, ty - 6], [CX + 10, ty + 70], [CX + 4, ty + 10]], sp.accent); c.fillStyle = '#231A28'; for (let k = 0; k < 4; k++) for (const sx of [-16, 16]) { c.beginPath(); c.arc(CX + sx, ty + 100 + k * 44, 7, 0, 7); c.fill(); } c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(CX - 100, ty + th * 0.5, 200, 14); });
    return;
  }
  c.fillStyle = sp.bottom; c.fillRect(X, ty + th * 0.58, W, th * 0.42 + 12); line(ty + th * 0.585);
  if (st === 'skirt') { c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 7; i++) c.fillRect(X + 8 + i * (W / 7), ty + th * 0.585, 6, th * 0.42); }
  else if (front) { c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(CX, ty + th * 0.585); c.lineTo(CX, ty + th); c.stroke(); }
  if (st === 'stripes') {
    c.fillStyle = sp.accent; c.fillRect(X, ty - 6, W, th * 0.6 + 6); c.fillStyle = top; for (let y = ty - 6; y < ty + th * 0.585; y += 40) c.fillRect(X, y, W, 20);
    fr(() => { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(CX - 52, ty - 6); c.lineTo(CX - 8, ty + 40); c.lineTo(CX + 8, ty + 40); c.lineTo(CX + 52, ty - 6); c.stroke(); tri([[CX - 30, ty - 6], [CX, ty + 34], [CX + 30, ty - 6]], '#FFFFFF', false); });
    return;
  }
  if (st === 'overalls') { // child: tee + overall bib and straps
    c.fillStyle = top; c.fillRect(X, ty - 6, W, th * 0.6 + 6); c.fillStyle = sp.accent; c.fillRect(X, ty + th * 0.32, W, th * 0.68 + 12);
    fr(() => { tri([[CX - 52, ty + th * 0.32], [CX + 52, ty + th * 0.32], [CX + 52, ty + th * 0.56], [CX - 52, ty + th * 0.56]], 'rgba(0,0,0,0.12)'); c.strokeStyle = sp.accent; c.lineWidth = 16; c.beginPath(); c.moveTo(CX - 46, ty + th * 0.32); c.lineTo(CX - 36, ty - 6); c.moveTo(CX + 46, ty + th * 0.32); c.lineTo(CX + 36, ty - 6); c.stroke(); c.fillStyle = '#E8B23A'; for (const sx of [-46, 46]) { c.beginPath(); c.arc(CX + sx, ty + th * 0.32, 7, 0, 7); c.fill(); } });
    return;
  }
  if (st === 'uniform') { // child: white shirt, navy jumper vest, tie
    c.fillStyle = '#F4EFE0'; c.fillRect(X, ty - 6, W, th * 0.6 + 6);
    fr(() => { tri([[CX - 90, ty - 6], [CX - 24, ty - 6], [CX, ty + 80], [CX + 24, ty - 6], [CX + 90, ty - 6], [CX + 96, ty + th * 0.585], [CX - 96, ty + th * 0.585]], top); tri([[CX - 11, ty + 4], [CX + 11, ty + 4], [CX + 16, ty + 90], [CX, ty + 116], [CX - 16, ty + 90]], sp.accent); });
    return;
  }
  c.fillStyle = st === 'vest' ? sp.top : top; c.fillRect(X, ty - 6, W, th * 0.6 + 6);
  if (st === 'vest') fr(() => { tri([[CX - 90, ty - 6], [CX - 26, ty - 6], [CX, ty + 90], [CX + 26, ty - 6], [CX + 90, ty - 6], [CX + 96, ty + th * 0.585], [CX - 96, ty + th * 0.585]], sp.accent); c.fillStyle = '#E8B23A'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(CX, ty + 120 + k * 42, 6, 0, 7); c.fill(); } tri([[CX - 26, ty - 6], [CX, ty + 20], [CX + 26, ty - 6]], '#FFFFFF', false); if (sp.facial?.mustache) { c.fillStyle = '#E0302A'; c.strokeStyle = INK; c.lineWidth = 4; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(CX, ty + 8); c.lineTo(CX + sg * 42, ty - 8); c.lineTo(CX + sg * 42, ty + 28); c.closePath(); c.fill(); c.stroke(); } c.fillStyle = '#B01E1A'; c.beginPath(); c.arc(CX, ty + 8, 10, 0, 7); c.fill(); } }); // hot red bow tie for a man with a mustache
  else if (st === 'suit') fr(() => { tri([[CX - 26, ty - 6], [CX + 26, ty - 6], [CX, ty + 100]], '#F4EFE0', false); tri([[CX - 26, ty - 6], [CX - 70, ty + 20], [CX - 8, ty + 130], [CX, ty + 100]], 'rgba(0,0,0,0.18)', false); tri([[CX + 26, ty - 6], [CX + 70, ty + 20], [CX + 8, ty + 130], [CX, ty + 100]], 'rgba(0,0,0,0.18)', false); tri([[CX - 11, ty + 4], [CX + 11, ty + 4], [CX + 16, ty + 100], [CX, ty + 130], [CX - 16, ty + 100]], sp.accent, false); });
  else if (st === 'blouse') fr(() => { tri([[CX - 50, ty - 6], [CX - 6, ty + 52], [CX - 4, ty + 6]], sp.accent); tri([[CX + 50, ty - 6], [CX + 6, ty + 52], [CX + 4, ty + 6]], sp.accent); c.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(CX, ty + 70 + k * 36, 5, 0, 7); c.fill(); } });
  else if (st === 'cardigan') fr(() => { tri([[CX - 36, ty - 6], [CX + 36, ty - 6], [CX, ty + th * 0.52]], sp.accent, false); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(CX - 36, ty - 6); c.lineTo(CX - 4, ty + th * 0.58); c.moveTo(CX + 36, ty - 6); c.lineTo(CX + 4, ty + th * 0.58); c.stroke(); c.fillStyle = '#5A3A22'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(CX, ty + 60 + k * 44, 6, 0, 7); c.fill(); } });
  else if (front) fr(() => { tri([[CX - 40, ty - 6], [CX + 40, ty - 6], [CX, ty + 70]], sp.accent); c.fillStyle = 'rgba(255,255,255,0.28)'; for (let y = ty + 90; y < ty + th * 0.55; y += 30) c.fillRect(CX - 90, y, 180, 8); }); // sweater / shorts tee
}
function drawOutfit(c: CanvasRenderingContext2D, role: string, pose: RickPose, yaw: number, tone?: string): void {
  const sp = SPECS[role], kind = sp.kind, b = build(kind), sol = solve(kind, pose, yaw), tY = torsoYaw(pose, yaw), cosT = Math.cos(tY), sinT = Math.sin(tY), wT = b.tw * (0.38 + 0.62 * Math.abs(cosT)), bn = pose.bounce ?? NO_BOUNCE;
  c.clearRect(0, 0, CW, CH);
  c.save(); c.translate(0, sol.hipY - HIP_Y); c.translate(CX, HIP_Y); c.translate(0, bn.dy); c.rotate(pose.lean + bn.rock); c.scale(bn.sx, bn.sy); c.translate(-CX, -HIP_Y);
  const path = torsoPath(kind, wT), ty = b.top, th = b.th, tx = CX - wT / 2;
  c.save(); c.clip(path); drawBody(c, sp, cosT > 0.05, sinT, cosT, tx, ty, wT, th, tone);
  relief(c, path, -0.025 * wT, 0, 2, RIM); relief(c, path, -0.075 * wT, -0.07 * th, 6, RELIEF_COLOR); // dark relief on the clothes too
  if (sp.scarf) { c.fillStyle = sp.scarf; c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.roundRect(tx + wT * 0.12, ty - 14, wT * 0.76, 40, 18); c.fill(); c.stroke(); c.beginPath(); c.moveTo(CX + wT * 0.14, ty + 22); c.lineTo(CX + wT * 0.3, ty + 22); c.lineTo(CX + wT * 0.3, ty + 92); c.lineTo(CX + wT * 0.14, ty + 80); c.closePath(); c.fill(); c.stroke(); } // 2D scarf
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 9; c.lineJoin = 'round'; c.stroke(path);
  { c.save(); c.globalCompositeOperation = 'destination-out'; c.translate(CX + pose.headDx, b.cy + pose.headDy + (bn.headDy - bn.dy)); c.rotate(pose.headRoll); c.beginPath(); headPts(kind).forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); c.restore(); } // the head sits in front of the torso
  c.restore();
}

export interface TintSpec {state: TintState; zones: TintZone[]; k: number}
export interface PersonProps {role: string; p: V3; s?: number; cam: V3; pose?: RickPose; troll?: boolean; tint?: TintSpec; tone?: string; noCane?: boolean}
/** A character: the card (rickRig), the clothes overlay, the 3D head gear on the head pivot, and the cane of an elder. `s` is the base scale (child / elder scale comes from the spec). */
export const Person: React.FC<PersonProps> = ({role, p, s: s0 = 0.9, cam, pose, troll, tint, tone, noCane}) => {
  const sp = SPECS[role], kind = sp.kind, s = s0 * sp.scale, yaw = yawTo(cam, p), base = pose ?? poseOf(p, cam);
  const face = useReactionFace('funny');
  const draw = useMemo(makeReactionDraw, []), spec = useMemo(() => showReaction('funny', 0, 15, {blinkAt: []}), []);
  const tintCv = useMemo(() => {
    if (!face || !tint) return null;
    const cvs = tint.zones.map((z) => makeZoneTint(face, TINT_COLORS[tint.state], z)), out = document.createElement('canvas');
    out.width = cvs[0].width; out.height = cvs[0].height;
    const c = out.getContext('2d')!; for (const cv of cvs) c.drawImage(cv, 0, 0);
    return out;
  }, [face, tint?.state, tint?.zones.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const full: RickPose = {...base};
  if (troll && face) { const r: ReactionDraw | null = reactionDraw(spec, face, 8, draw); if (r) { r.tint = tint ? tintCv : null; r.tintK = tint ? tint.k : 0; full.troll = r; } }
  if (tint && !(troll && face)) full.tint = tint.zones.map((zone) => ({state: tint.state, zone, k: tint.k}));
  const sol = solve(kind, full, yaw);
  { const lc = [sol.hipY, ...sol.hip.flat(), ...sol.sh.flat()]; if (!lc.every(Number.isFinite)) console.warn('[nan-solve]', role, JSON.stringify({p, hands: full.hands, z: full.handsZ})); } // QA: a non-finite limb makes a NaN tube
  const outfit = useMemo(() => { const tex = makeTex(CW * K, CH * K, () => undefined); return {canvas: tex.image as HTMLCanvasElement, tex}; }, []);
  const c = outfit.canvas.getContext('2d')!; c.setTransform(K, 0, 0, K, 0, 0); drawOutfit(c, role, full, yaw, tone); outfit.tex.needsUpdate = true;
  const w = CW * PXM * s, h = CH * PXM * s, cy = (GROUND - CH / 2) * PXM * s, hc = headCard(kind, sol, full), bn = full.bounce ?? NO_BOUNCE, tilt = cardTilt(cam, p, s);
  const hand = sp.cane && !noCane ? handPos(role, full, p, cam, s0, 1) : null;
  return (
    <group userData={{qaBody: {role, axis: [p[0], p[2]], r: 0.15 * sp.scale, top: 1.55 * s0 * sp.scale}}}>
      <Rick kind={kind} pose={full} p={p} cam={cam} s={s} />
      <group position={p} rotation={[0, yaw, 0]}><group rotation={[-tilt, 0, 0]}>
        <mesh position={[0, cy, 0.012 * s]} renderOrder={2}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={outfit.tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group></group>
      <HeadGear kind={kind} spec={sp.gear} pos={p} cardYaw={yaw} tilt={tilt} hx={hc[0]} hy={hc[1]} roll={full.lean + bn.rock + full.headRoll} yaw={wrapAng(headYaw(full, yaw))} s={s} troll={!!full.troll} cx={CX} ground={GROUND} pitch={full.headPitch ?? 0} />
      {hand && <group position={[hand[0], 0, hand[2]]} rotation={[0, 0, -0.06]}>
        <mesh position={[0, hand[1] / 2, 0]} castShadow><cylinderGeometry args={[0.014, 0.012, hand[1], 8]} /><meshToonMaterial color="#6B3F22" /></mesh>
        <mesh position={[0.03, hand[1] + 0.01, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.04, 0.014, 8, 14, Math.PI]} /><meshToonMaterial color="#6B3F22" /></mesh>
      </group>}
    </group>
  );
};
