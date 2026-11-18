// rickRig: self-contained "stick cartoon" character for WalkTest only (reference: reference/w_*.png, sheet_*.png).
// Not related to Ruri / RuriX / limbs.ts. No glow, no curved limbs.
//  - Flat 2D card (canvas) for head, torso, arms and legs, thick black outline on head + torso, flat off-white with a very soft shade.
//  - Legs: long black lines, each ONE smooth cubic from hip to ankle (straight standing, one gentle arc <= 10 % of the leg length when stepping). No knee hinge.
//  - Arms: thin, nearly straight lines with a small bend, round hand cap.
//  - Feet: NO drawn shoe. Each ankle gets a real 3D line segment (thin cylinder mesh) pointing along the character's own forward direction,
//    so it foreshortens and rotates with the camera / the walk direction. That is the 3D cue.
//  - Faces: simple procedural cel faces (hard-cut by the caller), or a troll face (reactionFace.tsx canvases) with a head colour tint.
// Proportions on the 900x1000 card (1 px = 2.1 mm): head 26-28 % of the total height, legs 55 %, torso a small capsule.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, makeTex, shared} from './kit';
import type {ReactionDraw} from './reactionFace';
import {ActiveTint, TINT_COLORS} from './tint';
import {SHAPES} from './data/shapes';

export const CW = 900, CH = 1000, CX = 450, GROUND = 975;
export const PXM = 0.0021; // metres per card px at scale 1
const K = 1.5; // canvas raster scale
export const TORSO_BOTTOM = 600; // bottom edge of the torso card
export const LEG_ROOT = 0.91; // legs start INSIDE the torso at 91 % of its height (9 % above the bottom edge), arms at 18 % (shoulders)
export const HIP_Y = 290 + Math.round(LEG_ROOT * 310), LEG = 975 - HIP_Y, ARM = 240; // HIP_Y = 572 = leg roots and the pivot of the body; LEG = root to ground (the legs below the torso are still 375 px)
export const LEG_BEND = 0.10; // single-arc leg bend: max sideways offset of the curve = 10 % of the leg length at bend = 1
export const ARM_BEND_MAX = 0.12; // max sideways offset of an arm curve as a fraction of its chord
export const COSTUME_FILLS = false; // false = every head AND torso is pure white (#FFFFFF); costumes are shown by details only. true = coloured jumpsuits (Build.torso)
const INK = '#120a14', SKIN = '#FFFFFF', LIMB = '#231A28', SHADE = '#DDE5EC';
export const SKIN_FILL = SKIN;
const torsoFill = (b: {torso: string}) => (COSTUME_FILLS ? b.torso : SKIN);
export const LIMB_W = 18.2, OUT_W = 9, HAND_R = 18.9; // limbs +35 % (2026-11-16): 18.2 card px = about 1.9 % of a 1080 wide frame for the cop at depth 2.8; hands and feet scale with it (was 13.5 / 14 / foot 0.14 m) // 13.5 card px = about 15 px on a 1080 wide frame for the cop at depth 2.8, fov 66 (1.4 % of the frame width)
export const FOOT_LEN = 0.19, FOOT_R = (LIMB_W * 0.0021) / 2; // foot line: same thickness as the leg, short, round end cap (metres at scale 1)

export type Kind = 'cop' | 'prisoner' | 'tall' | `c${number}`; // c1, c2, ... = generated characters (`genBuild`), any number
export const FACE_LIBRARY = ['annoyed', 'grimace', 'teeth', 'shock', 'fear', 'deadpan', 'smug', 'happyArc', 'sad', 'confused', 'thrilled', 'disgusted'] as const;
export type FaceName = (typeof FACE_LIBRARY)[number];

// ---------------------------------------------------------------- character build + HEAD-SHAPE GENERATOR
// Every character = a Build: head shape (seeded parameters), torso shape (seeded), gear (hair / cap) and outfit. Hand-drawn look: no mirrored superellipses.
export type Gear = 'cap' | 'curls' | 'spikes' | 'bald' | 'tuft';
export type Outfit = 'police' | 'badge' | 'sash' | 'plain' | 'stripes';
export type BaseShape = 'egg' | 'oval' | 'pear' | 'squarish' | 'wideLow' | 'tallNarrow' | 'heart' | 'round';
export interface HeadShape {
  base: BaseShape; n: number; // superellipse exponent of the base silhouette
  egg: number; // width modulation along the height (+ = wider at the bottom: egg / pear, - = wider at the top: heart)
  flatSide: 1 | -1; flat: number; // which side (+1 = card-right) is flatter and how much (0..1)
  chin: number; // sideways offset of the chin (px)
  fhAng: number; fhAmp: number; fhW: number; // forehead bump (angle in rad, canvas orientation: 1.5 pi = top), amplitude (fraction of the radius), width
  chAng: number; chAmp: number; chW: number; // cheek bulge
  tilt: number; shear: number; // tilt of the widest point (rad) and sideways slant
  lump: number; seed: number; // low-frequency lumps, fraction of the radius
}
export interface TorsoShape { seed: number; pinchAt: number; pinchAmp: number; bellySide: 1 | -1; bellyAt: number; bellyAmp: number; bellyW: number; lump: number; slopeL: number; slopeR: number; flare: number }
/** A drawn silhouette (characters/shapes/headN.svg, bodyN.svg via scripts/build_shapes.mjs) with per-character variation: index, horizontal flip, aspect scale. */
export interface ShapeRef { idx: number; flip: boolean; sx: number }
export const DRAWN_SHAPES = true; // false = the procedural generator only (fallback)
export interface FacialSpec { mustache?: {kind: 'handlebar' | 'walrus' | 'pencil'; color: string}; beard?: {kind: 'full' | 'goatee' | 'chops'; color: string}; glasses?: {kind: 'round' | 'square'; color: string}; earrings?: string }
export interface Build { facial?: FacialSpec; persona?: 'm' | 'f' | 'c' | 'e'; hs?: ShapeRef; bs?: ShapeRef; rx: number; ry: number; cy: number; tw: number; top: number; th: number; tr: number; torso: string; head: HeadShape; tshape: TorsoShape; gear: Gear; outfit: Outfit; faceDy: number }
const mulberry = (a: number) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const BASES: BaseShape[] = ['egg', 'oval', 'pear', 'squarish', 'wideLow', 'tallNarrow', 'heart', 'round'];
const BASE_SPEC: Record<BaseShape, {aspect: number; ry: number; n: number; egg: number}> = { // aspect = width / height before the deformation
  egg: {aspect: 0.74, ry: 134, n: 2, egg: 0.16}, oval: {aspect: 0.62, ry: 142, n: 2, egg: 0.04}, pear: {aspect: 0.86, ry: 128, n: 2, egg: 0.3}, squarish: {aspect: 1.1, ry: 118, n: 3.8, egg: 0.03},
  wideLow: {aspect: 1.24, ry: 108, n: 2.4, egg: 0.06}, tallNarrow: {aspect: 0.55, ry: 152, n: 2.2, egg: 0.05}, heart: {aspect: 0.92, ry: 126, n: 2, egg: -0.2}, round: {aspect: 1.04, ry: 122, n: 2, egg: -0.06},
};
const PALETTE = ['#86b0ea', '#9bc7a8', '#e8b9a0', '#d9a8e0', '#f2d27a', '#a8d8d0', '#e08a8a', '#b9b9e8'];
const GEARS: Gear[] = ['curls', 'spikes', 'cap', 'tuft', 'bald'], OUTFITS: Outfit[] = ['badge', 'sash', 'stripes', 'plain', 'police'];
// Per-character shape assignment (head: idx into headN.svg, flip, aspect scale; body likewise). The first 8 are hand-assigned so no two characters share (shape, flip, scale); more characters get the golden-ratio scale.
const HS_TABLE: [number, boolean, number][] = [[0, true, 1.1], [1, false, 0.9], [2, true, 0.85], [0, false, 1.25], [1, true, 1.2], [2, false, 0.8], [0, true, 0.85], [1, false, 1.15]];
const BS_TABLE: [number, boolean, number][] = [[1, true, 0.85], [0, false, 0.88], [1, false, 1.18], [0, true, 1.15], [1, true, 1.12], [0, false, 1.3], [1, false, 0.82], [0, true, 0.75]];
const pickShape = (t: [number, boolean, number][], n: number, count: number): ShapeRef => { if (n <= t.length) { const e = t[n - 1]; return {idx: e[0] % count, flip: e[1], sx: e[2]}; } const g = (n * 0.618034) % 1; return {idx: n % count, flip: n % 2 === 0, sx: Math.round((0.75 + g * 0.55) * 100) / 100}; };
/** Fit the Build to its drawn shapes: head width = aspect x scale x head height; torso width = aspect x scale x torso height. Falls back to the procedural numbers when no shapes are loaded. */
function applyShapes(b: Build): Build {
  if (!DRAWN_SHAPES) return b;
  if (b.hs && SHAPES.heads.length) b.rx = Math.round(SHAPES.heads[b.hs.idx % SHAPES.heads.length].aspect * b.hs.sx * b.ry * 10) / 10;
  if (b.bs && SHAPES.bodies.length) { b.tw = Math.round(SHAPES.bodies[b.bs.idx % SHAPES.bodies.length].aspect * b.bs.sx * b.th); b.tr = Math.min(72, Math.round(b.tw * 0.32)); }
  return b;
}
/** Generated character n >= 1: seeded head and torso parameters and a different base silhouette (egg, long oval, pear, squarish, wide-low, narrow-tall, heart, round: n cycles through them). */
export function genBuild(n: number): Build {
  const r = mulberry(1000 + n * 7919), base = BASES[(n - 1) % BASES.length], sp = BASE_SPEC[base], j = (a: number) => (r() - 0.5) * 2 * a;
  const ry = Math.round(sp.ry + j(6)), rx = Math.round(ry * (sp.aspect + j(0.05))), tw = Math.round(136 + r() * 88), pick = r() < 0.5 ? 1 : -1;
  const head: HeadShape = {
    base, n: sp.n, egg: sp.egg + j(0.03), flatSide: pick as 1 | -1, flat: 0.3 + r() * 0.35, chin: j(14),
    fhAng: 1.5 * Math.PI + j(0.45), fhAmp: 0.03 + r() * 0.04, fhW: 0.3 + r() * 0.2, chAng: (r() < 0.5 ? 0.25 : 0.75) * Math.PI, chAmp: 0.03 + r() * 0.04, chW: 0.35 + r() * 0.15,
    tilt: j(0.07), shear: j(0.06), lump: 0.02 + r() * 0.012, seed: 1 + r() * 9,
  };
  const tshape: TorsoShape = { seed: 1 + r() * 9, pinchAt: 0.5 + r() * 0.12, pinchAmp: 0.035 + r() * 0.045, bellySide: r() < 0.5 ? 1 : -1, bellyAt: 0.66 + r() * 0.12, bellyAmp: 0.05 + r() * 0.07, bellyW: 0.12 + r() * 0.08, lump: 0.03 + r() * 0.02, slopeL: j(0.1), slopeR: j(0.1), flare: j(0.08) };
  const gear = GEARS[Math.floor(r() * GEARS.length)], outfit = OUTFITS[Math.floor(r() * OUTFITS.length)];
  return applyShapes({rx, ry, cy: 330 - ry, tw, top: 290, th: 310, tr: Math.min(72, Math.round(tw * 0.32)), torso: PALETTE[(n - 1) % PALETTE.length], head, tshape, gear, outfit, faceDy: gear === 'cap' ? 14 : gear === 'curls' ? 8 : 0, hs: pickShape(HS_TABLE, n, 3), bs: pickShape(BS_TABLE, n, 2)});
}
// Named characters: hand-set parameters. cop = about 1.16 x wider than tall (was 1.36), squarish with a flat left side, off-centre chin, forehead bump and right cheek bulge.
export const BUILD: Record<'cop' | 'prisoner' | 'tall', Build> = {
  cop: {hs: {idx: 2, flip: false, sx: 1.05}, bs: {idx: 1, flip: false, sx: 1.0}, rx: 132, ry: 114, cy: 218, tw: 224, top: 290, th: 310, tr: 72, torso: SKIN, gear: 'cap', outfit: 'police', faceDy: 14,
    head: {base: 'squarish', n: 2.6, egg: 0.04, flatSide: -1, flat: 0.5, chin: 12, fhAng: 1.4 * Math.PI, fhAmp: 0.05, fhW: 0.35, chAng: 0.25 * Math.PI, chAmp: 0.045, chW: 0.4, tilt: -0.05, shear: 0.06, lump: 0.03, seed: 1.7},
    tshape: {seed: 1.7, pinchAt: 0.56, pinchAmp: 0.04, bellySide: 1, bellyAt: 0.74, bellyAmp: 0.08, bellyW: 0.15, lump: 0.035, slopeL: 0.07, slopeR: -0.03, flare: 0.05}},
  prisoner: {hs: {idx: 0, flip: false, sx: 0.95}, bs: {idx: 0, flip: false, sx: 1.1}, rx: 106, ry: 138, cy: 192, tw: 156, top: 290, th: 310, tr: 70, torso: '#86b0ea', gear: 'curls', outfit: 'badge', faceDy: 8, // thin tube torso (blue jumpsuit as in the frames)
    head: {base: 'egg', n: 2, egg: 0.16, flatSide: 1, flat: 0.4, chin: -10, fhAng: 1.6 * Math.PI, fhAmp: 0.04, fhW: 0.35, chAng: 0.75 * Math.PI, chAmp: 0.04, chW: 0.4, tilt: 0.06, shear: -0.05, lump: 0.028, seed: 4.1},
    tshape: {seed: 4.1, pinchAt: 0.6, pinchAmp: 0.045, bellySide: -1, bellyAt: 0.72, bellyAmp: 0.07, bellyW: 0.14, lump: 0.032, slopeL: -0.06, slopeR: 0.08, flare: -0.06}},
  tall: {hs: {idx: 1, flip: true, sx: 0.78}, bs: {idx: 0, flip: true, sx: 0.9}, rx: 84, ry: 152, cy: 178, tw: 136, top: 290, th: 310, tr: 60, torso: '#9bc7a8', gear: 'spikes', outfit: 'sash', faceDy: 0, // test head: proves the system takes a third silhouette
    head: {base: 'tallNarrow', n: 2.2, egg: 0.05, flatSide: -1, flat: 0.35, chin: 8, fhAng: 1.45 * Math.PI, fhAmp: 0.05, fhW: 0.3, chAng: 0.25 * Math.PI, chAmp: 0.04, chW: 0.4, tilt: -0.07, shear: 0.08, lump: 0.03, seed: 7.3},
    tshape: {seed: 7.3, pinchAt: 0.5, pinchAmp: 0.03, bellySide: 1, bellyAt: 0.7, bellyAmp: 0.06, bellyW: 0.14, lump: 0.035, slopeL: 0.09, slopeR: -0.07, flare: 0.04}},
};
for (const k of ['cop', 'prisoner', 'tall'] as const) applyShapes(BUILD[k]);
const GEN: Record<string, Build> = {};
/** The Build of any character: named, or `c<n>` generated (cached). */
export const build = (k: Kind): Build => (k in BUILD ? BUILD[k as 'cop'] : (GEN[k] ??= genBuild(parseInt(k.slice(1), 10))));
/** Head centre height above the ground in metres (for framing checks), at scale 1. */
export const headHeight = (k: Kind) => (GROUND - build(k).cy) * PXM;
const RAD: Record<string, number> = {};
/** Radius of the smallest origin-centred circle around the actual head outline (metres at scale 1). */
export const headRadius = (k: Kind) => (RAD[k] ??= Math.max(...headPts(k, 96).map((q) => Math.hypot(q[0], q[1]))) * PXM);

