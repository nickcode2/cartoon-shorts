// COBRA_EFFECT cast: five white card characters built from the rickRig kit (pure white unlit cards, outline #231A28) with role clothes
// drawn on a second unlit card in front of the torso / head (tee + pants, beige colonial suit + tie + pith helmet + mustache).
// My SVG shapes: man = head1 / body1, official = head2 / body2, breeders = head3 and seeded variants (head3 / body2 and head3 / body1).
//   man      = c12  (HS idx 0 = head1, BS idx 0 = body1)
//   official = c13  (HS idx 1 = head2, BS idx 1 = body2)
//   breeders = c11 (head3 / body2), c14 (head3 / body1), c17 (head3 / body2); each has its own flip, scale and 3 % deformation from the generator
// Render stability: card textures via makeTex (the kit frees them with the shot), clothes path cache is a plain Map of Path2D (CPU only).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, makeTex} from '../kit/kit';
import {cardTilt, CW, CH, CX, GROUND, HIP_Y, PXM, REST, Rick, RickPose, FaceName, Kind, NO_BOUNCE, build, handWorld, solve, torsoPts, torsoYaw, yawTo, headView, headYaw, wrapAng, headPts, relief} from '../kit/rickRig';
import {ReactionDraw, activeFaceProps, makeReactionDraw, makeZoneTint, reactionDraw, registerFaceProps, showReaction, useReactionFace} from '../kit/reactionFace';
import {TINT_COLORS, TintState, TintZone} from '../kit/tint';
import {C} from './common';

export type Role = 'man' | 'official' | 'b1' | 'b2' | 'b3';
export const KIND: Record<Role, Kind> = {man: 'c12', official: 'c13', b1: 'c11', b2: 'c14', b3: 'c17'};
// Clean heads: the generator's random hair / outfit details are switched off (clothes come from the overlay below, heads stay pure white).
for (const k of Object.values(KIND)) Object.assign(build(k), {gear: 'bald', outfit: 'plain', faceDy: 0});

registerFaceProps(KIND.official, ['helmet', 'mustache']); // hidden automatically while a troll face is active, back afterwards
const INK = '#120a14';
const K = 1.5; // overlay raster scale (same as the card)
export const TEE: Record<Role, string> = {man: '#3FA7C9', official: '#D9C69C', b1: '#E0B03A', b2: '#8E6BBF', b3: '#43A98B'};
export const PANTS: Record<Role, string> = {man: '#4B5A8C', official: '#D9C69C', b1: '#6B4A32', b2: '#5A4A3A', b3: '#6B4A32'};

const PATHS = new Map<string, Path2D>();
const HPATHS = new Map<string, Path2D>();
const headPath = (kind: Kind): Path2D => { let p = HPATHS.get(kind); if (!p) { p = new Path2D(); headPts(kind).forEach((q, i) => (i ? p!.lineTo(q[0], q[1]) : p!.moveTo(q[0], q[1]))); p.closePath(); HPATHS.set(kind, p); } return p; };
const RIM = 'rgba(255,176,110,0.7)'; // thin warm rim on the shadow (right) edge, the only thing the scene light adds to the white cards besides the crescent tint
const torsoPath = (kind: Kind, wT: number): Path2D => {
  const key = `${kind}|${Math.round(wT)}`;
  let p = PATHS.get(key);
  if (!p) { p = new Path2D(); torsoPts(kind, wT).forEach((q, i) => (i ? p!.lineTo(q[0], q[1]) : p!.moveTo(q[0], q[1]))); p.closePath(); PATHS.set(key, p); }
  return p;
};

