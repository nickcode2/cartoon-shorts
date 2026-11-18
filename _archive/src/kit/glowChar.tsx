// The two glow characters, SUN and UNIVERSE, rebuilt from characters/reference-full.png.
//   head + body  = the PNG textures in characters/ (transparent), drawn as a circle and a capsule;
//   arms/legs    = black round-capped strokes, each ONE smooth bezier (limbs.ts) so a bend is an arc, never a V (min bend radius enforced);
//   hands/feet   = black ellipses;  face = the hoodie man's eyes, brows and mouth (face.ts, unchanged expressions).
// Glow: OUTER soft halo (yellow / blue-violet) around head and body ONLY; INNER edge glow on head and body clipped to the shape
// (whitish-yellow / blue, bright at the edge, fading to the centre). Arms, legs, hands and feet are plain black, no glow.
// Arm layering follows the gaze: the arm on the side the character looks toward is BEHIND the body, the other arm is in FRONT (derived from turn / face).
// Uses the same ManPose fields as the hoodie man (feet, hands, body, face, nod, headRoll, blinkPhase, grip, phone, turn, speak), so walk(), pickPlace(),
// holdPhone(), carEntry() and listener() drive it unchanged; pass rig = RIG_GLOW to walk()/holdPhone()/standFeet().
// Render stability: the card canvas and texture are created once per component (disposed with the shot); images are loaded once (CPU only).
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {useDelayRender} from 'remotion';
import {CARD_H, CARD_W, METERS_PER_PX, SOLE_Y} from '../guard';
import {Expr, ManPose} from './hoodieMan';
import {drawFace} from './face';
import {R_MIN_ARM, R_MIN_LEG, RIG_GLOW, V2, bezPoint, ik2, limbCurve} from './limbs';
import {V3, clamp01, lerp, useCamPos} from './kit';
import sunHeadUrl from '../../characters/sun-head.png';
import sunBodyUrl from '../../characters/sun-body.png';
import uniHeadUrl from '../../characters/universe-head.png';
import uniBodyUrl from '../../characters/universe-body.png';

export type GlowKind = 'sun' | 'universe' | 'white';
/** Costume drawn over the body (and a hat over the head) in the card canvas. Omitted = the plain character. Sun's investigator outfit is 'coat'. */
export type Outfit = 'coat' | 'engineer' | 'suitA' | 'dressB';
interface Style {
  head: string; body: string; // texture urls
  outer: string; // outer halo colour
  inner: string; // inner edge-glow colour
  outerA: number; innerA: number;
  faceInk: string;
  featureInk?: string; // colour of eyebrows and mouth only (eyes keep faceInk)
}
/** FACE COLOR EXPERIMENT (Universe only): "sun" = the Sun's face ink (black brows, mouth and eye outline, white eyes); "pale" = the previous pale ink. */
export const UNIVERSE_FACE = 'glow' as 'sun' | 'pale' | 'glow'; // 'sun' = all Sun ink, 'pale' = old pale ink, 'glow' = Sun face with glow-coloured brows and mouth
/** 'glow' = Sun face (white eyes, black outline) but eyebrows and mouth in this colour: the Universe's lighter edge-glow blue-violet. */
export const UNIVERSE_FEATURE_COLOR = '#0D1EA4';
const SUN_FACE_INK = '#2a1c10', PALE_FACE_INK = '#e6e9ff';
const STYLE: Record<GlowKind, Style> = {
  white: {head: '', body: '', outer: '#ffffff', inner: '#ffffff', outerA: 0.8, innerA: 0.12, faceInk: SUN_FACE_INK}, // extras: same treatment as Sun and Universe, in white
  sun: {head: sunHeadUrl, body: sunBodyUrl, outer: '#ffd83d', inner: '#fff4b8', outerA: 0.9, innerA: 0.1, faceInk: SUN_FACE_INK},
  universe: {head: uniHeadUrl, body: uniBodyUrl, outer: '#3b38ee', inner: '#4f62ff', outerA: 0.88, innerA: 0.06, faceInk: UNIVERSE_FACE === 'pale' ? PALE_FACE_INK : SUN_FACE_INK, featureInk: UNIVERSE_FACE === 'glow' ? UNIVERSE_FEATURE_COLOR : undefined},
};