export interface RickPose {
  fwd: [number, number]; // unit world direction (x, z) the character faces / walks to; feet point this way
  legSw: [number, number]; // leg swing angle (rad) along fwd, + = foot ahead. index 0 = card-left leg
  legOut?: [number, number]; // sideways spread (rad), + = toward card right
  bend?: [number, number]; // 0..1 single-arc leg bend (1 = sideways offset 10 % of the leg length); 0 = straight. No knee, no corner
  toe: [number, number]; // foot pitch (rad), + = toe up
  armSw: [number, number]; // arm swing (rad) along fwd
  hands?: ([number, number] | null)[]; // absolute card-px hand targets (override armSw), index 0 = card-left arm
  lean: number; // torso lean (rad), + = to card right, about the hips
  headRoll: number; headDx: number; headDy: number; // head tilt / offset from the neck (card px)
  headPitch?: number; // head pitch (rad, + = looks up). Omitted = 0 = the old pose. Face features AND the 3D hat / hair gear share ONE affine (`pitchAffine`), see KIT RULES v9
  torsoFwd?: [number, number]; // world direction the torso faces (default fwd); the torso turns after the head
  headFwd?: [number, number]; // world direction the head faces (default torsoFwd); head turns first
  bounce?: Bounce; // secondary motion of the torso card (kit/bounce.ts): vertical bob, squash / stretch, rocking, head lag
  handsZ?: [number | null, number | null]; // depth of the hand targets (card px along the card normal, + toward the camera); default: from the arm swing
  limbs3?: {legs: [C3, C3]; arms: [C3, C3]}; // explicit 3D limb curves in card-local px (sitting poses); overrides solve
  face: FaceName;
  tint?: ActiveTint[]; // head tints active this frame (kit/tint.ts, narration-driven); none = a white head, the default
  crouch?: number; // 0..1: both legs shorten (the hips drop, the knees bend forward); 0 = standing
  troll: ReactionDraw | null;
  shade: {color: string; k: number} | null;
}
export const REST: RickPose = {fwd: [0, 1], legSw: [0, 0], toe: [0, 0], armSw: [0, 0], lean: 0, headRoll: 0, headDx: 0, headDy: 0, face: 'deadpan', troll: null, shade: null};

// ---------------------------------------------------------------- facing (FACING / PHYSICS, see STYLE_NOTES)
// Every character has facing angles measured against the CAMERA: 0 = faces the camera, +-90 deg = profile (+ = faces card-right), 180 deg = back to the camera.
// `fwd` = feet / walking direction, `torsoFwd` = torso, `headFwd` = head (all world x,z). Everything (feet lines, torso width, tie / badge, arm placement, face) derives from these.
export const DEG = Math.PI / 180;
export const FRONT_MAX = 60 * DEG, SIDE_MAX = 105 * DEG; // |head yaw| < 60: front face (the card follows the camera up to 60 deg, kit rule 2026-11-17); 60-105: side face; > 105: back of the head
export const wrapAng = (a: number) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
/** Facing angle of a world direction against the camera, given the card yaw (= yawTo(cam, pos)). The card normal points at the camera, the card right axis is (cos, -sin). */
export const facingYaw = (dir: [number, number], cardYaw: number) => Math.atan2(dir[0] * Math.cos(cardYaw) - dir[1] * Math.sin(cardYaw), dir[0] * Math.sin(cardYaw) + dir[1] * Math.cos(cardYaw));
export const torsoYaw = (p: RickPose, cardYaw: number) => facingYaw(p.torsoFwd ?? p.fwd, cardYaw);
export const headYaw = (p: RickPose, cardYaw: number) => facingYaw(p.headFwd ?? p.torsoFwd ?? p.fwd, cardYaw);
export type HeadView = 'front' | 'side' | 'back';
export const headView = (yaw: number): HeadView => { const a = Math.abs(wrapAng(yaw)); return a < FRONT_MAX ? 'front' : a <= SIDE_MAX ? 'side' : 'back'; };
/** Unit world direction of the foot line at the end of leg i (the line mesh in `Rick`): along `fwd`, pitched by `toe`. Never points backward by construction. */
export const footDir = (p: RickPose, i: number): [number, number, number] => { const t = p.toe[i], cs = Math.cos(t), v: [number, number, number] = [p.fwd[0] * cs, Math.sin(t), p.fwd[1] * cs], l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------------------------------------------------------- solve
type P2 = [number, number];
export type P3 = [number, number, number]; // card-local 3D px: x right, y DOWN (as the card), z toward the camera (along the card normal)
export type C3 = [P3, P3, P3, P3]; // one limb = one cubic bezier
export interface Bounce { dy: number; sx: number; sy: number; rock: number; headDy: number } // px up(-)/down(+), scale, rad, px
export const NO_BOUNCE: Bounce = {dy: 0, sx: 1, sy: 1, rock: 0, headDy: 0};
export interface Solved {
  hipY: number; // hip height on the card (px), the lowest ankle stands on GROUND
  hip: P2[]; legCtl: [P2, P2][]; ankle: P2[]; // each leg = ONE cubic bezier hip -> ankle with these two control points (card px)
  sh: P2[]; armCtl: [P2, P2][]; hand: P2[]; // each arm = ONE cubic bezier shoulder -> hand, in the (lean-rotated) body frame
}
export const shoulderX = (b: Build) => b.tw * 0.38; // arm roots: 18 % below the top of the torso, inset 12 % on each side
export const shoulderY = (b: Build) => b.top + 0.18 * b.th;
export const hipX = (b: Build) => b.tw * 0.22; // leg roots: 91 % down the torso (9 % above its bottom edge), inset 28 % on each side
export function solve(kind: Kind, p: RickPose, yaw: number): Solved {
  const b = build(kind), fx = p.fwd[0] * Math.cos(yaw) - p.fwd[1] * Math.sin(yaw); // forward projected on the card's right axis
  const ft = p.fwd[0] * Math.sin(yaw) + p.fwd[1] * Math.cos(yaw); // forward projected on the card normal (+ = toward the camera)
  const wsc = Math.max(0.22, Math.abs(Math.cos(torsoYaw(p, yaw)))); // torso yaw: shoulders and hips come together toward profile
  const rel: P2[] = [], kc: [P2, P2][] = [];
  let maxY = 0;
  for (let i = 0; i < 2; i++) {
    const bendH = Math.min(1, Math.max(0, p.bend?.[i] ?? 0)) * LEG_BEND * LEG, ch = LEG * (1 - (8 / 3) * (bendH / LEG) ** 2) * (1 - 0.5 * (p.crouch ?? 0)), sw = p.legSw[i], out = p.legOut?.[i] ?? 0; // arc length stays LEG: a bent leg is a little shorter in chord
    // DEPTH LIFT: a foot swung along fwd toward / away from the camera (ft = fwd . card normal) lands lower / higher on screen. 0.22 = sin(camera elevation): camera 0.8 m above a floor point 3.5 m away.
    const v: P2 = [ch * (Math.sin(sw) * fx + Math.sin(out)), ch * Math.cos(sw) * Math.cos(out)]; // (no depth-lift hack any more: the legs are real 3D tubes and the camera does the perspective)
    rel.push(v); maxY = Math.max(maxY, v[1]);
    const l = Math.hypot(v[0], v[1]) || 1, q = (4 / 3) * bendH, s0 = fx >= 0 ? 1 : -1; // both control points offset by 4/3 h => the curve peaks at h
    let n: P2 = [v[1] / l, -v[0] / l]; if (n[0] * s0 < 0) n = [-n[0], -n[1]];
    kc.push([[v[0] / 3 + n[0] * q, v[1] / 3 + n[1] * q], [(2 * v[0]) / 3 + n[0] * q, (2 * v[1]) / 3 + n[1] * q]]);
  }
  const hipY = GROUND - maxY, hx = hipX(b) * wsc;
  const hip: P2[] = [[CX - hx, hipY], [CX + hx, hipY]];
  const legCtl = hip.map((h, i) => [[h[0] + kc[i][0][0], h[1] + kc[i][0][1]], [h[0] + kc[i][1][0], h[1] + kc[i][1][1]]] as [P2, P2]), ankle = hip.map((h, i) => [h[0] + rel[i][0], h[1] + rel[i][1]] as P2);
  const sh: P2[] = [[CX - shoulderX(b) * wsc, shoulderY(b)], [CX + shoulderX(b) * wsc, shoulderY(b)]], armCtl: [P2, P2][] = [], hand: P2[] = [];
  const cl = Math.cos(p.lean), sl = Math.sin(p.lean), dMin = ARM / (1 + (8 / 3) * ARM_BEND_MAX ** 2); // the shortest chord that keeps the arc offset <= 12 % of the chord
  for (let i = 0; i < 2; i++) {
    const S = sh[i], o = i === 0 ? -1 : 1;
    let T: P2;
    const ov = p.hands?.[i];
    if (ov) { const bn = p.bounce ?? NO_BOUNCE, l = p.lean + bn.rock, cl2 = Math.cos(l), sl2 = Math.sin(l), dx = ov[0] - CX, dy = ov[1] - hipY - bn.dy; T = [CX + (dx * cl2 + dy * sl2) / bn.sx, HIP_Y + (-dx * sl2 + dy * cl2) / bn.sy]; } // card px -> body frame (undo the bounce, the lean and the hip drop)
    else T = [S[0] + o * 14 * wsc + 0.985 * ARM * Math.sin(p.armSw[i]) * fx, S[1] + 0.985 * ARM * Math.cos(p.armSw[i])];
    // depth of the hand relative to the shoulder (px): the arm is a curve in 3D, so its reach is limited by the 3D chord
    const zr = BASE_Z + (i === 0 ? 1 : -1) * shoulderX(b) * Math.sin(torsoYaw(p, yaw)), dzz = (p.handsZ?.[i] ?? zr + (p.hands?.[i] ? 0 : 0.985 * ARM * Math.sin(p.armSw[i]) * ft)) - zr;
    let vx = T[0] - S[0], vy = T[1] - S[1], d = Math.hypot(vx, vy) || 1;
    const dd = Math.min(Math.sqrt(Math.max(0, (ARM * 0.995) ** 2 - dzz * dzz)), Math.max(JOINTS ? 60 : Math.sqrt(Math.max(0, dMin * dMin - dzz * dzz)), d)); // one gentle arc: 3D chord between dMin and 0.995 x arm length
    vx *= dd / d; vy *= dd / d; d = dd;
    const d3 = Math.hypot(d, dzz), h = d3 * Math.sqrt(Math.max(0, (3 * (ARM / d3 - 1)) / 8)), q = (4 / 3) * h; // arc length ARM -> peak offset h
    let n: P2 = [vy / d, -vx / d]; if (n[0] * o < 0) n = [-n[0], -n[1]]; // the arc bows away from the body
    armCtl.push([[vx / 3 + n[0] * q, vy / 3 + n[1] * q], [(2 * vx) / 3 + n[0] * q, (2 * vy) / 3 + n[1] * q]]); hand.push([S[0] + vx, S[1] + vy]);
  }
  for (let i = 0; i < 2; i++) armCtl[i] = [[sh[i][0] + armCtl[i][0][0], sh[i][1] + armCtl[i][0][1]], [sh[i][0] + armCtl[i][1][0], sh[i][1] + armCtl[i][1][1]]];
  return {hipY, hip, legCtl, ankle, sh, armCtl, hand};
}

/** The four limb curves of a solved pose as cubic beziers [p0, p1, p2, p3]: legs first, then arms. */
export const limbCurves = (s: Solved): [P2, P2, P2, P2][] => [0, 1].map((i) => [s.hip[i], s.legCtl[i][0], s.legCtl[i][1], s.ankle[i]] as [P2, P2, P2, P2]).concat([0, 1].map((i) => [s.sh[i], s.armCtl[i][0], s.armCtl[i][1], s.hand[i]] as [P2, P2, P2, P2]));
/** Max curvature (1 / px) and max sideways offset from the chord (px) of a cubic bezier, sampled. */
export function bezierStats(c: [P2, P2, P2, P2]): {kappa: number; offset: number; chord: number} {
  const [p0, p1, p2, p3] = c, chord = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) || 1, ux = (p3[0] - p0[0]) / chord, uy = (p3[1] - p0[1]) / chord;
  let kappa = 0, offset = 0;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, m = 1 - t;
    const x1 = 3 * m * m * (p1[0] - p0[0]) + 6 * m * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]), y1 = 3 * m * m * (p1[1] - p0[1]) + 6 * m * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const x2 = 6 * m * (p2[0] - 2 * p1[0] + p0[0]) + 6 * t * (p3[0] - 2 * p2[0] + p1[0]), y2 = 6 * m * (p2[1] - 2 * p1[1] + p0[1]) + 6 * t * (p3[1] - 2 * p2[1] + p1[1]);
    const sp = Math.hypot(x1, y1) || 1; kappa = Math.max(kappa, Math.abs(x1 * y2 - y1 * x2) / (sp * sp * sp));
    const bx = m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], by = m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1];
    offset = Math.max(offset, Math.abs((bx - p0[0]) * -uy + (by - p0[1]) * ux));
  }
  return {kappa, offset, chord};
}