/** World direction (x, z) from a to b, unit. */
export const dirTo = (a: V3, b: V3): [number, number] => { const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
/** A pose that faces `cam` by default; po overrides any field. */
export const poseOf = (p: V3, cam: V3, po: Partial<RickPose> = {}): RickPose => ({...REST, fwd: dirTo(p, cam), ...po});
/** World position of a hand ball (slot 0 = card-left arm) for a pose: put props there. */
export function handPos(role: Role, pose: RickPose, p: V3, cam: V3, s: number, slot: number): V3 {
  const kind = KIND[role], yaw = yawTo(cam, p), sol = solve(kind, pose, yaw);
  return handWorld(kind, pose, sol, yaw, slot, p, s);
}
/** World position of the head centre. */
export function headPos(role: Role, p: V3, s: number): V3 { const b = build(KIND[role]); return [p[0], p[1] + (GROUND - b.cy) * PXM * s, p[2]]; }

function drawOutfit(c: CanvasRenderingContext2D, role: Role, pose: RickPose, yaw: number): void {
  const kind = KIND[role], b = build(kind), sol = solve(kind, pose, yaw), tY = torsoYaw(pose, yaw), cosT = Math.cos(tY), sinT = Math.sin(tY), wT = b.tw * (0.38 + 0.62 * Math.abs(cosT)), bn = pose.bounce ?? NO_BOUNCE;
  c.clearRect(0, 0, CW, CH);
  c.save(); c.translate(0, sol.hipY - HIP_Y); c.translate(CX, HIP_Y); c.translate(0, bn.dy); c.rotate(pose.lean + bn.rock); c.scale(bn.sx, bn.sy); c.translate(-CX, -HIP_Y);
  const path = torsoPath(kind, wT), ty = b.top, th = b.th, tx = CX - wT / 2;
  c.save(); c.clip(path);
  const front = cosT > 0.05;
  if (role === 'official') {
    c.fillStyle = TEE.official; c.fillRect(tx - 12, ty - 6, wT + 24, th + 12); // beige colonial suit
    c.fillStyle = '#C9B382'; c.fillRect(tx - 12, ty + th * 0.55, wT + 24, 10); // jacket hem
    if (front) {
      c.save(); c.translate(CX + sinT * b.tw * 0.36, 0); c.scale(Math.max(0.2, cosT), 1); c.translate(-CX, 0);
      c.fillStyle = '#F4EFE0'; c.beginPath(); c.moveTo(CX - 26, ty); c.lineTo(CX + 26, ty); c.lineTo(CX, ty + 92); c.closePath(); c.fill(); // shirt V
      c.fillStyle = '#B9A06A'; c.beginPath(); c.moveTo(CX - 26, ty); c.lineTo(CX - 66, ty + 22); c.lineTo(CX - 8, ty + 120); c.lineTo(CX, ty + 92); c.closePath(); c.fill(); // lapels
      c.beginPath(); c.moveTo(CX + 26, ty); c.lineTo(CX + 66, ty + 22); c.lineTo(CX + 8, ty + 120); c.lineTo(CX, ty + 92); c.closePath(); c.fill();
      c.fillStyle = '#8F2F2A'; c.beginPath(); c.moveTo(CX - 11, ty + 8); c.lineTo(CX + 11, ty + 8); c.lineTo(CX + 17, ty + 120); c.lineTo(CX, ty + 150); c.lineTo(CX - 17, ty + 120); c.closePath(); c.fill(); // tie
      c.fillStyle = '#7A5C2E'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(CX + 22, ty + 150 + k * 40, 6, 0, 7); c.fill(); } // buttons
      c.restore();
    }
  } else {
    c.fillStyle = TEE[role]; c.fillRect(tx - 12, ty - 6, wT + 24, th * 0.6 + 6); // plain tee
    c.fillStyle = PANTS[role]; c.fillRect(tx - 12, ty + th * 0.58, wT + 24, th * 0.42 + 12); // pants
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(tx - 12, ty + th * 0.585); c.lineTo(tx + wT + 12, ty + th * 0.585); c.stroke(); // waist line
    if (front) { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(CX, ty + th * 0.585); c.lineTo(CX, ty + th); c.stroke(); } // pants seam
  }
  relief(c, path, -0.025 * wT, 0, 2, RIM);
  relief(c, path, -0.075 * wT, -0.07 * th, 6, 'rgba(201,207,221,0.85)'); // same soft crescent as the card: light from the upper left, shadow on the right (clothes too)
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 9; c.lineJoin = 'round'; c.stroke(path); // keep the card's outline whole
  { // LAYER ORDER: the head sits IN FRONT of the torso (its lower edge overlaps the torso top): cut the head shape out of the clothes
    c.save(); c.globalCompositeOperation = 'destination-out'; c.translate(CX + pose.headDx, b.cy + pose.headDy + (bn.headDy - bn.dy)); c.rotate(pose.headRoll); c.beginPath(); headPts(kind).forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); c.restore();
  }
  c.restore();
  // head items (same head transform as drawRick)
  c.save(); c.translate(0, sol.hipY - HIP_Y); c.translate(CX, HIP_Y); c.translate(0, bn.dy); c.rotate(pose.lean + bn.rock); c.scale(bn.sx, bn.sy); c.translate(-CX, -HIP_Y);
  c.translate(CX + pose.headDx, b.cy + pose.headDy + (bn.headDy - bn.dy)); c.rotate(pose.headRoll);
  const hy = headYaw(pose, yaw), view = headView(hy), dir = wrapAng(hy) >= 0 ? 1 : -1, rx = b.rx, ry = b.ry;
  relief(c, headPath(kind), -0.035 * rx, 0, 2, RIM);
  const props = activeFaceProps(kind, pose.troll);
  if (role === 'official' && props.includes('helmet')) {
    const shift = view === 'front' ? Math.sin(wrapAng(hy)) * rx * 0.35 : dir * rx * 0.35;
    c.save(); c.translate(shift, 0); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 9;
    c.fillStyle = '#D6C592'; c.beginPath(); c.ellipse(0, -ry * 0.38, rx * 1.28, ry * 0.17, 0, 0, Math.PI * 2); c.fill(); c.stroke(); // brim
    c.fillStyle = '#EADFB8'; c.beginPath(); c.moveTo(-rx * 0.98, -ry * 0.4); c.bezierCurveTo(-rx * 1.0, -ry * 1.5, rx * 1.0, -ry * 1.5, rx * 0.98, -ry * 0.4); c.closePath(); c.fill(); c.stroke(); // dome
    c.fillStyle = '#8A6B3A'; c.beginPath(); c.moveTo(-rx * 0.97, -ry * 0.46); c.lineTo(rx * 0.97, -ry * 0.46); c.lineTo(rx * 0.99, -ry * 0.58); c.lineTo(-rx * 0.99, -ry * 0.58); c.closePath(); c.fill(); // hat band
    c.fillStyle = '#EADFB8'; c.beginPath(); c.arc(0, -ry * 1.17, rx * 0.1, 0, 7); c.fill(); c.stroke(); // top knob
    c.restore();
    if (view !== 'back' && props.includes('mustache')) { // handlebar mustache
      const mx = view === 'front' ? Math.sin(wrapAng(hy)) * rx * 0.5 : dir * rx * 0.5, my = ry * 0.34;
      c.fillStyle = '#2B1D1A'; c.strokeStyle = '#2B1D1A'; c.lineWidth = 6; c.lineCap = 'round';
      for (const sg of view === 'front' ? [-1, 1] : [dir]) { c.beginPath(); c.moveTo(mx, my); c.bezierCurveTo(mx + sg * rx * 0.22, my - 22, mx + sg * rx * 0.5, my + 16, mx + sg * rx * 0.62, my - 18); c.bezierCurveTo(mx + sg * rx * 0.5, my + 34, mx + sg * rx * 0.2, my + 26, mx, my + 10); c.closePath(); c.fill(); c.stroke(); }
    }
  }
  c.restore();
}