// Layout: reference-full.png (display px) x 0.64 -> card px (head circle, body capsule, limbs; see RIG_GLOW).
export const LAYOUT = {head: {cx: 300, cy: 224.5, r: 136.5}, body: {x: 217, y: 361, w: 166, h: 334, r: 83}, limbW: 14, hand: [21, 18] as [number, number], foot: [30, 22] as [number, number], footDy: 14};
const NECK: V2 = [300, 361];
const BODY_PIVOT: V2 = [300, 691];
// default (hanging) limbs measured from the reference: [shoulder/hip, elbow/knee, hand/ankle]
const DEF_ARM: [V2, V2, V2][] = [[[249, 425], [180, 544], [205, 643]], [[383, 427], [449, 531], [452, 633]]];
const DEF_LEG: [V2, V2, V2][] = [[[265, 691], [246, 815], [253, 939]], [[341, 691], [354, 815], [353, 939]]];

// ---------------------------------------------------------------- textures (loaded once, CPU only)
const IMG = new Map<string, HTMLImageElement>();
const loadImg = (url: string) =>
  new Promise<void>((res) => {
    if (IMG.has(url)) return res();
    const im = new Image();
    im.onload = () => { IMG.set(url, im); res(); };
    im.onerror = () => { console.error('[glowChar] texture failed to load:', url); res(); };
    im.src = url;
  });
/** Non-React preload of the four PNGs (tests, previews). */
export const preloadGlowTextures = () => Promise.all([sunHeadUrl, sunBodyUrl, uniHeadUrl, uniBodyUrl].map(loadImg)).then(() => undefined);
/** Loads the four character PNGs once; holds the render (delayRender) until they are decoded. Returns ready. */
export const useGlowTextures = (): boolean => {
  const {delayRender, continueRender} = useDelayRender();
  const [ready, setReady] = useState(() => [sunHeadUrl, sunBodyUrl, uniHeadUrl, uniBodyUrl].every((u) => IMG.has(u)));
  useEffect(() => {
    if (ready) return;
    const h = delayRender('glow character textures', {timeoutInMilliseconds: 15000});
    Promise.all([sunHeadUrl, sunBodyUrl, uniHeadUrl, uniBodyUrl].map(loadImg)).then(() => { setReady(true); continueRender(h); });
  }, [ready, delayRender, continueRender]);
  return ready;
};

// ---------------------------------------------------------------- drawing
const capsule = (c: CanvasRenderingContext2D) => { c.beginPath(); c.roundRect(LAYOUT.body.x, LAYOUT.body.y, LAYOUT.body.w, LAYOUT.body.h, LAYOUT.body.r); };
const circle = (c: CanvasRenderingContext2D) => { c.beginPath(); c.arc(LAYOUT.head.cx, LAYOUT.head.cy, LAYOUT.head.r, 0, Math.PI * 2); };

/** Outer halo: the shape filled with the glow colour and a soft shadow (covered afterwards by the texture). Two radii: tight + wide. */
const outerGlow = (c: CanvasRenderingContext2D, st: Style, K: number, shape: () => void) => {
  c.save();
  c.fillStyle = st.outer;
  for (const [blur, a] of [[16, 0.9], [46, 0.75]] as const) {
    c.shadowColor = st.outer; c.shadowBlur = blur * K; c.globalAlpha = a * st.outerA;
    shape(); c.fill();
  }
  c.restore();
};
/** Inner edge glow, clipped to the shape: stacked outline strokes of growing width, so it is brightest at the edge and fades toward the centre. */
const innerGlow = (c: CanvasRenderingContext2D, st: Style, shape: () => void) => {
  c.save();
  shape(); c.clip();
  c.strokeStyle = st.inner;
  for (let i = 0; i < 9; i++) {
    c.globalAlpha = st.innerA;
    c.lineWidth = 4 + i * 6; // half of it falls inside the clip: glow reaches about 26 px in from the edge
    shape(); c.stroke();
  }
  c.restore();
};
// ---------------------------------------------------------------- hand-drawn ink (STYLE_NOTES "PAINTED FINISH v8"): variable-width outline, deterministic (no shimmer)
const TAU2 = Math.PI * 2;
const wob = (t: number, s: number) => 0.5 * Math.sin(t * 5 + s) + 0.3 * Math.sin(t * 13 + s * 1.7) + 0.2 * Math.sin(t * 29 + s * 2.9); // about -1..1
const SD: V2 = [0.75, 0.66]; // shadow side direction (light from the upper left)
const circlePts = (cx: number, cy: number, r: number, seed: number, n = 96): V2[] =>
  Array.from({length: n}, (_, i) => { const a = (i / n) * TAU2, rr = r + 1.3 * wob(a * 3, seed); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as V2; });