// ---------------------------------------------------------------- faces (reference face style: reference/sheet_06, sheet_10, sheet_11, w_096)
// Thick black angled brows, small eyes (open circle + pupil dot, half-lid, wide-open ring, closed arc), short mouth line, teeth grid for anger,
// small open "o" for shock, pink cheek blush when happy. Hard cuts between them (the caller picks `RickPose.face`).
type EyeKind = 'open' | 'half' | 'wide' | 'arc';
type MouthKind = 'line' | 'frown' | 'teeth' | 'smile' | 'o' | 'wavy' | 'smirk' | 'open' | 'sour';
interface FaceDef { brow: number; browY?: number; eye: EyeKind; mouth: MouthKind; blush?: boolean; sweat?: boolean }
// brow = degrees, + = inner end down (angry), - = inner end up (worried / surprised)
export const FACES: Record<FaceName, FaceDef> = {
  annoyed: {brow: 12, eye: 'half', mouth: 'frown'},
  grimace: {brow: 16, eye: 'open', mouth: 'wavy'},
  teeth: {brow: 24, eye: 'open', mouth: 'teeth'},
  shock: {brow: -6, browY: -14, eye: 'wide', mouth: 'o'},
  fear: {brow: -20, browY: -10, eye: 'wide', mouth: 'wavy', sweat: true},
  deadpan: {brow: 2, eye: 'half', mouth: 'line'},
  smug: {brow: 8, browY: -4, eye: 'half', mouth: 'smirk'},
  happyArc: {brow: -4, eye: 'arc', mouth: 'smile', blush: true},
  sad: {brow: -20, browY: -2, eye: 'open', mouth: 'frown'}, // inner brow ends up, small frown
  confused: {brow: -8, browY: -8, eye: 'open', mouth: 'wavy'},
  thrilled: {brow: -10, browY: -10, eye: 'wide', mouth: 'open', blush: true}, // wide eyes, big open smile with a tongue
  disgusted: {brow: 14, browY: 2, eye: 'half', mouth: 'sour'}, // squint, wrinkled mouth, tongue out
};
interface FaceOpts { ox?: number; one?: boolean; dir?: number; k?: number; persona?: 'm' | 'f' | 'c' | 'e' } // ox = lateral shift of the whole face (head turned), one = side face (single eye/brow), dir = +1 faces card-right, k = feature spacing / mouth width squash
function drawFace(c: CanvasRenderingContext2D, f: FaceDef, rx: number, ry: number, o: FaceOpts = {}): void {
  const ox = o.ox ?? 0, one = !!o.one, dir = o.dir ?? 1, k = o.k ?? 1;
  const s = Math.max(0.8, Math.min(1.2, rx / 118)), ex = 0.34 * rx * k, ey = 0.02 * ry, by = ey - 34 * s + (f.browY ?? 0), my = 0.5 * ry, sides = one ? [dir] : [-1, 1], at = (q: number) => (one ? 0 : q * ex);
  c.save(); c.translate(ox, 0);
  c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.blush) { c.fillStyle = 'rgba(245,110,150,0.62)'; for (const q of sides) { c.beginPath(); c.ellipse(at(q) + q * 16 * s * (one ? 0.3 : 1), ey + 36 * s, 18 * s, 11 * s, 0, 0, 7); c.fill(); } c.fillStyle = INK; }
  for (const q of sides) { // brows: thick black, angled, slight arch
    c.save(); c.translate(at(q), by); c.rotate((q * f.brow * Math.PI) / 180); c.lineWidth = 13 * s * (o.persona === 'f' || o.persona === 'c' ? 0.78 : 1); c.beginPath(); c.moveTo(-35 * s, 1 * s); c.quadraticCurveTo(0, -6 * s, 35 * s, 1 * s); c.stroke(); c.restore(); // bigger, thicker brows (readable at 9:16)
  }
  for (const q of sides) { // eyes
    const x = at(q);
    if (f.eye === 'open') { c.fillStyle = '#fff'; c.lineWidth = 4 * s; c.beginPath(); c.arc(x, ey, 13 * s, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x + (one ? dir * 3 * s : 0), ey + 1 * s, 5.5 * s, 0, 7); c.fill(); }
    else if (f.eye === 'half') { // lower half-disc with pupil under a thick flat lid
      const lid = ey - 2 * s; c.fillStyle = '#fff'; c.lineWidth = 4 * s; c.beginPath(); c.arc(x, lid, 15 * s, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
      c.save(); c.beginPath(); c.arc(x, lid, 15 * s, 0, Math.PI); c.closePath(); c.clip(); c.fillStyle = INK; c.beginPath(); c.arc(x + (one ? dir * 4 * s : 1 * s), lid + 3 * s, 7 * s, 0, 7); c.fill(); c.restore();
      c.lineWidth = 7 * s; c.beginPath(); c.moveTo(x - 19 * s, lid); c.lineTo(x + 19 * s, lid); c.stroke();
    }
    else if (f.eye === 'wide') { c.fillStyle = '#fff'; c.lineWidth = 5 * s; c.beginPath(); c.arc(x, ey, 20 * s, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x + (one ? dir * 5 * s : 0), ey, 4.5 * s, 0, 7); c.fill(); }
    else { c.lineWidth = 7 * s; c.beginPath(); c.arc(x, ey + 7 * s, 15 * s, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); } // closed arc
  }
  { // PERSONA details (kit 2026-11-17): f = lashes + lips, c = bigger eyes feel (round pink cheeks), e = wrinkles, heavy lids, eye bags
    const ps = o.persona ?? 'm';
    if (ps === 'f') for (const q of sides) { const x = at(q), lw = 6 * s; c.lineWidth = lw; c.beginPath(); c.arc(x, ey, 14 * s, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); for (let i = 0; i < 3; i++) { const a = (Math.PI * (1.62 + i * 0.12)) * (q < 0 ? 1 : 1), dxs = q * (one ? dir : 1); void a; c.lineWidth = 3.4 * s; c.beginPath(); c.moveTo(x + q * (12 + i * 2) * s * (one ? 0 : 1) + (one ? dir * (9 + i * 2) * s : 0), ey - (6 - i * 3) * s); c.lineTo(x + q * (22 + i * 3) * s * (one ? 0 : 1) + (one ? dir * (16 + i * 3) * s : 0), ey - (14 + i * 3 - i * 2) * s); c.stroke(); void dxs; } }
    if (ps === 'c') { c.fillStyle = 'rgba(245,110,150,0.45)'; for (const q of sides) { c.beginPath(); c.ellipse(at(q) + q * 18 * s * (one ? 0.3 : 1), ey + 38 * s, 24 * s, 15 * s, 0, 0, 7); c.fill(); } c.fillStyle = INK; }
    if (ps === 'e') { c.lineWidth = 3.4 * s; c.strokeStyle = INK; for (const q of sides) { const x = at(q); c.beginPath(); c.arc(x, ey + 6 * s, 17 * s, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); c.beginPath(); c.arc(x, ey - 2 * s, 18 * s, Math.PI * 1.1, Math.PI * 1.9); c.lineWidth = 6 * s; c.stroke(); c.lineWidth = 3.4 * s; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + q * 22 * s, ey - 4 * s + i * 7 * s); c.lineTo(x + q * 34 * s, ey - 8 * s + i * 10 * s); c.stroke(); } } for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, by - 18 * s - i * 11 * s, 34 * s - i * 4 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); } c.beginPath(); c.arc(-28 * s, my - 6 * s, 24 * s, Math.PI * 0.55, Math.PI * 0.95); c.stroke(); c.beginPath(); c.arc(28 * s, my - 6 * s, 24 * s, Math.PI * 0.05, Math.PI * 0.45); c.stroke(); }
  }
  c.save(); c.translate(one ? dir * 0.04 * rx : 0, 0); c.scale(one ? 0.65 : Math.max(0.6, k), 1); c.translate(0, my); c.scale(1.3, 1.3); c.translate(0, -my); // mouths 30 % bigger // mouth: narrower in a side face / turned head
  c.lineWidth = 6 * s; c.fillStyle = INK; if (o.persona === 'f') c.strokeStyle = '#7A1F35';
  if (f.mouth === 'line') { c.beginPath(); c.moveTo(-17 * s, my); c.lineTo(17 * s, my); c.stroke(); }
  else if (f.mouth === 'o') { c.fillStyle = '#5a1620'; c.lineWidth = 5 * s; c.beginPath(); c.ellipse(0, my, 9 * s, 12 * s, 0, 0, 7); c.fill(); c.stroke(); }
  else if (f.mouth === 'frown') { c.beginPath(); c.arc(0, my + 14 * s, 20 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
  else if (f.mouth === 'smile') { c.beginPath(); c.arc(0, my - 14 * s, 26 * s, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
  else if (f.mouth === 'smirk') { c.beginPath(); c.moveTo(-14 * s, my + 2 * s); c.quadraticCurveTo(10 * s, my + 10 * s, 24 * s, my - 8 * s); c.stroke(); }
  else if (f.mouth === 'wavy') { c.beginPath(); c.moveTo(-26 * s, my); for (let i = 0; i < 5; i++) c.lineTo(-26 * s + (i + 1) * 10.4 * s, my + (i % 2 ? 0 : 9 * s)); c.stroke(); }
  else if (f.mouth === 'open') { c.fillStyle = '#5a1620'; c.lineWidth = 5 * s; c.beginPath(); c.moveTo(-26 * s, my - 8 * s); c.quadraticCurveTo(0, my - 2 * s, 26 * s, my - 8 * s); c.quadraticCurveTo(22 * s, my + 30 * s, 0, my + 30 * s); c.quadraticCurveTo(-22 * s, my + 30 * s, -26 * s, my - 8 * s); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#E8667E'; c.beginPath(); c.ellipse(0, my + 22 * s, 12 * s, 8 * s, 0, 0, 7); c.fill(); }
  else if (f.mouth === 'sour') { c.beginPath(); c.moveTo(-24 * s, my + 4 * s); c.quadraticCurveTo(-10 * s, my - 8 * s, 0, my + 2 * s); c.quadraticCurveTo(10 * s, my - 8 * s, 24 * s, my + 4 * s); c.stroke(); c.fillStyle = '#E8667E'; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(-8 * s, my + 3 * s); c.quadraticCurveTo(-8 * s, my + 22 * s, 0, my + 22 * s); c.quadraticCurveTo(8 * s, my + 22 * s, 8 * s, my + 3 * s); c.closePath(); c.fill(); c.stroke(); }
  else if (f.mouth === 'teeth') { // teeth grid for anger
    const w = 70 * s, h = 34 * s; c.fillStyle = '#fff'; c.lineWidth = 5 * s; c.beginPath(); c.roundRect(-w / 2, my - h / 2, w, h, 8 * s); c.fill(); c.stroke();
    c.lineWidth = 3 * s; c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(-w / 2 + (w * i) / 5, my - h / 2); c.lineTo(-w / 2 + (w * i) / 5, my + h / 2); } c.moveTo(-w / 2, my); c.lineTo(w / 2, my); c.stroke();
  }
  if (o.persona === 'f' && (f.mouth === 'line' || f.mouth === 'smile' || f.mouth === 'smirk' || f.mouth === 'frown')) { c.fillStyle = '#E26A86'; c.beginPath(); c.ellipse(0, my + (f.mouth === 'smile' ? 4 : 7) * s, 9 * s, 3.6 * s, 0, 0, 7); c.fill(); } // small lower lip
  c.restore();
  if (f.sweat) { c.fillStyle = '#9fd8f5'; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(rx * 0.78, -ry * 0.3); c.quadraticCurveTo(rx * 0.95, -ry * 0.05, rx * 0.78, ry * 0.02); c.quadraticCurveTo(rx * 0.6, -ry * 0.05, rx * 0.78, -ry * 0.3); c.fill(); c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- head shapes, relief shadow, gear (hair / cap)
/** Low-frequency noise in [-amp, amp]: three harmonics with seeded phases, periodic over t in [0, 1) so it closes around a head. Fixed per character: no jitter between frames. */
export const lowNoise = (seed: number, t: number, amp: number) => amp * (0.6 * Math.sin(2 * Math.PI * (t + seed * 0.37)) + 0.3 * Math.sin(2 * Math.PI * (2 * t + seed * 0.71)) + 0.1 * Math.sin(2 * Math.PI * (3 * t + seed * 0.13)));
/** Head lumps: harmonics 2..5 with seeded phases (periodic), |value| <= amp. */
const lumps = (seed: number, t: number, amp: number) => { let v = 0, a = 0; for (let h = 2; h <= 5; h++) { const w = 1 / h; v += w * Math.sin(2 * Math.PI * (h * t + seed * (0.31 + 0.17 * h))); a += w; } return (amp * v) / a; };
export const SHAPE_NOISE = 0.025; // old uniform outline deformation (kept for the check): fraction of the radius
const smin = (a: number, b: number, k: number) => (a + b - Math.sqrt((a - b) * (a - b) + k * k)) / 2; // smooth min: flattens one side into a soft vertical edge
const gauss = (t: number, a: number, w: number) => Math.exp(-((wrapAng(t - a) / w) ** 2));
/** Head outline points around the head centre (card px). Asymmetric and lumpy by construction: flatter side, off-centre chin, forehead bump, cheek bulge, tilt, lumps. Deterministic. */
export function headPts(kind: Kind, n = 72): P2[] {
  const b = build(kind);
  if (DRAWN_SHAPES && b.hs && SHAPES.heads.length) { // MY drawn silhouette: bbox-normalised, height 2 ry, width aspect x scale, neck = bottom centre; a seeded deformation of at most 3 %
    const d = SHAPES.heads[b.hs.idx % SHAPES.heads.length], o: P2[] = [], m = d.pts.length;
    for (let i = 0; i < n; i++) { const f = (i / n) * m, i0 = Math.floor(f), u = f - i0, a = d.pts[i0 % m], c2 = d.pts[(i0 + 1) % m], px = a[0] + (c2[0] - a[0]) * u, py = a[1] + (c2[1] - a[1]) * u, k = 1 + lumps(b.head.seed, i / n, 0.03); o.push([(b.hs.flip ? -1 : 1) * px * 2 * b.ry * b.hs.sx * k, (py - 0.5) * 2 * b.ry * k]); }
    return o;
  }
  const sh = b.head, o: P2[] = [], e = 2 / sh.n, L = b.rx * (1 + Math.max(0, sh.egg) * 0.5) * (1 - 0.22 * sh.flat), ct = Math.cos(sh.tilt), st = Math.sin(sh.tilt);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
    let x = b.rx * Math.sign(cs) * Math.abs(cs) ** e, y = b.ry * Math.sign(sn) * Math.abs(sn) ** e;
    x *= 1 + sh.egg * sn; // y points down: sn > 0 is the lower half
    x = sh.flatSide > 0 ? smin(x, L, 0.07 * b.rx) : -smin(-x, L, 0.07 * b.rx); // one side flatter
    x += sh.chin * Math.max(0, sn) ** 2 + sh.shear * b.rx * (y / b.ry); // chin off centre, slant
    const k = 1 + sh.fhAmp * gauss(t, sh.fhAng, sh.fhW) + sh.chAmp * gauss(t, sh.chAng, sh.chW) + lumps(sh.seed, i / n, sh.lump);
    x *= k; y *= k;
    o.push([x * ct - y * st, x * st + y * ct]);
  }
  return o;
}
/** Torso outline: a long tube with rounded ends, per character: waist pinch, uneven belly on one side, shoulder slopes, flare, lumps on each side. Fixed per character. */
export function torsoPts(kind: Kind, wT: number): P2[] {
  const b = build(kind);
  if (DRAWN_SHAPES && b.bs && SHAPES.bodies.length) { // MY drawn torso silhouette: width wT (narrower in profile), height th from `top`; a seeded deformation of at most 3 %
    const d = SHAPES.bodies[b.bs.idx % SHAPES.bodies.length];
    return d.pts.map((p, i) => [CX + (b.bs!.flip ? -1 : 1) * (p[0] / d.aspect) * wT * (1 + lumps(b.tshape.seed, i / d.pts.length, 0.03)), b.top + p[1] * b.th] as P2);
  }
  const ts = b.tshape, K = 48, r = Math.min(b.tr, wT / 2), L: P2[] = [], R: P2[] = [];
  for (let i = 0; i <= K; i++) {
    const t = i / K, y = b.top + t * b.th, d = Math.min(y - b.top, b.top + b.th - y);
    const hw0 = d < r ? wT / 2 - r + Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))) : wT / 2;
    const pinch = -ts.pinchAmp * Math.exp(-(((t - ts.pinchAt) / 0.12) ** 2)), bg = Math.exp(-(((t - ts.bellyAt) / ts.bellyW) ** 2)), top = Math.max(0, 1 - t / 0.3), bot = Math.max(0, (t - 0.8) / 0.2);
    const sl = ts.bellySide < 0 ? 1 : 0.3, sr = ts.bellySide > 0 ? 1 : 0.3;
    L.push([CX - hw0 * (1 + pinch + sl * ts.bellyAmp * bg + ts.slopeL * top + ts.flare * bot + lowNoise(ts.seed, t * 0.5, ts.lump)), y]);
    R.push([CX + hw0 * (1 + pinch + sr * ts.bellyAmp * bg + ts.slopeR * top - ts.flare * bot + lowNoise(ts.seed + 2.3, t * 0.5, ts.lump)), y]);
  }
  return L.concat(R.reverse());
}
// ---- silhouette comparison (pure maths, no canvas): XOR area / union area after aligning the centroids, on a 3 px grid
const polyArea = (p: P2[]) => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; } a /= 2; return {a, cx: cx / (6 * a), cy: cy / (6 * a)}; };
const inPoly = (poly: P2[], x: number, y: number) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], d = poly[j]; if ((a[1] > y) !== (d[1] > y) && x < ((d[0] - a[0]) * (y - a[1])) / (d[1] - a[1]) + a[0]) r = !r; } return r; };
export function polyDiff(A: P2[], B: P2[], align = true): number {
  const ca = polyArea(A), cb = polyArea(B), da: P2 = align ? [ca.cx, ca.cy] : [0, 0], db: P2 = align ? [cb.cx, cb.cy] : [0, 0];
  const a = A.map((q) => [q[0] - da[0], q[1] - da[1]] as P2), b = B.map((q) => [q[0] - db[0], q[1] - db[1]] as P2), all = a.concat(b);
  const x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0])), y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]));
  let u = 0, x = 0;
  for (let yy = y0; yy <= y1; yy += 3) for (let xx = x0; xx <= x1; xx += 3) { const ia = inPoly(a, xx, yy), ib = inPoly(b, xx, yy); if (ia || ib) { u++; if (ia !== ib) x++; } }
  return u ? x / u : 0;
}
/** Left / right asymmetry: XOR of the outline and its mirror about the vertical line through the centroid, over the union (0 = perfectly symmetric). */
export const mirrorDiff = (A: P2[]) => polyDiff(A, A.map((q) => [-q[0], q[1]] as P2));
const torsoPath2D = (kind: Kind, wT: number): Path2D => { const p = new Path2D(); torsoPts(kind, wT).forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };
const headPath2D = (kind: Kind): Path2D => { const p = new Path2D(), pts = headPts(kind); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };

// RELIEF SHADOW: soft translucent cool-gray (#C9CFDD, about 50 %) crescent hugging the LOWER-LEFT / bottom diagonal of the inner edge, clipped by the caller to the shape.
// Light comes from the upper right (the scene sun is at +x, see WalkTest), so the shadow side is lower-left. Built as (everything) minus (the shape shifted toward the light).
export const RELIEF_COLOR = 'rgba(18,14,30,0.30)'; // DARK translucent shadow (soft near-black, 30 %), lower-RIGHT crescent, light from the upper left (fix round 2026-11-17: it was a light grey crescent)
export const RELIEF_K = 0.19; // head shift as a fraction of rx / ry; tuned so the crescent is about 15-20 % of the head area (see reliefFraction)
/** CHANNEL CARD LIGHT (kit default off = GlintGaze / GlintWorld unchanged). A channel with a rim / fill look (FocoProibido) calls `setCardLight` once at module load of its video:
 *  the dark relief becomes the channel shadow colour (purple, never black), a thin warm rim hugs the LEFT edge of every head / torso / clothes card, a soft fill tints the RIGHT side. Skin stays pure white. */
export const CARD_LIGHT: {on: boolean; shadow: string; rim: string; fill: string} = {on: false, shadow: RELIEF_COLOR, rim: 'rgba(255,170,90,0.85)', fill: 'rgba(108,66,184,0.22)'};
export const setCardLight = (o: Partial<typeof CARD_LIGHT> | null) => { Object.assign(CARD_LIGHT, o ?? {on: false, shadow: RELIEF_COLOR}); if (o === null) CARD_LIGHT.on = false; };
export const relief = (c: CanvasRenderingContext2D, shape: Path2D, dx: number, dy: number, blur: number, color: string) => {
  const draw = (ddx: number, ddy: number, bl: number, col: string) => { const p = new Path2D(), sh = new Path2D(); p.rect(-3000, -3000, 6000, 6000); sh.addPath(shape, new DOMMatrix().translate(ddx, ddy)); p.addPath(sh); c.save(); c.clip(shape); c.filter = `blur(${bl}px)`; c.fillStyle = col; c.fill(p, 'evenodd'); c.restore(); };
  if (CARD_LIGHT.on && color === RELIEF_COLOR) { draw(dx, dy, blur, CARD_LIGHT.shadow); draw(dx * 1.3, 0, blur + 4, CARD_LIGHT.fill); draw(Math.max(3, Math.abs(dx) * 0.4), 0, 1.5, CARD_LIGHT.rim); return; } // purple shadow + purple fill on the right + warm rim on the left
  draw(dx, dy, blur, color);
};
/** Fraction of the head polygon covered by the crescent (numeric check, no canvas needed). */
export function reliefFraction(kind: Kind, k = RELIEF_K): number {
  const b = build(kind), pts = headPts(kind, 120), sh = pts.map((q) => [q[0] - k * b.rx, q[1] - k * b.ry] as P2);
  const inside = (poly: P2[], x: number, y: number) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], d = poly[j]; if ((a[1] > y) !== (d[1] > y) && x < ((d[0] - a[0]) * (y - a[1])) / (d[1] - a[1]) + a[0]) r = !r; } return r; };
  let tot = 0, cr = 0;
  for (let y = -b.ry * 1.1; y < b.ry * 1.1; y += 2) for (let x = -b.rx * 1.2; x < b.rx * 1.2; x += 2) if (inside(pts, x, y)) { tot++; if (!inside(sh, x, y)) cr++; }
  return cr / tot;
}
function headRelief(c: CanvasRenderingContext2D, kind: Kind, hp: Path2D, color = RELIEF_COLOR): void {
  const b = build(kind);
  relief(c, hp, -RELIEF_K * b.rx, -RELIEF_K * b.ry, Math.max(5, 0.3 * RELIEF_K * b.rx * 2), color); // LIGHT FROM THE UPPER LEFT (kit default 2026-11-16): crescent on the lower-right, feathered edge
}