export interface TintSpec {state: TintState; zones: TintZone[]; k: number}
export interface PersonProps {
  role: Role; p: V3; s?: number; cam: V3;
  pose?: RickPose; // from poseOf(); default: standing facing the camera
  troll?: boolean; // show the troll face (funny.svg) instead of the drawn face
  tint?: TintSpec; // narration-driven head tint (white by default); also shown on the troll face
}
export const Person: React.FC<PersonProps> = ({role, p, s = 0.9, cam, pose, troll, tint}) => {
  const kind = KIND[role], yaw = yawTo(cam, p), base = pose ?? poseOf(p, cam);
  const face = useReactionFace('funny');
  const draw = useMemo(makeReactionDraw, []), spec = useMemo(() => showReaction('funny', 0, 15, {blinkAt: []}), []);
  const tintCv = useMemo(() => { // zone tint canvases combined once into one canvas for the troll face
    if (!face || !tint) return null;
    const cvs = tint.zones.map((z) => makeZoneTint(face, TINT_COLORS[tint.state], z)), out = document.createElement('canvas');
    out.width = cvs[0].width; out.height = cvs[0].height;
    const c = out.getContext('2d')!; for (const cv of cvs) c.drawImage(cv, 0, 0);
    return out;
  }, [face, tint?.state, tint?.zones.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const full: RickPose = {...base};
  if (troll && face) { const r: ReactionDraw | null = reactionDraw(spec, face, 8, draw); if (r) { r.tint = tint ? tintCv : null; r.tintK = tint ? tint.k : 0; full.troll = r; } }
  if (tint && !(troll && face)) full.tint = tint.zones.map((zone) => ({state: tint.state, zone, k: tint.k}));
  const outfit = useMemo(() => { const tex = makeTex(CW * K, CH * K, () => undefined); return {canvas: tex.image as HTMLCanvasElement, tex}; }, []);
  const c = outfit.canvas.getContext('2d')!; c.setTransform(K, 0, 0, K, 0, 0); drawOutfit(c, role, full, yaw); outfit.tex.needsUpdate = true;
  const w = CW * PXM * s, h = CH * PXM * s, cy = (GROUND - CH / 2) * PXM * s;
  return (
    <group>
      <Rick kind={kind} pose={full} p={p} cam={cam} s={s} />
      <group position={p} rotation={[0, yaw, 0]}><group rotation={[-cardTilt(cam, p, s), 0, 0]}>
        <mesh position={[0, cy, 0.012 * s]} renderOrder={2}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={outfit.tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group></group>
    </group>
  );
};
export type {FaceName};
void C;