const capsulePts = (x: number, y: number, w: number, h: number, r: number, seed: number): V2[] => {
  const pts: V2[] = [], cx = x + w / 2, t1 = y + r, t2 = y + h - r, jit = (i: number): V2 => [1.1 * wob(i * 0.37, seed), 1.1 * wob(i * 0.37, seed + 3)];
  const push = (px: number, py: number) => { const j = jit(pts.length); pts.push([px + j[0], py + j[1]]); };
  for (let i = 0; i < 28; i++) { const a = Math.PI + (i / 28) * Math.PI; push(cx + Math.cos(a) * r, t1 + Math.sin(a) * r); }
  for (let i = 0; i < 14; i++) push(x + w, t1 + ((t2 - t1) * i) / 14);
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI; push(cx + Math.cos(a) * r, t2 + Math.sin(a) * r); }
  for (let i = 0; i < 14; i++) push(x, t2 - ((t2 - t1) * i) / 14);
  return pts;
};
let _hp: V2[] | null = null, _bp: V2[] | null = null; // outline point sets, built once (deterministic wobble, so the ink never shimmers)
const headPts = () => (_hp ??= circlePts(LAYOUT.head.cx, LAYOUT.head.cy, LAYOUT.head.r, 1));
const bodyPts = () => (_bp ??= capsulePts(LAYOUT.body.x, LAYOUT.body.y, LAYOUT.body.w, LAYOUT.body.h, LAYOUT.body.r, 2));
/** Black ink outline with variable width: thicker on the shadow side and at bends, thin in the light, slightly irregular (hand-drawn). */
function inkOutline(c: CanvasRenderingContext2D, pts: V2[], base: number, seed: number) {
  const n = pts.length;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= n; cy /= n;
  const outer: V2[] = [], inner: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let nx = ty, ny = -tx;
    if ((p[0] - cx) * nx + (p[1] - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const s = Math.min(1, Math.max(0, 0.5 + 0.5 * (nx * SD[0] + ny * SD[1])));
    const v1x = p[0] - a[0], v1y = p[1] - a[1], v2x = b[0] - p[0], v2y = b[1] - p[1];
    const bend = Math.min(1, (Math.abs(v1x * v2y - v1y * v2x) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1)) * 7);
    const w = base * (0.5 + 1.0 * s + 0.6 * bend) * (0.86 + 0.28 * wob(i * 0.31, seed));
    outer.push([p[0] + nx * w * 0.5, p[1] + ny * w * 0.5]);
    inner.push([p[0] - nx * w * 0.5, p[1] - ny * w * 0.5]);
  }
  c.beginPath();
  outer.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
  inner.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
  c.fillStyle = '#120a14'; c.fill('evenodd');
}
/** Cel-style shadow: two tones with hard, slightly brushy edges on the shadow side (right and below), clipped to the shape. Drawn over the fill. */
function celShadow(c: CanvasRenderingContext2D, clip: () => void, pts: V2[], shifts: [number, number, string][], seed: number) {
  c.save();
  clip(); c.clip();
  for (const [dx, dy, col] of shifts) {
    c.beginPath(); c.rect(-50, -50, 700, 1100);
    pts.forEach((p, i) => { const x = p[0] + dx + 2.6 * wob(i * 0.55, seed), y = p[1] + dy + 2.6 * wob(i * 0.55, seed + 5); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.closePath();
    c.fillStyle = col; c.fill('evenodd');
  }
  c.restore();
}
/** A black round-capped limb of variable width (thicker at the bend, a little irregular), stamped along the curve. NO glow on limbs. */
const plainLimb = (c: CanvasRenderingContext2D, curve: ReturnType<typeof limbCurve>, seed = 0) => {
  c.fillStyle = '#050505';
  const R0 = LAYOUT.limbW / 2;
  for (const sg of curve.seg) {
    for (let i = 0; i <= 70; i++) {
      const t = i / 70, p = bezPoint(sg, t);
      const r = R0 * (0.82 + 0.5 * Math.sin(Math.PI * t) * (curve.minR < 900 ? 1 : 0.4)) + 0.7 * wob(t * 6, seed);
      c.beginPath(); c.arc(p[0], p[1], Math.max(3, r), 0, TAU2); c.fill();
    }
  }
};
const ell = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = '#050505'; c.fill(); };

// White extra (casting rules): flat white head and body with one grey cel band; glow and ink outline are added by drawGlowChar like for Sun and Universe.
const plainShape = (c: CanvasRenderingContext2D, shape: () => void, r: number) => {
  c.save(); shape(); c.clip();
  c.fillStyle = '#fbfaf7'; c.fillRect(0, 0, 600, 1000);
  c.fillStyle = '#d8d8df'; c.beginPath(); c.ellipse(LAYOUT.head.cx + r * 0.9, LAYOUT.head.cy + r * 0.2, r * 1.1, r * 1.5, 0.3, 0, Math.PI * 2); c.fill();
  c.restore();
};
const OUTFIT_COL = {coat: '#8EC3F0', engineer: '#A8D8B9', suitA: '#BBA8E3', dressB: '#E9A6B3'} as const;
/** Costume over the body capsule (clipped to it): coat/vest/suit/dress colour, collar, buttons, belt. */
const drawOutfit = (c: CanvasRenderingContext2D, o: Outfit) => {
  const B = LAYOUT.body, col = OUTFIT_COL[o];
  c.save(); capsule(c); c.clip();
  c.fillStyle = col; c.fillRect(B.x, B.y + 40, B.w, B.h);
  c.fillStyle = 'rgba(30,20,72,0.18)'; c.fillRect(B.x + B.w * 0.62, B.y + 40, B.w * 0.4, B.h); // cel band
  c.strokeStyle = '#120a14'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(300, B.y + 20); c.lineTo(300, B.y + B.h); c.stroke(); // front opening
  c.fillStyle = o === 'dressB' ? '#fbfaf7' : '#120a14';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(286, B.y + 110 + i * 60, 6, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#fbfaf7'; // collar
  c.beginPath(); c.moveTo(300, B.y + 10); c.lineTo(262, B.y + 60); c.lineTo(300, B.y + 50); c.lineTo(338, B.y + 60); c.closePath(); c.fill(); c.stroke();
  if (o === 'engineer') { c.fillStyle = '#E9A6B3'; c.fillRect(B.x, B.y + 230, B.w, 22); }
  c.restore();
};
const drawHat = (c: CanvasRenderingContext2D, o: Outfit) => {
  if (o !== 'engineer') return;
  const {cx, cy, r} = LAYOUT.head;
  c.save();
  c.fillStyle = '#E9A6B3'; c.strokeStyle = '#120a14'; c.lineWidth = 8; c.lineJoin = 'round';
  c.beginPath(); c.arc(cx, cy - 20, r * 0.86, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(cx - r * 1.02, cy - r * 0.2, r * 2.04, 22, 10); c.fill(); c.stroke();
  c.restore();
};

export function drawGlowChar(c: CanvasRenderingContext2D, o: ManPose, kind: GlowKind, outfit?: Outfit) {
  const st = STYLE[kind], R = RIG_GLOW;
  const K = c.getTransform().a || 1; // shadowBlur is not scaled by the canvas transform: scale it by the 2x card raster
  const headImg = IMG.get(st.head), bodyImg = IMG.get(st.body);
  c.clearRect(0, 0, CARD_W, CARD_H);
  const E: Expr = o.expr;
  const shake = Math.sin(o.t * 24) * E.shake;
  const bob = Math.sin(o.t * 2.2) * 2 + shake * 5;
  const bdx = o.body?.dx ?? 0, bdy = o.body?.dy ?? 0, lean = o.body?.lean ?? 0, face = o.face ?? 0;
  const up = (p: V2): V2 => { // upper-body space -> card space (body shift + lean about the hips)
    let x = p[0] - BODY_PIVOT[0], y = p[1] - BODY_PIVOT[1];
    const cs = Math.cos(lean), sn = Math.sin(lean);
    [x, y] = [x * cs - y * sn, x * sn + y * cs];
    return [BODY_PIVOT[0] + x + bdx, BODY_PIVOT[1] + y + bob + bdy];
  };
  const hipsShift: V2 = [bdx, bob + bdy]; // legs start at the (moving) hips

  // ---- limb geometry: IK targets in card px (feet absolute; hands absolute), rounded curves with a minimum bend radius
  const armCurve = (i: 0 | 1) => {
    const sh = up(DEF_ARM[i][0]);
    const tgt = o.hands?.[i];
    if (!tgt && !o.hips) { // reference pose: explicit elbow, moved with the body
      const m = up(DEF_ARM[i][1]), h = up(DEF_ARM[i][2]);
      const cv = limbCurve(sh, m, h, R_MIN_ARM);
      return {cv, hand: h};
    }
    const hp: V2 = tgt ?? [lerp(DEF_ARM[i][2][0], i === 0 ? 238 : 362, o.hips ?? 0), lerp(DEF_ARM[i][2][1], 650, o.hips ?? 0)];
    const side = i === 0 ? -1 : 1; // elbows bow outward and slightly down
    const {m, end} = ik2(sh, hp, R.arm[0], R.arm[1], (p) => (p[0] - 300) * side + p[1] * 0.2);
    return {cv: limbCurve(sh, m, end, R_MIN_ARM), hand: end};
  };
  const legCurve = (i: 0 | 1) => {
    const hp: V2 = [DEF_LEG[i][0][0] + hipsShift[0], DEF_LEG[i][0][1] + hipsShift[1]];
    if (!o.feet) {
      const m: V2 = [DEF_LEG[i][1][0] + hipsShift[0] * 0.5, DEF_LEG[i][1][1] + hipsShift[1] * 0.5];
      const an = DEF_LEG[i][2];
      return {cv: limbCurve(hp, m, an, R_MIN_LEG), ankle: an};
    }
    const kn = o.knees?.[i];
    if (kn) return {cv: limbCurve(hp, kn, [o.feet[i][0], o.feet[i][1]], R_MIN_LEG), ankle: [o.feet[i][0], o.feet[i][1]] as V2}; // sitting: explicit knee, still one smooth arc
    const dir = face === 0 ? (i === 0 ? -1 : 1) : face;
    const {m, end} = ik2(hp, [o.feet[i][0], o.feet[i][1]], R.leg[0], R.leg[1], (p) => (p[0] - hp[0]) * dir);
    return {cv: limbCurve(hp, m, end, R_MIN_LEG), ankle: end};
  };
  const arm = [armCurve(0), armCurve(1)];
  const leg = [legCurve(0), legCurve(1)];

  // Arm layering follows the gaze: the arm on the side the character looks toward goes BEHIND the body, the other arm in FRONT.
  // Slot 0 = card-left arm, slot 1 = card-right arm. Gaze = head turn (looks to card right when > 0), else the walk direction `face`,
  // else the default (looks card-right, slot 1 behind). The swap is instant when the sign flips.
  const gaze = Math.abs(o.turn ?? 0) > 0.05 ? Math.sign(o.turn ?? 0) : face !== 0 ? face : 1;
  const F = gaze > 0 ? 0 : 1, Bk = 1 - F; // front / back slot
  const handEll = (i: number) => ell(c, arm[i].hand[0], arm[i].hand[1], LAYOUT.hand[0] - 2 * (o.grip?.[i] ?? 0), LAYOUT.hand[1] - 2 * (o.grip?.[i] ?? 0));

  // 1. back arm (behind the body), then legs
  plainLimb(c, arm[Bk].cv);
  handEll(Bk);
  if (o.phone && o.phone.hand === Bk) drawPhone(c, arm[Bk].hand, o.phone.tilt ?? 0, o.phone.glow);
  for (let i = 0; i < 2; i++) {
    plainLimb(c, leg[i].cv);
    const sx = leg[i].ankle[0] + (face === 0 ? 0 : face * 18), sy = leg[i].ankle[1] + LAYOUT.footDy;
    c.save();
    if (o.feet) { c.translate(sx, sy); c.rotate(o.feet[i][2]); c.translate(-sx, -sy); }
    ell(c, sx, sy, LAYOUT.foot[0], LAYOUT.foot[1]);
    c.restore();
  }

  // 2. body (outer halo, texture, inner glow)
  c.save();
  c.translate(bdx, bob + bdy);
  if (lean) { c.translate(BODY_PIVOT[0], BODY_PIVOT[1]); c.rotate(lean); c.translate(-BODY_PIVOT[0], -BODY_PIVOT[1]); }
  outerGlow(c, st, K, () => capsule(c));
  c.save();
  capsule(c); c.clip();
  if (bodyImg) c.drawImage(bodyImg, LAYOUT.body.x, LAYOUT.body.y, LAYOUT.body.w, LAYOUT.body.h);
  c.restore();
  if (kind === 'white') plainShape(c, () => capsule(c), 120);
  if (outfit) drawOutfit(c, outfit);
  celShadow(c, () => capsule(c), bodyPts(), [[-28, -8, 'rgba(53,42,87,0.22)'], [-13, -3, 'rgba(30,20,72,0.22)']], 1);
  innerGlow(c, st, () => capsule(c));
  inkOutline(c, bodyPts(), 5.5, 2);

  // 3. head (nod and roll about the neck), same layers, then the face
  c.save();
  c.translate(0, o.nod ?? 0);
  const roll = ((E.tilt + shake * 3 + (o.headRoll ?? 0)) * Math.PI) / 180;
  c.translate(NECK[0], NECK[1]); c.rotate(roll); c.translate(-NECK[0], -NECK[1]);
  outerGlow(c, st, K, () => circle(c));
  c.save();
  circle(c); c.clip();
  if (headImg) c.drawImage(headImg, LAYOUT.head.cx - LAYOUT.head.r, LAYOUT.head.cy - LAYOUT.head.r, LAYOUT.head.r * 2, LAYOUT.head.r * 2);
  c.restore();
  if (kind === 'white') plainShape(c, () => circle(c), LAYOUT.head.r);
  celShadow(c, () => circle(c), headPts(), [[-0.34 * LAYOUT.head.r, -0.26 * LAYOUT.head.r, 'rgba(53,42,87,0.22)'], [-0.15 * LAYOUT.head.r, -0.11 * LAYOUT.head.r, 'rgba(30,20,72,0.22)']], 3);
  innerGlow(c, st, () => circle(c));
  inkOutline(c, headPts(), 6, 4);
  c.save(); // hoodie face coordinates (head centre 300,205, radius 142) -> this head
  c.translate(LAYOUT.head.cx, LAYOUT.head.cy);
  const fs = LAYOUT.head.r / 142;
  c.scale(fs, fs);
  c.translate(-300, -205);
  drawFace(c, E, {t: o.t, turn: o.turn, speak: o.speak, blinkPhase: o.blinkPhase, ink: st.faceInk, featureInk: st.featureInk});
  c.restore();
  if (outfit) drawHat(c, outfit);
  c.restore(); // head
  c.restore(); // body

  // 4. front arm in FRONT of the body (plain black stroke, no glow)
  plainLimb(c, arm[F].cv);
  if (o.phone && o.phone.hand === F) drawPhone(c, arm[F].hand, o.phone.tilt ?? 0, o.phone.glow);
  handEll(F);
}
function drawPhone(c: CanvasRenderingContext2D, h: V2, tilt: number, glow?: string) {
  c.save();
  c.translate(h[0], h[1]);
  c.rotate((tilt * Math.PI) / 180);
  c.beginPath(); c.roundRect(-30, -112, 60, 116, 12); c.fillStyle = '#2b2d3a'; c.fill();
  c.beginPath(); c.roundRect(-24, -104, 48, 96, 7); c.fillStyle = glow ?? '#9fd0ff'; c.fill();
  c.beginPath(); c.roundRect(-30, -112, 60, 116, 12); c.strokeStyle = '#050505'; c.lineWidth = 6; c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- 3D billboard card (same as HoodieMan: real shadow via alphaTest caster)
export const GlowCharacter: React.FC<{kind: GlowKind; pose: ManPose; p: V3; s?: number; yawK?: number; ready: boolean; outfit?: Outfit}> = ({kind, pose, p, s = 0.84, yawK = 0.8, ready, outfit}) => {
  const camPos = useCamPos();
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W * 2;
    canvas.height = CARD_H * 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return {canvas, tex};
  }, []);
  useEffect(() => () => { tex.dispose(); }, [tex]); // free the card texture when the shot ends (render stability rule 1)
  if (ready) {
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawGlowChar(ctx, pose, kind, outfit);
    tex.needsUpdate = true;
  }
  const w = CARD_W * METERS_PER_PX * s, h = CARD_H * METERS_PER_PX * s;
  const cy = h / 2 - (CARD_H - SOLE_Y) * METERS_PER_PX * s;
  const yaw = yawK * Math.atan2(camPos.x - p[0], camPos.z - p[2]);
  return (
    <group position={p}>
      <group rotation={[0, yaw, 0]}>
        <mesh position={[0, cy, 0]} renderOrder={5}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.01} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, cy, 0]} castShadow>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
export {clamp01};