/** Hair / cap outline per kind and head view. `sil` = pure ink silhouette (everything INK). dir = +1 head faces card-right (side view only). */
function drawGear(c: CanvasRenderingContext2D, kind: Kind, b: Build, hp: Path2D, sil: boolean, view: HeadView = 'front', dir = 1): void {
  const F = (col: string) => (sil ? INK : col);
  const spikes = (): void => {
    const pt = (a: number, r: number): P2 => [Math.cos(a) * b.rx * r, Math.sin(a) * b.ry * r], a0 = Math.PI * 1.1, a1 = Math.PI * 1.9, N = 5;
    c.beginPath(); let q = pt(a0, 0.98); c.moveTo(q[0], q[1]);
    for (let j = 0; j < N; j++) { const am = a0 + ((j + 0.5) / N) * (a1 - a0), ae = a0 + ((j + 1) / N) * (a1 - a0); q = pt(am, 1.3); c.lineTo(q[0], q[1]); q = pt(ae, 0.98); c.lineTo(q[0], q[1]); }
    q = pt(a1, 0.8); c.lineTo(q[0], q[1]); q = pt(a0, 0.8); c.lineTo(q[0], q[1]); c.closePath();
    c.fillStyle = F('#5a3a22'); c.fill(); c.strokeStyle = INK; c.lineWidth = 12; c.lineJoin = 'round'; c.stroke();
  };
  const tuft = (): void => { c.fillStyle = F('#5a3a22'); c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.ellipse(-0.1 * b.rx, -b.ry * 0.98, b.rx * 0.3, b.ry * 0.17, -0.25, 0, 7); c.fill(); c.stroke(); };
  if (view === 'back') { // BACK OF THE HEAD: no face, hair covers the head (cap from behind)
    if (b.gear === 'cap') {
      c.fillStyle = F('#4b3322'); c.fill(hp);
      c.save(); c.clip(hp); c.fillStyle = F('#1d2b52'); c.fillRect(-b.rx - 10, -b.ry - 10, b.rx * 2 + 20, b.ry * 1.18 + 10); c.restore(); // cap crown down to y = +0.18 ry
      c.strokeStyle = INK; c.lineWidth = OUT_W; c.beginPath(); c.moveTo(-b.rx * 0.97, b.ry * 0.18); c.quadraticCurveTo(0, b.ry * 0.3, b.rx * 0.97, b.ry * 0.18); c.stroke(); // cap rim at the nape
      c.stroke(hp);
    } else if (b.gear === 'curls') { // curls all the way round
      const pts = headPts(kind, 22), cs = pts.map((q, i) => [q[0] * 0.97, q[1] * 0.97, 17 + (i % 2) * 3] as [number, number, number]); // curls ring the head: only a little bigger than the head (about 1.15x), not 1.5x
      c.strokeStyle = INK; c.lineWidth = 11; for (const q of cs) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.stroke(); }
      c.fillStyle = F('#b8541d'); for (const q of cs) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); }
      c.fill(hp);
    } else if (b.gear === 'bald') { c.strokeStyle = INK; c.lineWidth = OUT_W; c.stroke(hp); } // bald: just the back of the head
    else { c.fillStyle = F('#5a3a22'); c.fill(hp); c.strokeStyle = INK; c.lineWidth = OUT_W; c.stroke(hp); if (b.gear === 'spikes') spikes(); else tuft(); }
    return;
  }
  if (b.gear === 'cap') { // flat cap with a brim (front view: brim bar across; side view: brim sticks out toward the facing side)
    c.save(); c.clip(hp); c.fillStyle = F('#1d2b52'); c.fillRect(-b.rx - 10, -b.ry - 10, b.rx * 2 + 20, b.ry * 0.55 + 10); c.restore();
    c.strokeStyle = INK; c.lineWidth = OUT_W; c.beginPath(); c.moveTo(-b.rx * 0.96, -b.ry * 0.45); c.lineTo(b.rx * 0.96, -b.ry * 0.45); c.stroke();
    c.beginPath(); if (view === 'side') c.roundRect(dir > 0 ? -b.rx * 0.1 : -b.rx * 1.3, -b.ry * 0.49, b.rx * 1.4, 20, 10); else c.roundRect(-b.rx * 0.9, -b.ry * 0.49, b.rx * 2.1, 20, 10); c.fillStyle = F('#14203f'); c.fill(); c.stroke();
    c.strokeStyle = INK; c.lineWidth = OUT_W; c.stroke(hp);
    if (!sil && view === 'front') { c.fillStyle = '#e8b830'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? 7 : 16; c.lineTo(Math.cos(a) * rr, -b.ry * 0.75 + Math.sin(a) * rr); } c.closePath(); c.fill(); }
  } else if (b.gear === 'curls') { // curly hair: scallops, black outline around the union
    const cs: [number, number, number][] = []; for (let i = 0; i < 8; i++) { const a = Math.PI * (1.08 + (i * 0.84) / 7); cs.push([Math.cos(a) * b.rx * 0.92, Math.sin(a) * b.ry * 0.92, 36 + (i % 2) * 6]); }
    c.strokeStyle = INK; c.lineWidth = 16; for (const q of cs) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.stroke(); }
    c.fillStyle = F('#b8541d'); for (const q of cs) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); }
  } else if (b.gear === 'spikes') spikes(); // a spiky brush of 5 triangular spikes along the top
  else if (b.gear === 'tuft') tuft(); // one curl on top
  // bald: nothing
}

/** Narration-driven head tint: a colour GRADIENT inside the head (clipped to the outline, never a flat fill) in one zone: cheeks | around-eyes | forehead | upper-half | full.
 *  Zones follow the face (head turned / side view). Intensity k = 0..1 (already eased by `tintAt`). Skin stays white unless a tint row exists. */
function paintTint(c: CanvasRenderingContext2D, b: Build, hp: Path2D, view: HeadView, yaw: number, t: ActiveTint): void {
  if (view === 'back' && t.zone !== 'full') return;
  const col = TINT_COLORS[t.state], rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${(a * t.k).toFixed(3)})`;
  const w = wrapAng(yaw), dir = w >= 0 ? 1 : -1, one = view === 'side', ox = view === 'front' ? Math.sin(w) * b.rx * 0.5 : dir * 0.5 * b.rx, kk = view === 'front' ? Math.max(0.55, Math.cos(w)) : 1;
  const s = Math.max(0.8, Math.min(1.2, b.rx / 118)), ex = 0.34 * b.rx * kk, ey = b.faceDy + 0.02 * b.ry, xs = one ? [ox] : [ox - ex, ox + ex];
  c.save(); c.clip(hp);
  const lin = (y0: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col2]) => g.addColorStop(o, col2)); c.fillStyle = g; c.fillRect(-b.rx * 1.6, -b.ry * 1.6, b.rx * 3.2, b.ry * 3.2); };
  const blob = (x: number, y: number, r: number) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col[1], 0.95)); g.addColorStop(0.55, rgba(col[0], 0.5)); g.addColorStop(1, rgba(col[0], 0)); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
  if (t.zone === 'full') lin(-b.ry, b.ry, [[0, rgba(col[0], 0.9)], [0.55, rgba(col[1], 0.8)], [1, rgba(col[2], 0.55)]]);
  else if (t.zone === 'upper-half') lin(-b.ry, 0.12 * b.ry, [[0, rgba(col[1], 0.95)], [0.6, rgba(col[0], 0.6)], [1, rgba(col[0], 0)]]);
  else if (t.zone === 'forehead') lin(-b.ry, -0.3 * b.ry, [[0, rgba(col[1], 0.95)], [1, rgba(col[0], 0)]]);
  else for (const x of xs) { if (t.zone === 'around-eyes') blob(x, ey, 0.36 * b.rx); else blob(x + (one ? 0 : Math.sign(x - ox) * 16 * s), ey + 36 * s, 0.3 * b.rx); }
  c.restore();
}


// ---------------------------------------------------------------- 2D FACE PROPS (kit 2026-11-17): mustache, beard, glasses, earrings are drawn on the face card, clipped to the head silhouette, same ink outline.
// They follow the face art (shift ox and squeeze k of the turned head) and are not drawn in the back view or while a swapped face is on.
function drawFacial(c: CanvasRenderingContext2D, b: Build, hp: Path2D, view: HeadView, yaw: number, dir: number, layer: 'under' | 'over'): void {
  const f = b.facial; if (!f || view === 'back') return;
  const rx = b.rx, ry = b.ry, s = Math.max(0.8, Math.min(1.2, rx / 118)), one = view === 'side', w = wrapAng(yaw), ox = one ? dir * 0.5 * rx : Math.sin(w) * rx * 0.5, k = one ? 0.5 : Math.max(0.55, Math.cos(w));
  c.save(); c.clip(hp); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  if (layer === 'under' && f.beard) { // jaw beard: the region between the head outline and an inner curve that passes under the mouth
    const col = f.beard.color, kd = f.beard.kind, sx = one ? 0.7 : 1, tx = one ? dir * 0.12 * rx : ox * 0.45;
    c.save(); c.translate(tx, 0); c.scale(sx, 1); c.fillStyle = col; c.lineWidth = 6 * s;
    const inner = (): void => { c.moveTo(-0.9 * rx, 0.02 * ry); c.bezierCurveTo(-0.8 * rx, 0.28 * ry, -0.74 * rx, 0.5 * ry, -0.46 * rx, 0.67 * ry); c.quadraticCurveTo(0, 0.78 * ry, 0.46 * rx, 0.67 * ry); c.bezierCurveTo(0.74 * rx, 0.5 * ry, 0.8 * rx, 0.28 * ry, 0.9 * rx, 0.02 * ry); };
    if (kd === 'goatee') { c.beginPath(); c.ellipse(0, 0.84 * ry, 0.3 * rx, 0.16 * ry, 0, 0, 7); c.fill(); c.stroke(); }
    else {
      c.beginPath(); inner(); c.lineTo(1.4 * rx, 0.02 * ry); c.lineTo(1.4 * rx, kd === 'chops' ? 0.62 * ry : 1.4 * ry); if (kd === 'chops') { c.lineTo(0.62 * rx, 0.62 * ry); c.lineTo(-0.62 * rx, 0.62 * ry); } else c.lineTo(-1.4 * rx, 1.4 * ry); c.lineTo(-1.4 * rx, kd === 'chops' ? 0.62 * ry : 0.02 * ry); c.lineTo(-1.4 * rx, 0.02 * ry); c.closePath(); c.fill();
      c.beginPath(); inner(); c.stroke(); // ink line along the inner edge
    }
    c.restore();
  }
  if (layer === 'over') {
    if (f.mustache) { // under the nose, above the mouth
      const m = f.mustache, th = 12 * s, wd = rx * (m.kind === 'pencil' ? 0.46 : 0.58), y = 0.36 * ry;
      c.save(); c.translate(ox + (one ? dir * 0.1 * rx : 0), y); c.scale(k, 1); c.fillStyle = m.color; c.lineWidth = 5 * s; c.beginPath();
      if (m.kind === 'handlebar') { c.moveTo(0, -2 * s); c.bezierCurveTo(wd * 0.25, -th, wd * 0.62, th * 0.4, wd * 0.9, -th * 0.5); c.bezierCurveTo(wd * 1.02, -th * 1.5, wd * 0.92, -th * 1.9, wd * 0.8, -th * 1.5); c.bezierCurveTo(wd * 0.74, -th * 0.9, wd * 0.5, th * 1.1, 0, th * 0.6); c.bezierCurveTo(-wd * 0.5, th * 1.1, -wd * 0.74, -th * 0.9, -wd * 0.8, -th * 1.5); c.bezierCurveTo(-wd * 0.92, -th * 1.9, -wd * 1.02, -th * 1.5, -wd * 0.9, -th * 0.5); c.bezierCurveTo(-wd * 0.62, th * 0.4, -wd * 0.25, -th, 0, -2 * s); }
      else if (m.kind === 'walrus') { const t2 = th * 1.2; c.moveTo(0, -t2 * 0.5); c.bezierCurveTo(wd * 0.5, -t2 * 0.9, wd * 0.95, -t2 * 0.3, wd, t2 * 1.4); c.bezierCurveTo(wd * 0.7, t2 * 0.5, wd * 0.35, t2 * 0.6, 0, t2 * 0.3); c.bezierCurveTo(-wd * 0.35, t2 * 0.6, -wd * 0.7, t2 * 0.5, -wd, t2 * 1.4); c.bezierCurveTo(-wd * 0.95, -t2 * 0.3, -wd * 0.5, -t2 * 0.9, 0, -t2 * 0.5); }
      else { c.moveTo(0, -th * 0.5); c.bezierCurveTo(wd * 0.5, -th * 0.6, wd, -th * 0.4, wd, th * 0.1); c.bezierCurveTo(wd * 0.6, th * 0.5, wd * 0.2, th * 0.4, 0, th * 0.3); c.bezierCurveTo(-wd * 0.2, th * 0.4, -wd * 0.6, th * 0.5, -wd, th * 0.1); c.bezierCurveTo(-wd, -th * 0.4, -wd * 0.5, -th * 0.6, 0, -th * 0.5); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    if (f.glasses) { // two rings on the eyes, a bridge and temple arms to the head edge
      const g = f.glasses, ey = 0.02 * ry + 1, ex = 0.34 * rx * k, rr = 0.24 * rx, sides = one ? [dir] : [-1, 1];
      c.save(); c.strokeStyle = g.color; c.lineWidth = 6 * s; c.fillStyle = 'rgba(255,255,255,0.18)';
      for (const q of sides) { const x = one ? ox : ox + q * ex; c.beginPath(); if (g.kind === 'round') c.ellipse(x, ey, rr * Math.max(0.7, k), rr, 0, 0, 7); else c.roundRect(x - rr * Math.max(0.7, k), ey - rr * 0.8, rr * 2 * Math.max(0.7, k), rr * 1.6, 8 * s); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x + q * rr * Math.max(0.7, k), ey - rr * 0.15); c.lineTo(q * rx * 1.05 * (one ? -1 : 1), ey - rr * 0.1); c.stroke(); }
      if (!one) { c.beginPath(); c.moveTo(ox - ex + rr * Math.max(0.7, k), ey - rr * 0.2); c.lineTo(ox + ex - rr * Math.max(0.7, k), ey - rr * 0.2); c.stroke(); }
      c.restore();
    }
    if (f.earrings && !one) { c.fillStyle = f.earrings; c.lineWidth = 3 * s; for (const q of [-1, 1]) { c.beginPath(); c.arc(q * 0.9 * rx * Math.max(0.6, k) + ox * 0.5, 0.16 * ry, 7 * s, 0, 7); c.fill(); c.stroke(); } }
  }
  c.restore();
}
/** HEAD PITCH (KIT RULES v9). The head art is a flat card, so a nod is a cartoon move done with affines that are SHARED by everything that belongs to the head:
 *  - HEAD UNIT = silhouette (skin, relief, outline) + 2D gear + the 3D hat / hair meshes of `HeadGear`: all foreshortened toward the NECK (head bottom, y = ry) by the same affine y' = ry + (y - ry) * sy, sy = cos(pitch). The head never detaches
 *    from the body and the hat / hair stay exactly seated on the crown (brim at the brow, hair on the head) at every pitch;
 *  - FACE FEATURES (and 2D facial props) additionally glide on that head unit by `slide` (up when looking up, down when looking down). The upward glide is small (`PITCH_UP`) so the brows never reach the brim or the fringe; the face checks in
 *    `headgear.tsx` (`motionRow`) verify that at pitch -35 / -20 / +20 / +35 with roll and yaw.
 *  Nothing is rotated in true 3D: a real rotation of a hat mesh over a flat face card is what made hats float off and fringes cover the face.
 *  `pa.sil` = offset of the head unit (card px, down +), `pa.sy` = vertical scale, `pa.slide` = extra offset of the features (card px, down +). Estimates, untested against a reference: `PITCH_UP` 0.05, `PITCH_DOWN` 0.10, `PITCH_MAX` 40 deg. */
export const PITCH_UP = 0.05, PITCH_DOWN = 0.1, PITCH_MAX = (40 * Math.PI) / 180;
export const clampPitch = (pitch: number): number => Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch));
export const pitchAffine = (ry: number, pitch: number): {sy: number; sil: number; slide: number} => { const q = clampPitch(pitch), sy = Math.cos(q); return {sy, sil: ry * (1 - sy), slide: -Math.sin(q) * (q > 0 ? PITCH_UP : PITCH_DOWN) * ry}; };
/** Head, relief shadow, outline, hair/cap and face at the origin (the caller translates to the head centre). Not used for the troll face.
 *  `yaw` = head facing angle relative to the camera (rad): 0 faces the camera, +-90 deg profile (+ = faces card-right), 180 faces away.
 *  View: front (|yaw| < 75 deg: the only case where the full face is drawn), side (75-105: one eye, brow and a short mouth at the front edge), back (> 105: no face, hair / cap). */
export function drawHead(c: CanvasRenderingContext2D, kind: Kind, face: FaceName, yaw = 0, tints: ActiveTint[] = [], pitch = 0): {view: HeadView; faceDrawn: boolean} {
  const b = build(kind), hp = headPath2D(kind), view = headView(yaw), dir = wrapAng(yaw) >= 0 ? 1 : -1, pa = pitchAffine(b.ry, pitch);
  c.save(); c.translate(0, pa.sil); c.scale(1, pa.sy); // silhouette: foreshortened toward the neck
  c.fillStyle = SKIN; c.fill(hp);
  for (const t of tints) paintTint(c, b, hp, view, yaw, t);
  if (view !== 'back') { c.save(); headRelief(c, kind, hp); c.restore(); }
  c.strokeStyle = INK; c.lineWidth = OUT_W; c.lineJoin = 'round'; c.stroke(hp);
  c.restore();
  c.save(); c.translate(0, pa.sil); c.scale(1, pa.sy); drawGear(c, kind, b, hp, false, view, dir); c.restore(); // 2D gear = part of the head unit (same affine as the silhouette and the 3D gear)
  if (view === 'back') { c.save(); headRelief(c, kind, hp, 'rgba(18,14,30,0.22)'); c.restore(); return {view, faceDrawn: false}; }
  c.save(); c.translate(0, pa.sil + pa.slide); c.scale(1, pa.sy); c.translate(0, b.faceDy); // features: head-unit affine + the small glide
  drawFacial(c, b, hp, view, yaw, dir, 'under');
  if (view === 'front') drawFace(c, FACES[face], b.rx, b.ry, {ox: Math.sin(wrapAng(yaw)) * b.rx * 0.5, k: Math.max(0.55, Math.cos(wrapAng(yaw))), persona: b.persona});
  else drawFace(c, FACES[face], b.rx, b.ry, {ox: dir * 0.5 * b.rx, one: true, dir, persona: b.persona});
  drawFacial(c, b, hp, view, yaw, dir, 'over');
  c.restore();
  return {view, faceDrawn: true};
}

/** Pure black torso silhouette in card coordinates (CX, top ... top + th). */
export function drawTorsoSilhouette(c: CanvasRenderingContext2D, kind: Kind): void { const b = build(kind); c.fillStyle = INK; c.fill(torsoPath2D(kind, b.tw)); }
/** Pure black silhouette of head + hair/cap at the origin: proves the silhouettes differ. */
export function drawHeadSilhouette(c: CanvasRenderingContext2D, kind: Kind): void {
  const b = build(kind), hp = headPath2D(kind);
  c.fillStyle = INK; c.fill(hp); c.strokeStyle = INK; c.lineWidth = OUT_W; c.stroke(hp); drawGear(c, kind, b, hp, true);
}

const curve = (c: CanvasRenderingContext2D, a: P2, k: [P2, P2], e: P2, w: number) => { c.strokeStyle = LIMB; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(a[0], a[1]); c.bezierCurveTo(k[0][0], k[0][1], k[1][0], k[1][1], e[0], e[1]); c.stroke(); };
const line = (c: CanvasRenderingContext2D, pts: P2[], w: number) => { c.strokeStyle = INK; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); };

const HB: Record<string, {w: number; h: number}> = {};
const headBox = (k: Kind) => (HB[k] ??= (() => { const p = headPts(k, 96); return {w: Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])), h: Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]))}; })());
export interface DrawInfo { headView: HeadView; faceDrawn: boolean; trollDrawn: boolean; torsoYaw: number; headYaw: number }
export function drawRick(c: CanvasRenderingContext2D, kind: Kind, p: RickPose, s: Solved, cardYaw = 0, flatLimbs = true): DrawInfo {
  const b = build(kind), tY = torsoYaw(p, cardYaw), hY = headYaw(p, cardYaw), cosT = Math.cos(tY), sinT = Math.sin(tY), wT = b.tw * (0.38 + 0.62 * Math.abs(cosT)); // profile = narrow torso
  c.clearRect(0, 0, CW, CH);
  const L3 = flatLimbs ? p.limbs3 : undefined, c3 = (cv: C3) => { c.strokeStyle = LIMB; c.lineWidth = LIMB_W; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(cv[0][0], cv[0][1]); c.bezierCurveTo(cv[1][0], cv[1][1], cv[2][0], cv[2][1], cv[3][0], cv[3][1]); c.stroke(); };
  const flat3 = (near: boolean) => { if (!L3) return; for (const cv of [...L3.legs, ...L3.arms]) if ((cv[0][2] > 0) === near) { c3(cv); if (cv === L3.arms[0] || cv === L3.arms[1]) { c.fillStyle = LIMB; c.beginPath(); c.arc(cv[3][0], cv[3][1], HAND_R, 0, 7); c.fill(); } } }; // flat preview of explicit 3D limbs: far ones before the torso, near ones after
  flat3(false);
  if (flatLimbs && !L3) for (let i = 0; i < 2; i++) curve(c, s.hip[i], s.legCtl[i], s.ankle[i], LIMB_W);
  // body (torso + arms + head) rotates about the hips
  const bn = p.bounce ?? NO_BOUNCE;
  c.save(); c.translate(0, s.hipY - HIP_Y); c.translate(CX, HIP_Y); c.translate(0, bn.dy); c.rotate(p.lean + bn.rock); c.scale(bn.sx, bn.sy); c.translate(-CX, -HIP_Y); // the whole upper body drops with the hips (bob, bent knees)
  const tx = CX - wT / 2, torsoH = b.th, ty = b.top, torso = torsoPath2D(kind, wT);
  const arms = () => { for (let i = 0; i < 2; i++) { curve(c, s.sh[i], s.armCtl[i], s.hand[i], LIMB_W); c.fillStyle = INK; c.beginPath(); c.arc(s.hand[i][0], s.hand[i][1], HAND_R, 0, 7); c.fill(); } };
  const armsBehind = Math.abs(tY) > (100 * Math.PI) / 180; // back to the camera: the arms reach forward, so they sit behind the torso
  if (flatLimbs && !L3 && armsBehind) arms();
  c.save(); c.fillStyle = torsoFill(b); c.fill(torso); c.clip(torso);
  if (b.outfit === 'police') { c.fillStyle = INK; c.fillRect(tx - 12, ty + torsoH - 52, wT + 24, 24); } // belt goes all the way round (clipped by the outline)
  if (b.outfit === 'stripes') { c.fillStyle = SHADE; for (let k = 0; k < 5; k++) c.fillRect(tx - 12, ty + 40 + k * 56, wT + 24, 16); } // horizontal stripes all the way round
  if (cosT > 0.05) { // FRONT details (tie, buckle, badge, sash) slide toward the facing side and narrow with the yaw; none on the back
    c.save(); c.translate(CX + sinT * b.tw * 0.36, 0); c.scale(Math.max(0.2, cosT), 1); c.translate(-CX, 0);
    if (b.outfit === 'police') { // buckle + brown striped tie
      c.fillStyle = '#e8b830'; c.fillRect(CX - 14, ty + torsoH - 54, 28, 28);
      c.fillStyle = '#9a5a22'; c.beginPath(); c.moveTo(CX - 13, ty + 6); c.lineTo(CX + 13, ty + 6); c.lineTo(CX + 21, ty + torsoH - 70); c.lineTo(CX, ty + torsoH - 58); c.lineTo(CX - 21, ty + torsoH - 70); c.closePath(); c.fill();
      c.strokeStyle = '#d8a050'; c.lineWidth = 5; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(CX - 16, ty + 40 + k * 22); c.lineTo(CX + 16, ty + 26 + k * 22); c.stroke(); }
    } else if (b.outfit === 'badge') { c.fillStyle = '#fff'; c.fillRect(CX - 52, ty + 66, 42, 28); c.fillStyle = INK; c.fillRect(CX - 46, ty + 74, 30, 4); c.fillRect(CX - 46, ty + 83, 22, 4); } // badge
    else if (b.outfit === 'sash') { c.fillStyle = SHADE; c.fillRect(tx - 10, ty + 70, b.tw + 20, 24); } // a pale sash
    c.restore();
  }
  relief(c, torso, -0.075 * wT, -0.07 * b.th, 6, RELIEF_COLOR); // same dark relief as the head: lower-right edge of the torso
  c.restore();
  c.strokeStyle = INK; c.lineWidth = OUT_W; c.lineJoin = 'round'; c.stroke(torso);
  if (flatLimbs && !L3 && !armsBehind) arms();
  // head
  c.save(); c.translate(CX + p.headDx, b.cy + p.headDy + (bn.headDy - bn.dy)); c.rotate(p.headRoll);
  const view = headView(hY);
  let info: {view: HeadView; faceDrawn: boolean}, trollDrawn = false;
  if (p.troll && p.troll.face && view === 'front') { // the troll face is a face too: only when the head turns to the camera
    const r = p.troll, f = r.face!, hb = headBox(kind), F = Math.max((hb.w * 1.04) / f.vbW, (hb.h * 1.04) / f.vbH) /* the troll card covers the WHOLE head shape (bounding box + 4 %), no head art peeks out */, RS = f.bg.width / f.vbW;
    c.scale(r.flip ? -r.scale : r.scale, r.scale); c.translate((-f.vbW * F) / 2, (-f.vbH * F) / 2); c.scale(F / RS, F / RS);
    c.drawImage(f.bg, 0, 0); if (r.tint && r.tintK > 0) { c.globalAlpha = r.tintK; c.drawImage(r.tint, 0, 0); c.globalAlpha = 1; }
    c.drawImage(f.lines, 0, 0);
    const sy = 1 - 0.9 * r.blink;
    for (let i = 0; i < 2; i++) { const e = f.eyes[i]; c.save(); c.translate(e.cx, e.cy); c.scale(1, sy); c.translate(-e.cx, -e.cy); c.drawImage(e.cv, 0, 0); c.restore(); }
    info = {view, faceDrawn: true}; trollDrawn = true;
  } else info = drawHead(c, kind, p.face, hY, p.tint ?? [], p.headPitch ?? 0);
  c.restore(); c.restore();
  if (p.shade && p.shade.k > 0) { c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = p.shade.k; c.fillStyle = p.shade.color; c.fillRect(0, 0, CW, CH); c.restore(); } // gray-blue while in the door shadow
  flat3(true);
  return {headView: info.view, faceDrawn: info.faceDrawn, trollDrawn, torsoYaw: tY, headYaw: hY};
}

// ---------------------------------------------------------------- helpers (card px <-> world)
/** Body-frame point (arms, head) to card px (lean about the hips + hip drop). */
export const bodyToCard = (s: Solved, p: RickPose, q: P2): P2 => { // body frame -> card: squash / stretch, rock + lean about the hips, bob, hip drop (same order as drawRick)
  const bn = p.bounce ?? NO_BOUNCE, dx = (q[0] - CX) * bn.sx, dy = (q[1] - HIP_Y) * bn.sy, l = p.lean + bn.rock, cl = Math.cos(l), sl = Math.sin(l);
  return [CX + dx * cl - dy * sl, HIP_Y + bn.dy + dx * sl + dy * cl + (s.hipY - HIP_Y)];
};
export const headCard = (k: Kind, s: Solved, p: RickPose): P2 => { const bn = p.bounce ?? NO_BOUNCE; return bodyToCard(s, p, [CX + p.headDx, build(k).cy + p.headDy + (bn.headDy - bn.dy)]); };
export const cardToWorld = (q: P2, pos: V3, yaw: number, sc = 1): V3 => {
  const px = (q[0] - CX) * PXM * sc;
  return [pos[0] + Math.cos(yaw) * px, pos[1] + (GROUND - q[1]) * PXM * sc, pos[2] - Math.sin(yaw) * px];
};
export const worldToCard = (w: V3, pos: V3, yaw: number, sc = 1): P2 => {
  const dx = w[0] - pos[0], dz = w[2] - pos[2];
  return [CX + (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / (PXM * sc), GROUND - (w[1] - pos[1]) / (PXM * sc)];
};
export const yawTo = (cam: V3, pos: V3) => Math.atan2(cam[0] - pos[0], cam[2] - pos[2]);

// ---------------------------------------------------------------- 3D LIMBS (arms, legs, feet, hands are real tubes; only the head and torso are 2D cards)
export const BASE_Z = 14; // px: limbs sit a little in front of the card plane
/** Depth (card px along the card normal, + toward the camera) of every limb root and end. z = BASE_Z + sigma x span x sin(torso yaw): slot 0 is the character's OWN RIGHT limb (card-left when it faces the camera),
 *  which is the near one when the character faces card-right; so near-side limbs are in front of the card and far-side limbs behind it (real depth, tested against the card by the GPU). */
export function limbDepth(kind: Kind, p: RickPose, yaw: number): {legRoot: [number, number]; legEnd: [number, number]; armRoot: [number, number]; armEnd: [number, number]} {
  const b = build(kind), sinT = Math.sin(torsoYaw(p, yaw)), ft = p.fwd[0] * Math.sin(yaw) + p.fwd[1] * Math.cos(yaw);
  const legRoot: [number, number] = [BASE_Z + hipX(b) * sinT, BASE_Z - hipX(b) * sinT], armRoot: [number, number] = [BASE_Z + shoulderX(b) * sinT, BASE_Z - shoulderX(b) * sinT];
  const legEnd: [number, number] = [legRoot[0] + LEG * Math.sin(p.legSw[0]) * ft, legRoot[1] + LEG * Math.sin(p.legSw[1]) * ft];
  const armEnd: [number, number] = [p.handsZ?.[0] ?? armRoot[0] + (p.hands?.[0] ? 0 : 0.985 * ARM * Math.sin(p.armSw[0]) * ft), p.handsZ?.[1] ?? armRoot[1] + (p.hands?.[1] ? 0 : 0.985 * ARM * Math.sin(p.armSw[1]) * ft)];
  return {legRoot, legEnd, armRoot, armEnd};
}
/** Independent test of the near side: the character's own right is f x up; it is near the camera when its component along the card normal is positive. Used by the node checks. */
export const rightIsNear = (torsoFwd: [number, number], cardYaw: number) => -torsoFwd[1] * Math.sin(cardYaw) + torsoFwd[0] * Math.cos(cardYaw) > 0;
/** The six limb curves in card-local 3D px: legs 0-1, arms 2-3, feet 4-5. */
export function limbCurves3(kind: Kind, p: RickPose, s: Solved, yaw: number): C3[] {
  const lerpZ = (pts: P2[], z0: number, z3: number): C3 => pts.map((q, k) => [q[0], q[1], z0 + ((z3 - z0) * k) / 3]) as C3;
  let legs: [C3, C3], arms: [C3, C3];
  if (p.limbs3) { legs = p.limbs3.legs; arms = p.limbs3.arms; }
  else {
    const z = limbDepth(kind, p, yaw);
    legs = [0, 1].map((i) => lerpZ([s.hip[i], s.legCtl[i][0], s.legCtl[i][1], s.ankle[i]], z.legRoot[i], z.legEnd[i])) as [C3, C3];
    arms = [0, 1].map((i) => lerpZ([s.sh[i], s.armCtl[i][0], s.armCtl[i][1], s.hand[i]].map((q) => bodyToCard(s, p, q)), z.armRoot[i], z.armEnd[i])) as [C3, C3];
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), L = FOOT_LEN / PXM;
  const feet = [0, 1].map((i) => { const a = legs[i][3], fd = footDir(p, i), dR = fd[0] * cy - fd[2] * sy, dN = fd[0] * sy + fd[2] * cy, e: P3 = [a[0] + dR * L, a[1] - fd[1] * L, a[2] + dN * L]; return [a, [a[0] + (e[0] - a[0]) / 3, a[1] + (e[1] - a[1]) / 3, a[2] + (e[2] - a[2]) / 3], [a[0] + ((e[0] - a[0]) * 2) / 3, a[1] + ((e[1] - a[1]) * 2) / 3, a[2] + ((e[2] - a[2]) * 2) / 3], e] as C3; });
  return [legs[0], legs[1], arms[0], arms[1], feet[0], feet[1]];
}
/** Max curvature (1 / px), max sideways offset from the chord (px) and chord length of a 3D cubic. */
export function bezier3Stats(c: C3): {kappa: number; offset: number; chord: number} {
  const [p0, p1, p2, p3] = c, d = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]], chord = Math.hypot(d[0], d[1], d[2]) || 1, u = [d[0] / chord, d[1] / chord, d[2] / chord];
  let kappa = 0, offset = 0;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, m = 1 - t, B = (k: number) => m * m * m * p0[k] + 3 * m * m * t * p1[k] + 3 * m * t * t * p2[k] + t * t * t * p3[k];
    const d1 = [0, 1, 2].map((k) => 3 * m * m * (p1[k] - p0[k]) + 6 * m * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k])), d2 = [0, 1, 2].map((k) => 6 * m * (p2[k] - 2 * p1[k] + p0[k]) + 6 * t * (p3[k] - 2 * p2[k] + p1[k]));
    const cr = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]], sp = Math.hypot(d1[0], d1[1], d1[2]) || 1;
    kappa = Math.max(kappa, Math.hypot(cr[0], cr[1], cr[2]) / (sp * sp * sp));
    const r = [B(0) - p0[0], B(1) - p0[1], B(2) - p0[2]], al = r[0] * u[0] + r[1] * u[1] + r[2] * u[2]; offset = Math.max(offset, Math.hypot(r[0] - al * u[0], r[1] - al * u[1], r[2] - al * u[2]));
  }
  return {kappa, offset, chord};
}
export const cardLocalToWorld = (q: P3, pos: V3, yaw: number, sc = 1): V3 => { const k = PXM * sc, x = (q[0] - CX) * k, z = q[2] * k; return [pos[0] + Math.cos(yaw) * x + Math.sin(yaw) * z, pos[1] + (GROUND - q[1]) * k, pos[2] - Math.sin(yaw) * x + Math.cos(yaw) * z]; };
export const worldToCardLocal = (w: V3, pos: V3, yaw: number, sc = 1): P3 => { const k = PXM * sc, dx = w[0] - pos[0], dz = w[2] - pos[2]; return [CX + (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / k, GROUND - (w[1] - pos[1]) / k, (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / k]; };
/** World position of a hand ball (the end of arm i). */
export const handWorld = (kind: Kind, p: RickPose, s: Solved, yaw: number, i: number, pos: V3, sc = 1): V3 => cardLocalToWorld(limbCurves3(kind, p, s, yaw)[2 + i][3], pos, yaw, sc);

// ---------------------------------------------------------------- JOINTS (kit default 2026-11-17): 2-bone IK with a rounded bend
/** true = every walking / standing limb is ONE continuous tube that passes through an elbow / knee (2-bone IK, bend direction by a pole vector) with a round bend (radius about 1.75 x the tube thickness).
 *  false = the old single-arc limbs. Poses with explicit `limbs3` (sitting) keep their own cubic curves. */
export const JOINTS = true;
export const BEND_R = 1.75 * LIMB_W; // radius of the rounded bend in card px (1.5-2 x the tube thickness)
const _poly = new Float64Array(160 * 3);
/** Interior elbow / knee angle (rad) of a 2-bone limb whose ends are d apart (bones L each): pi = straight. */
export const jointAngle = (d: number, L: number) => Math.acos(Math.max(-1, Math.min(1, 1 - (d * d) / (2 * L * L))));
/** Joint point of a 2-bone limb S -> E -> H (bones L1 = L2 = L), the joint bends toward `pole`. Returns the joint and the interior angle. */
export function limbIK(S: P3, H: P3, L: number, pole: P3): {E: P3; angle: number} {
  const dx = H[0] - S[0], dy = H[1] - S[1], dz = H[2] - S[2], d = Math.hypot(dx, dy, dz) || 1e-6, ux = dx / d, uy = dy / d, uz = dz / d, dm = Math.min(d, 1.99 * L), h = Math.sqrt(Math.max(0, L * L - (dm / 2) * (dm / 2)));
  const pu = pole[0] * ux + pole[1] * uy + pole[2] * uz; let nx = pole[0] - pu * ux, ny = pole[1] - pu * uy, nz = pole[2] - pu * uz, nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-4) { nx = 0; ny = 0; nz = -1; nl = 1; }
  nx /= nl; ny /= nl; nz /= nl;
  return {E: [S[0] + dx / 2 + nx * h, S[1] + dy / 2 + ny * h, S[2] + dz / 2 + nz * h], angle: jointAngle(dm, L)}; // a limb is never reported straight: the chord is kept at 99.5 % of its length
}
/** One continuous path S -> E -> H with the corner at E rounded by a quadratic arc (radius ~ R; when the bend is gentle the arc simply gets longer), resampled to n + 1 points of equal arc length into `out`
 *  (x, y, z triples). Returns the minimum radius of curvature of the path in px (a sharp corner would give a tiny value). */
const _cum = new Float64Array(160);
export function roundedPath(S: P3, E: P3, H: P3, R: number, n: number, out: Float64Array, calcR = false): number {
  const v1 = [S[0] - E[0], S[1] - E[1], S[2] - E[2]], v2 = [H[0] - E[0], H[1] - E[1], H[2] - E[2]], l1 = Math.hypot(v1[0], v1[1], v1[2]) || 1e-6, l2 = Math.hypot(v2[0], v2[1], v2[2]) || 1e-6;
  const u1 = [v1[0] / l1, v1[1] / l1, v1[2] / l1], u2 = [v2[0] / l2, v2[1] / l2, v2[2] / l2], cosT = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2])), half = Math.acos(cosT) / 2;
  const t = Math.min(R / Math.max(1e-3, Math.tan(half)), 0.48 * Math.min(l1, l2)), A = [E[0] + u1[0] * t, E[1] + u1[1] * t, E[2] + u1[2] * t], Bp = [E[0] + u2[0] * t, E[1] + u2[1] * t, E[2] + u2[2] * t];
  let m = 0; const push = (x: number, y: number, z: number) => { _poly[m * 3] = x; _poly[m * 3 + 1] = y; _poly[m * 3 + 2] = z; m++; };
  for (let i = 0; i < 6; i++) { const q = i / 6; push(S[0] + (A[0] - S[0]) * q, S[1] + (A[1] - S[1]) * q, S[2] + (A[2] - S[2]) * q); }
  { // circular fillet of radius r = t * tan(half) between the tangent points A and B (centre on the bisector); a plain line when the bend is almost straight
    const bis = [u1[0] + u2[0], u1[1] + u2[1], u1[2] + u2[2]], bl = Math.hypot(bis[0], bis[1], bis[2]) || 1, r = t * Math.tan(half), cd = r / Math.max(1e-3, Math.sin(half)), C = [E[0] + (bis[0] / bl) * cd, E[1] + (bis[1] / bl) * cd, E[2] + (bis[2] / bl) * cd];
    const av = [(A[0] - C[0]) / r, (A[1] - C[1]) / r, (A[2] - C[2]) / r], bv = [(Bp[0] - C[0]) / r, (Bp[1] - C[1]) / r, (Bp[2] - C[2]) / r], ph = Math.acos(Math.max(-1, Math.min(1, av[0] * bv[0] + av[1] * bv[1] + av[2] * bv[2]))), sp = Math.sin(ph);
    for (let i = 0; i <= 24; i++) { const q = i / 24; if (sp < 1e-3 || !Number.isFinite(r)) { push(A[0] + (Bp[0] - A[0]) * q, A[1] + (Bp[1] - A[1]) * q, A[2] + (Bp[2] - A[2]) * q); continue; } const w1 = Math.sin((1 - q) * ph) / sp, w2 = Math.sin(q * ph) / sp; push(C[0] + r * (w1 * av[0] + w2 * bv[0]), C[1] + r * (w1 * av[1] + w2 * bv[1]), C[2] + r * (w1 * av[2] + w2 * bv[2])); }
  }
  for (let i = 1; i <= 6; i++) { const q = i / 6; push(Bp[0] + (H[0] - Bp[0]) * q, Bp[1] + (H[1] - Bp[1]) * q, Bp[2] + (H[2] - Bp[2]) * q); }
  let total = 0; const cum = _cum; cum[0] = 0; for (let i = 1; i < m; i++) { total += Math.hypot(_poly[i * 3] - _poly[i * 3 - 3], _poly[i * 3 + 1] - _poly[i * 3 - 2], _poly[i * 3 + 2] - _poly[i * 3 - 1]); cum[i] = total; }
  let j = 1; for (let k = 0; k <= n; k++) { const target = (k / n) * total; while (j < m - 1 && cum[j] < target) j++; const seg = cum[j] - cum[j - 1] || 1, u = Math.min(1, Math.max(0, (target - cum[j - 1]) / seg)); for (let e = 0; e < 3; e++) out[k * 3 + e] = _poly[(j - 1) * 3 + e] + (_poly[j * 3 + e] - _poly[(j - 1) * 3 + e]) * u; }
  // minimum radius of curvature (QA only): circumradius of consecutive resampled triples
  let rmin = 1e9; if (calcR) for (let k = 1; k < n; k++) { const a = [out[k * 3 - 3], out[k * 3 - 2], out[k * 3 - 1]], b = [out[k * 3], out[k * 3 + 1], out[k * 3 + 2]], c = [out[k * 3 + 3], out[k * 3 + 4], out[k * 3 + 5]], ab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), bc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]), ca = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]); const cr = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])], area2 = Math.hypot(cr[0], cr[1], cr[2]); if (area2 > 1e-6) rmin = Math.min(rmin, (ab * bc * ca) / (2 * area2)); }
  return rmin;
}
/** Bend poles in card-local px (x right, y DOWN, z toward the camera): elbows bend backward and outward, knees bend forward (and a little outward so a front view still shows the bend). */
export const armPole = (i: number): P3 => [(i === 0 ? -1 : 1) * 0.75, 0.35, -0.55];
export const legPole = (i: number, fx: number, ft: number): P3 => [fx + (i === 0 ? -1 : 1) * 0.3, -0.15, ft];
/** Joint path of one limb tube of a pose (card-local px, n + 1 points) and its interior angle; null when this limb keeps its cubic curve (explicit limbs3 or JOINTS off). */
export function limbJointPath(kind: Kind, p: RickPose, c3: C3, tube: number, yaw: number, out: Float64Array, n: number, calcR = false): {angle: number; rmin: number} | null {
  if (!JOINTS || p.limbs3 || tube >= 4) return null;
  const S = c3[0], H = c3[3], leg = tube < 2, i = leg ? tube : tube - 2, L = (leg ? LEG : ARM) / 2, fx = p.fwd[0] * Math.cos(yaw) - p.fwd[1] * Math.sin(yaw), ft = p.fwd[0] * Math.sin(yaw) + p.fwd[1] * Math.cos(yaw);
  const {E, angle} = limbIK(S, H, L, leg ? legPole(i, fx, ft) : armPole(i));
  return {angle, rmin: roundedPath(S, E, H, BEND_R, n, out, calcR)};
}

// ---------------------------------------------------------------- component
const TUBE_N = 20, TUBE_R = 10, TUBES = 6, CAPS = 10; // rings per tube, sides, tubes (2 legs, 2 arms, 2 feet), end caps (arm roots 2, hands 2, leg tops 2, ankles 2, toes 2)
const LIMB_MAT = () => shared('rick-limb-m', () => new THREE.MeshBasicMaterial({color: LIMB, toneMapped: false, side: THREE.DoubleSide})); // unlit, flat #231A28: no shading, no highlight, no outline
const CAP_SPHERE = () => shared('rick-limb-cap', () => new THREE.SphereGeometry(1, 10, 8));
const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _S = new THREE.Vector3(), _Q = new THREE.Quaternion(); // scratch (CPU only)
interface Rig { group: THREE.Group; geo: THREE.BufferGeometry; caps: THREE.InstancedMesh; wp: Float64Array; capPos: Float64Array }
/** Built ONCE per character (inside the shot, so the kit disposes it): one dynamic geometry holding the 6 tubes, one InstancedMesh with the 10 round caps. Updated in place every frame. */
function makeRig(): Rig {
  const per = (TUBE_N + 1) * TUBE_R, geo = new THREE.BufferGeometry(), idx: number[] = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TUBES * per * 3), 3));
  for (let t = 0; t < TUBES; t++) for (let j = 0; j < TUBE_N; j++) for (let k = 0; k < TUBE_R; k++) { const a = t * per + j * TUBE_R + k, b = t * per + j * TUBE_R + ((k + 1) % TUBE_R), c = a + TUBE_R, d = b + TUBE_R; idx.push(a, c, b, b, c, d); }
  geo.setIndex(idx);
  const tubes = new THREE.Mesh(geo, LIMB_MAT()); tubes.frustumCulled = false; tubes.castShadow = true;
  const caps = new THREE.InstancedMesh(CAP_SPHERE(), LIMB_MAT(), CAPS); caps.frustumCulled = false; caps.castShadow = true;
  const group = new THREE.Group(); group.add(tubes, caps); group.userData.noClutter = true; // limbs are not floor clutter (qa.ts looseFloorObjects)
  return {group, geo, caps, wp: new Float64Array(12), capPos: new Float64Array(CAPS * 3)};
}
/** CAMERA RULES v3: the card (and the limb tubes with it) tilts toward the camera by 60 % of the camera elevation seen from the character, clamped to 35 deg, so top-down and low views never show a thin edge. */
export const cardTilt = (cam: V3, p: V3, s: number): number => { const h = Math.hypot(cam[0] - p[0], cam[2] - p[2]) || 1e-3, el = Math.atan2(cam[1] - (p[1] + 0.85 * s), h); return Math.max(-35 * DEG, Math.min(35 * DEG, 0.6 * el)); };
const _jp = new Float64Array((TUBE_N + 1) * 3);
function updateRig(rig: Rig, curves: C3[], pos: V3, yaw: number, s: number, tilt = 0, kind: Kind = 'cop', pose?: RickPose): void {
  const ct = Math.cos(tilt), st = Math.sin(tilt), k = PXM * s, cs = Math.cos(yaw), sn = Math.sin(yaw), rL = (LIMB_W / 2) * k, rH = HAND_R * k, wp = rig.wp, out = rig.geo.getAttribute('position').array as Float32Array, per = (TUBE_N + 1) * TUBE_R;
  for (let t = 0; t < TUBES; t++) {
    const lift = t < 2 || t >= 4 ? rL : 0; // legs and feet: the tube rests ON the floor
    for (let q = 0; q < 4; q++) { const P = curves[t][q], x = (P[0] - CX) * k, z0 = P[2] * k, yu = (GROUND - P[1]) * k, z = -yu * st + z0 * ct; wp[q * 3] = pos[0] + cs * x + sn * z; wp[q * 3 + 1] = pos[1] + yu * ct + z0 * st + lift; wp[q * 3 + 2] = pos[2] - sn * x + cs * z; }
    const jr = pose ? limbJointPath(kind, pose, curves[t], t, yaw, _jp, TUBE_N) : null; // joint path (card-local px) or null
    const wpt = (j: number, e: number): number => { const x = (_jp[j * 3] - CX) * k, z0 = _jp[j * 3 + 2] * k, yu = (GROUND - _jp[j * 3 + 1]) * k, z = -yu * st + z0 * ct; return e === 0 ? pos[0] + cs * x + sn * z : e === 1 ? pos[1] + yu * ct + z0 * st + lift : pos[2] - sn * x + cs * z; };
    let pnx = 0, pny = 1, pnz = 0;
    for (let j = 0; j <= TUBE_N; j++) {
      const u = j / TUBE_N, m = 1 - u, a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u, da = 3 * m * m, db = 6 * m * u, dc = 3 * u * u;
      let tx = 0, ty = 0, tz = 0; const cx = [0, 0, 0];
      if (jr) { const j0 = Math.max(0, j - 1), j1 = Math.min(TUBE_N, j + 1); for (let e = 0; e < 3; e++) { cx[e] = wpt(j, e); const dv = wpt(j1, e) - wpt(j0, e); if (e === 0) tx = dv; else if (e === 1) ty = dv; else tz = dv; } }
      else for (let e = 0; e < 3; e++) { cx[e] = a * wp[e] + b * wp[3 + e] + c * wp[6 + e] + d * wp[9 + e]; const dv = da * (wp[3 + e] - wp[e]) + db * (wp[6 + e] - wp[3 + e]) + dc * (wp[9 + e] - wp[6 + e]); if (e === 0) tx = dv; else if (e === 1) ty = dv; else tz = dv; }
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // ROTATION-MINIMISING FRAME (parallel transport): the cross-section never twists, so a limb is ONE smooth tube with no seam at the elbow / knee.
      // (The old frame switched its reference axis whenever the tangent passed 0.9 vertical, which turned the section by 90 degrees mid-limb.)
      let n1x: number, n1y: number, n1z: number;
      if (j === 0) { const ax = Math.abs(ty) > 0.9 ? 1 : 0, ay = ax ? 0 : 1; n1x = ay * tz; n1y = -ax * tz; n1z = ax * ty - ay * tx; }
      else { const d = pnx * tx + pny * ty + pnz * tz; n1x = pnx - d * tx; n1y = pny - d * ty; n1z = pnz - d * tz; }
      const nl = Math.hypot(n1x, n1y, n1z) || 1; n1x /= nl; n1y /= nl; n1z /= nl; pnx = n1x; pny = n1y; pnz = n1z;
      const n2x = ty * n1z - tz * n1y, n2y = tz * n1x - tx * n1z, n2z = tx * n1y - ty * n1x;
      for (let v = 0; v < TUBE_R; v++) { const ph = (v / TUBE_R) * Math.PI * 2, co = Math.cos(ph) * rL, si = Math.sin(ph) * rL, o = (t * per + j * TUBE_R + v) * 3; out[o] = cx[0] + n1x * co + n2x * si; out[o + 1] = cx[1] + n1y * co + n2y * si; out[o + 2] = cx[2] + n1z * co + n2z * si; }
    }
  }
  rig.geo.getAttribute('position').needsUpdate = true;
  const ends: [number, number, number][] = [[2, 0, rL], [3, 0, rL], [2, 3, rH], [3, 3, rH], [0, 0, rL], [1, 0, rL], [0, 3, rL], [1, 3, rL], [4, 3, rL], [5, 3, rL]]; // [tube, end, radius]
  ends.forEach(([t, q, r], n) => { const P = curves[t][q], x = (P[0] - CX) * k, z0 = P[2] * k, yu = (GROUND - P[1]) * k, z = -yu * st + z0 * ct, lift = t < 2 || t >= 4 ? rL : 0; _P.set(pos[0] + cs * x + sn * z, pos[1] + yu * ct + z0 * st + lift, pos[2] - sn * x + cs * z); _M.compose(_P, _Q.identity(), _S.set(r, r, r)); rig.caps.setMatrixAt(n, _M); });
  rig.caps.instanceMatrix.needsUpdate = true;
}

export const Rick: React.FC<{kind: Kind; pose: RickPose; p: V3; cam: V3; s?: number}> = ({kind, pose, p, cam, s = 1}) => {
  const {canvas, tex} = useMemo(() => { const tex = makeTex(CW * K, CH * K, () => undefined); return {canvas: tex.image as HTMLCanvasElement, tex}; }, []);
  const rig = useMemo(makeRig, []);
  const yaw = yawTo(cam, p);
  const sol = solve(kind, pose, yaw);
  const c = canvas.getContext('2d')!;
  c.setTransform(K, 0, 0, K, 0, 0); drawRick(c, kind, pose, sol, yaw, false); tex.needsUpdate = true; // the card holds only the head and the torso
  const tilt = cardTilt(cam, p, s);
  updateRig(rig, limbCurves3(kind, pose, sol, yaw), p, yaw, s, tilt, kind, pose);
  const w = CW * PXM * s, h = CH * PXM * s, cy = (GROUND - CH / 2) * PXM * s;
  return (
    <group>
      <group position={p} rotation={[0, yaw, 0]}><group rotation={[-tilt, 0, 0]}>
        <mesh position={[0, cy, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, cy, 0]} castShadow>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group></group>
      <primitive object={rig.group} />
    </group>
  );
};
