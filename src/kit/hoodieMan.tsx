// The hoodie man, v3: Ricks Clips look. White skin with flat grey cel shading, no blush / ears / nose.
// Small half-lidded white eyes with black pupils, thick short dark brows ABOVE the eyes with a gap (enforced, see MIN_GAP).
// Arms and legs are single THICK ink lines, hands are round dots, shoes are small ovals.
// Fixed expression set (use in every video): neutral, smug, angry, surprised, laughing. Blinks every 3.5 s. Mouth flap via `speak`.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CARD_H, CARD_W, INK, METERS_PER_PX, SOLE_Y, dot, oval, poly} from '../guard';
import {V3, clamp01, lerp, useCamPos} from './kit';

type V2 = [number, number];
type T3 = [number, number, number];

export interface Expr {
  er: number; eh: number; // eye half width / half height
  lidIn: number; lidOut: number; lidR: number; // px cut from the top of the eye by the lid (inner / outer corner, extra for the right eye)
  closed: number; // 0..1, 1 = happy closed arcs
  pr: number; gx: number; gy: number; // pupil radius, gaze -1..1
  bL: T3; bR: T3; // brow height ABOVE the lid line: inner, middle, outer (px). Clamped to MIN_GAP.
  mw: number; cl: number; cr: number; mid: number; open: number; rd: number; // mouth
  teeth: number; tongue: number; dimple: number;
  tilt: number; shake: number;
}

export type ExprName = 'neutral' | 'smug' | 'angry' | 'surprised' | 'laughing';

export const EXPR: Record<ExprName, Expr> = {
  neutral: {er: 17, eh: 19, lidIn: 10, lidOut: 9, lidR: 0, closed: 0, pr: 8, gx: 0, gy: 0, bL: [26, 28, 28], bR: [26, 28, 28],
    mw: 14, cl: 0, cr: 0, mid: 2, open: 0, rd: 0.35, teeth: 0, tongue: 0, dimple: 0, tilt: 0, shake: 0},
  smug: {er: 17, eh: 19, lidIn: 12, lidOut: 11, lidR: -3, closed: 0, pr: 8, gx: 0.4, gy: -0.1, bL: [26, 26, 28], bR: [34, 42, 36],
    mw: 20, cl: 4, cr: -8, mid: 6, open: 0, rd: 0.35, teeth: 0, tongue: 0, dimple: 1, tilt: -5, shake: 0},
  angry: {er: 17, eh: 19, lidIn: 13, lidOut: 3, lidR: 0, closed: 0, pr: 8, gx: 0, gy: 0.1, bL: [26, 32, 40], bR: [26, 32, 40],
    mw: 18, cl: 8, cr: 8, mid: -4, open: 8, rd: 0.5, teeth: 1, tongue: 0, dimple: 0, tilt: 2, shake: 0},
  surprised: {er: 19, eh: 24, lidIn: 0, lidOut: 0, lidR: 0, closed: 0, pr: 5, gx: 0, gy: 0, bL: [36, 42, 38], bR: [36, 42, 38],
    mw: 11, cl: 0, cr: 0, mid: -10, open: 22, rd: 1, teeth: 0, tongue: 0, dimple: 0, tilt: 0, shake: 0},
  laughing: {er: 18, eh: 19, lidIn: 0, lidOut: 0, lidR: 0, closed: 1, pr: 8, gx: 0, gy: 0, bL: [32, 38, 32], bR: [32, 38, 32],
    mw: 28, cl: -6, cr: -6, mid: -10, open: 28, rd: 0.55, teeth: 1, tongue: 1, dimple: 0, tilt: -6, shake: 1},
};

export function mixExpr(a: Expr, b: Expr, k: number): Expr {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(a) as (keyof Expr)[]) {
    const va = a[key], vb = b[key];
    out[key] = Array.isArray(va) ? (va as T3).map((x, i) => lerp(x, (vb as T3)[i], k)) : lerp(va as number, vb as number, k);
  }
  return out as unknown as Expr;
}

export interface ManPose {
  t: number; // seconds, drives breathing / blink / laugh shake
  expr: Expr;
  turn?: number; // head turn -1 (looks to his left / viewer's left) .. +1
  hips?: number; // 0 arms hang, 1 hands on hips
  speak?: number; // 0..1 mouth opening for speech (feed it from the audio, see useMouthFlap in CharacterTest)
  // ---- motion (all optional; omitted = the original static pose). Coordinates are CARD px (600x1000), see motion.ts.
  feet?: [T3, T3]; // ankle [x, y, tilt rad] per foot, ABSOLUTE card px: a planted foot keeps the same value while the body moves. y 942 = ground
  hands?: [V2 | null, V2 | null]; // hand target per side (card px), null = hang/hips. Arms use two-bone IK from the shoulders
  body?: {dx?: number; dy?: number; lean?: number}; // upper body + hips offset (px, dy down) and lean around the hips (rad)
  face?: -1 | 0 | 1; // walking direction on the card (toes point that way). 0 = original outward toes
  nod?: number; // head dip in px (+ = looks down)
  headRoll?: number; // extra head tilt in degrees
  blinkPhase?: number; // seconds added to t for the blink clock, so two characters do not blink in sync
  knees?: [V2 | null, V2 | null]; // explicit knee points (card px, absolute) for sitting; null = IK. Honoured by the glow characters (glowChar.tsx); the hoodie man ignores it (untested there)
  grip?: [number, number]; // 0..1 hand squeeze (ball hand shrinks a little when it holds something)
  phone?: {hand: 0 | 1; tilt?: number; glow?: string}; // draw a phone held by that hand (hand sits at the phone's edge)
}

// ---------------------------------------------------------------- helpers
const MIN_GAP = 26; // centre of the brow stroke to the lid line, px. Stroke is 17 px, so the visible gap is >= 17 px.
export const LIMB_W = 21; // single ink line limbs (3x the old 7 px)
const SKIN = '#fbfaf7';
const SKIN_SHADE = '#d8d8df';
const HOOD = '#5c8a8f';
const HOOD_SHADE = '#46747a';
const HOOD_LIGHT = '#78a6a9';

const ink = (c: CanvasRenderingContext2D, w: number) => {
  c.strokeStyle = INK;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
};

// two-bone arm: shoulder -> elbow -> hand, elbow bends outward/down
function elbow(s: V2, h: V2, side: number): V2 {
  const L1 = 150, L2 = 140;
  let dx = h[0] - s[0], dy = h[1] - s[1];
  let D = Math.hypot(dx, dy);
  const maxD = (L1 + L2) * 0.985;
  if (D > maxD) { dx *= maxD / D; dy *= maxD / D; D = maxD; }
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const mx = s[0] + (dx * a) / D, my = s[1] + (dy * a) / D;
  const px = -dy / D, py = dx / D;
  const c1: V2 = [mx + px * hh, my + py * hh];
  const c2: V2 = [mx - px * hh, my - py * hh];
  const score = (p: V2) => (p[0] - 300) * side + p[1] * 0.2;
  return score(c1) > score(c2) ? c1 : c2;
}

// generic two-bone IK: hip -> knee -> ankle. `dir` picks which side the knee bends toward (+1 right on the card).
const L_THIGH = 155, L_SHIN = 145;
function knee(h: V2, a: V2, dir: number): V2 {
  let dx = a[0] - h[0], dy = a[1] - h[1];
  let D = Math.hypot(dx, dy) || 1;
  const maxD = (L_THIGH + L_SHIN) * 0.995;
  if (D > maxD) { dx *= maxD / D; dy *= maxD / D; D = maxD; }
  const q = (L_THIGH * L_THIGH - L_SHIN * L_SHIN + D * D) / (2 * D);
  const hh = Math.sqrt(Math.max(0, L_THIGH * L_THIGH - q * q));
  const mx = h[0] + (dx * q) / D, my = h[1] + (dy * q) / D;
  const px = -dy / D, py = dx / D;
  const c1: V2 = [mx + px * hh, my + py * hh], c2: V2 = [mx - px * hh, my - py * hh];
  return (c1[0] - mx) * dir >= (c2[0] - mx) * dir ? c1 : c2;
}
/** Where the ankle ends up after the leg is clamped to its length (used by motion.ts to keep planted feet exact). */
export const LEG_REACH = L_THIGH + L_SHIN;
const BODY_PIVOT: V2 = [300, 650];

// ---------------------------------------------------------------- face
const EY = 236; // eye centre y
const EX = 54; // eye centre offset from the face centre

function lidCut(E: Expr, side: number, frac: number) {
  const base = lerp(E.lidOut, E.lidIn, frac) + (side > 0 ? E.lidR : 0);
  return Math.max(0, base);
}
function lidY(E: Expr, side: number, cx: number, x: number) {
  const inner = -side;
  const frac = clamp01(((x - cx) * inner + E.er) / (2 * E.er));
  const open = EY - E.eh + lidCut(E, side, frac);
  return lerp(open, EY - 10, E.closed);
}

function drawEye(c: CanvasRenderingContext2D, E: Expr, side: number, blink: number) {
  const cx = 300 + side * EX;
  const inner = -side;
  const {er, eh} = E;
  if (E.closed > 0.5) {
    c.beginPath();
    c.moveTo(cx - er, EY + 6);
    c.quadraticCurveTo(cx, EY - 22, cx + er, EY + 6);
    ink(c, 9);
    return;
  }
  const cutO = lidCut(E, side, 0) + blink * eh * 2;
  const cutI = lidCut(E, side, 1) + blink * eh * 2;
  const top = EY - eh;
  const yO = top + cutO, yI = top + cutI;
  const xO = cx - inner * er, xI = cx + inner * er;
  const P = (k: number): V2 => [xO + (xI - xO) * k, yO + (yI - yO) * k];
  const p0 = P(-0.3), p1 = P(1.3);
  c.save();
  c.beginPath();
  c.moveTo(p0[0], p0[1]);
  c.lineTo(p1[0], p1[1]);
  c.lineTo(p1[0], EY + eh + 20);
  c.lineTo(p0[0], EY + eh + 20);
  c.closePath();
  c.clip();
  c.beginPath();
  c.ellipse(cx, EY, er, eh, 0, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  const px = cx + E.gx * (er - E.pr) * 0.9, py = EY + 2 + E.gy * 5;
  oval(c, px, py, E.pr, E.pr * 1.08, '#0c0a0e');
  c.beginPath();
  c.ellipse(cx, EY, er, eh, 0, 0, Math.PI * 2);
  ink(c, 5);
  c.restore();
  if (cutO > 1 || cutI > 1) {
    c.beginPath();
    c.moveTo(xO, yO);
    c.lineTo(xI, yI);
    ink(c, 8);
  }
}

function drawBrow(c: CanvasRenderingContext2D, E: Expr, side: number, h: T3) {
  const cx = 300 + side * EX;
  const inner = -side;
  const pts: V2[] = [
    [cx + inner * E.er * 0.5, 0],
    [cx - inner * E.er * 0.35, 0],
    [cx - inner * E.er * 1.2, 0],
  ];
  pts.forEach((p, i) => {
    p[1] = lidY(E, side, cx, p[0]) - Math.max(MIN_GAP, h[i]); // never closer than MIN_GAP above the lid
  });
  const ctrl: V2 = [2 * pts[1][0] - (pts[0][0] + pts[2][0]) / 2, 2 * pts[1][1] - (pts[0][1] + pts[2][1]) / 2];
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  c.quadraticCurveTo(ctrl[0], ctrl[1], pts[2][0], pts[2][1]);
  ink(c, 17);
}

function drawMouth(c: CanvasRenderingContext2D, E0: Expr, speak: number) {
  const by = 298;
  // speech: blend toward a small talking mouth whose opening follows `speak`
  const k = clamp01(speak * 4);
  const E: Expr = speak > 0.01
    ? {...E0, mw: lerp(E0.mw, 13 + speak * 5, k), cl: lerp(E0.cl, 0, k), cr: lerp(E0.cr, 0, k), mid: lerp(E0.mid, -4, k), open: Math.max(E0.open, speak * 26), rd: lerp(E0.rd, 0.9, k), dimple: E0.dimple * (1 - k)}
    : E0;
  const {mw, cl, cr, mid, open, rd} = E;
  const x0 = 300 - mw, x3 = 300 + mw;
  const y0 = by + cl, y3 = by + cr;
  const cU = (by + (cl + cr) / 2 + mid - (y0 + y3) / 8) / 0.75;
  const cL = cU + open / 0.75;
  const path = (closeIt: boolean) => {
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(300 - mw * rd, cU, 300 + mw * rd, cU, x3, y3);
    if (closeIt) c.bezierCurveTo(300 + mw * rd, cL, 300 - mw * rd, cL, x0, y0);
  };
  if (open < 2) {
    path(false);
    ink(c, 8);
  } else {
    path(true);
    c.fillStyle = '#3a0f1c';
    c.fill();
    c.save();
    path(true);
    c.clip();
    const uy = by + (cl + cr) / 2 + mid;
    if (E.tongue > 0.05) {
      c.fillStyle = '#e8647a';
      c.beginPath(); c.ellipse(300, uy + open * 0.95, mw * 0.55, open * 0.38 * E.tongue, 0, 0, 7); c.fill();
    }
    if (E.teeth > 0.05) {
      c.fillStyle = '#ffffff';
      c.fillRect(x0 - 4, uy - 12, mw * 2 + 8, 12 + 9 * E.teeth);
    }
    c.restore();
    path(true);
    ink(c, 8);
  }
  if (E.dimple > 0.05) {
    c.globalAlpha = clamp01(E.dimple);
    c.beginPath();
    c.arc(x3 - 3, y3 - 2, 8, -1.15, 1.15);
    ink(c, 6);
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- hair geometry (shared by the drawing, the forehead shadow and hairReport)
// One closed loop of cubic beziers. The outer cap wraps the head and ends in side tips at y 238 that sit ON the head outline
// (not inside it: tips inside the head looked cut off), the hairline runs back inside the head.
const HAIR: V2[][] = [
  [[154, 238], [128, -5], [472, -5], [446, 238]], // outer cap, left tip -> right tip
  [[446, 238], [440, 170], [396, 122], [342, 114]], // right hairline
  [[342, 114], [300, 108], [252, 112], [214, 130]], // fringe
  [[214, 130], [180, 146], [158, 190], [154, 238]], // left hairline
];
const hairPath = (c: CanvasRenderingContext2D) => {
  c.beginPath();
  c.moveTo(HAIR[0][0][0], HAIR[0][0][1]);
  for (const [, a, b, d] of HAIR) c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  c.closePath();
};
const HEAD = {cx: 300, cy: 205, rx: 142, ry: 133};
const bez = (seg: V2[], t: number): V2 => {
  const u = 1 - t;
  return [u * u * u * seg[0][0] + 3 * u * u * t * seg[1][0] + 3 * u * t * t * seg[2][0] + t * t * t * seg[3][0], u * u * u * seg[0][1] + 3 * u * u * t * seg[1][1] + 3 * u * t * t * seg[2][1] + t * t * t * seg[3][1]];
};
const ellipseVal = (p: V2) => ((p[0] - HEAD.cx) / HEAD.rx) ** 2 + ((p[1] - HEAD.cy) / HEAD.ry) ** 2; // <1 inside the head
/** Numeric hair check: tips on the outline, cap covers the crown, hairline inside the head, everything inside the card at the worst tilt/nod. */
export function hairReport(maxTiltDeg = 10, maxNod = 14): {ok: boolean; issues: string[]} {
  const issues: string[] = [];
  const tipL = HAIR[0][0], tipR = HAIR[0][3];
  for (const [n, tp] of [['left', tipL], ['right', tipR]] as const) {
    const v = ellipseVal(tp);
    if (v < 1.0) issues.push(`${n} side tip is inside the head (value ${v.toFixed(2)}): hair looks cut off`);
  }
  let top = 1e9;
  for (let i = 0; i <= 24; i++) top = Math.min(top, bez(HAIR[0], i / 24)[1]);
  if (top > HEAD.cy - HEAD.ry - 6) issues.push(`crown not covered: hair top y ${top.toFixed(0)} vs head top ${HEAD.cy - HEAD.ry}`);
  const span: [number, number][] = [[4, 24], [0, 24], [0, 16]]; // skip the sideburn ends, which sit on the outline by design
  let poke = false;
  [1, 2, 3].forEach((k, j) => { for (let i = span[j][0]; i <= span[j][1]; i++) if (ellipseVal(bez(HAIR[k], i / 24)) > 1) poke = true; });
  if (poke) issues.push('hairline pokes outside the head');
  const a = (maxTiltDeg * Math.PI) / 180;
  for (const sg of [-1, 1]) {
    for (const seg of HAIR) for (let i = 0; i <= 24; i++) {
      const [x, y] = bez(seg, i / 24);
      const dx = x - 300, dy = y - 335, ca = Math.cos(sg * a), sa = Math.sin(sg * a);
      const rx = 300 + dx * ca - dy * sa, ry = 335 + dx * sa + dy * ca + maxNod;
      if (rx < 8 || rx > CARD_W - 8 || ry < 8 || ry > CARD_H - 8) { issues.push('hair leaves the card at max tilt/nod (clipped by the canvas)'); return {ok: false, issues}; }
    }
  }
  return {ok: issues.length === 0, issues};
}
/** Debug overlay for the hair-check: head ellipse (magenta), hair loop (cyan), tips (yellow). Draw it in card space after drawHoodieMan. */
export function drawHairDebug(c: CanvasRenderingContext2D) {
  c.save();
  c.lineWidth = 2;
  c.strokeStyle = '#ff00cc';
  c.beginPath(); c.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 0, 0, 7); c.stroke();
  c.strokeStyle = '#00e5ff';
  hairPath(c); c.stroke();
  c.fillStyle = '#ffee00';
  for (const tp of [HAIR[0][0], HAIR[0][3]]) { c.beginPath(); c.arc(tp[0], tp[1], 5, 0, 7); c.fill(); }
  c.restore();
}

// ---------------------------------------------------------------- body
export function drawHoodieMan(c: CanvasRenderingContext2D, o: ManPose) {
  const {t} = o;
  const E = o.expr;
  const turn = o.turn ?? 0;
  const hips = o.hips ?? 0;
  const speak = o.speak ?? 0;
  c.clearRect(0, 0, CARD_W, CARD_H);
  const shake = Math.sin(t * 24) * E.shake;
  const bob = Math.sin(t * 2.2) * 2 + shake * 5;

  // ---- legs: single thick ink lines. With `feet` the legs are IK-driven from the (moving) hips to the (planted) ankles.
  const bdx = o.body?.dx ?? 0, bdy = o.body?.dy ?? 0, lean = o.body?.lean ?? 0;
  const face = o.face ?? 0;
  const ankles: V2[] = o.feet ? [[o.feet[0][0], o.feet[0][1]], [o.feet[1][0], o.feet[1][1]]] : [[262, 942], [338, 942]];
  const hipsP: V2[] = [[274 + bdx, 644 + bdy], [326 + bdx, 644 + bdy]];
  if (o.feet) {
    hipsP.forEach((hp, i) => {
      const kn = knee(hp, ankles[i], face === 0 ? (i === 0 ? -1 : 1) : face);
      poly(c, [hp, kn, ankles[i]], LIMB_W);
    });
  } else {
    const legs: [V2, V2, V2][] = [
      [[274, 644], [268, 800], [262, 942]],
      [[326, 644], [332, 800], [338, 942]],
    ];
    for (const [hp, kn, an] of legs) poly(c, [hp, kn, an], LIMB_W);
  }
  // ---- small oval shoes (toes lead in the walking direction, or point outward when face = 0)
  [-1, 1].forEach((sx, i) => {
    const cx = o.feet ? ankles[i][0] + (face === 0 ? sx * 22 : face * 20) : 300 + sx * 60;
    const cy = o.feet ? ankles[i][1] + 14 : 956;
    c.save();
    if (o.feet) { c.translate(cx, cy); c.rotate(o.feet[i][2]); c.translate(-cx, -cy); }
    c.beginPath(); c.ellipse(cx, cy, 36, 15, 0, 0, 7);
    c.fillStyle = '#f4f3ee';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = SKIN_SHADE;
    c.fillRect(cx - 40, cy + 3, 80, 16);
    c.restore();
    ink(c, 7);
    c.restore();
  });

  c.save();
  c.translate(bdx, bob + bdy);
  if (lean) { c.translate(BODY_PIVOT[0], BODY_PIVOT[1]); c.rotate(lean); c.translate(-BODY_PIVOT[0], -BODY_PIVOT[1]); }
  // card-space point -> upper-body space (inverse of the transform above), so `hands` can be given in card px
  const toBody = (q: V2): V2 => {
    let x = q[0] - bdx, y = q[1] - (bob + bdy);
    if (lean) {
      const dx = x - BODY_PIVOT[0], dy = y - BODY_PIVOT[1], cs = Math.cos(-lean), sn = Math.sin(-lean);
      x = BODY_PIVOT[0] + dx * cs - dy * sn; y = BODY_PIVOT[1] + dx * sn + dy * cs;
    }
    return [x, y];
  };

  // ---- hood behind the head
  c.beginPath(); c.ellipse(300, 352, 112, 46, 0, 0, 7);
  c.fillStyle = HOOD_SHADE;
  c.fill();
  ink(c, 11);

  // ---- torso: flat colour + hard cel shade
  const torso = () => { c.beginPath(); c.roundRect(222, 340, 156, 310, 42); };
  torso();
  c.fillStyle = HOOD;
  c.fill();
  c.save();
  torso();
  c.clip();
  c.fillStyle = HOOD_SHADE;
  c.beginPath(); c.moveTo(340, 340); c.quadraticCurveTo(326, 500, 344, 650); c.lineTo(380, 650); c.lineTo(380, 340); c.closePath(); c.fill();
  c.fillStyle = HOOD_LIGHT;
  c.beginPath(); c.moveTo(222, 380); c.quadraticCurveTo(238, 480, 230, 560); c.lineTo(222, 560); c.closePath(); c.fill();
  c.fillStyle = HOOD_SHADE;
  c.fillRect(222, 618, 156, 40);
  c.restore();
  torso();
  ink(c, 12);
  c.beginPath(); c.moveTo(224, 618); c.lineTo(376, 618); ink(c, 7);

  // kangaroo pocket
  c.beginPath(); c.roundRect(246, 508, 108, 76, 20);
  c.fillStyle = '#527f85';
  c.fill();
  c.save();
  c.beginPath(); c.roundRect(246, 508, 108, 76, 20); c.clip();
  c.fillStyle = HOOD_SHADE;
  c.fillRect(246, 566, 108, 20);
  c.restore();
  c.beginPath(); c.roundRect(246, 508, 108, 76, 20); ink(c, 8);

  // ---- arms: SINGLE thick ink lines + round dot hands
  const sway = Math.sin(t * 2.2 + 1) * 3;
  const HANG: [V2, V2] = [[210 - sway, 656], [390 + sway, 656]];
  const HIP: [V2, V2] = [[240, 612], [360, 612]];
  const SH: [V2, V2] = [[232, 388], [368, 388]];
  const hands: V2[] = [0, 1].map((i) => {
    const tgt = o.hands?.[i];
    return tgt ? toBody(tgt) : ([lerp(HANG[i][0], HIP[i][0], hips), lerp(HANG[i][1], HIP[i][1], hips)] as V2);
  });
  const drawPhone = () => {
    if (!o.phone) return;
    const h = hands[o.phone.hand];
    c.save();
    c.translate(h[0], h[1]);
    c.rotate(((o.phone.tilt ?? 0) * Math.PI) / 180);
    // the ball hand sits at the phone's lower edge (phone body rises above it)
    c.beginPath(); c.roundRect(-30, -112, 60, 116, 12);
    c.fillStyle = '#2b2d3a'; c.fill();
    c.beginPath(); c.roundRect(-24, -104, 48, 96, 7);
    c.fillStyle = o.phone.glow ?? '#9fd0ff'; c.fill();
    c.beginPath(); c.roundRect(-30, -112, 60, 116, 12); ink(c, 6);
    c.restore();
  };
  [-1, 1].forEach((side, i) => {
    const el = elbow(SH[i], hands[i], side);
    poly(c, [SH[i], el, hands[i]], LIMB_W);
    if (o.phone && o.phone.hand === i) drawPhone();
    dot(c, hands[i][0], hands[i][1], 23 - 3 * (o.grip?.[i] ?? 0));
  });

  // ---- drawstrings
  for (const [x1, x2] of [[282, 276], [318, 324]]) {
    c.beginPath(); c.moveTo(x1, 372); c.quadraticCurveTo(x1 - 3, 420, x2, 462);
    c.strokeStyle = '#f4f1e8'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();
    dot(c, x2, 466, 6);
  }

  // ---- front collar
  c.beginPath(); c.ellipse(300, 352, 72, 25, 0, 0, 7);
  c.fillStyle = HOOD_LIGHT;
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = HOOD_SHADE;
  c.fillRect(220, 354, 160, 30);
  c.restore();
  ink(c, 9);

  // ---- head (no ears, no nose, no blush)
  const tilt = ((E.tilt + shake * 3 + (o.headRoll ?? 0)) * Math.PI) / 180;
  c.save();
  c.translate(0, o.nod ?? 0);
  c.translate(300, 335);
  c.rotate(tilt);
  c.translate(-300, -335);
  const hx = 300, hy = 205, rx = 142, ry = 133;
  c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7);
  c.fillStyle = SKIN_SHADE;
  c.fill();
  c.save();
  c.clip();
  // lit area (shadow crescent stays at the lower right)
  c.beginPath(); c.ellipse(hx - 16, hy - 12, rx - 2, ry - 4, 0, 0, 7);
  c.fillStyle = SKIN;
  c.fill();
  // hair cast shadow on the forehead
  c.save();
  c.translate(0, 20);
  hairPath(c);
  c.fillStyle = SKIN_SHADE;
  c.fill();
  c.restore();
  c.restore();
  c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7);
  ink(c, 12);

  // features (head turn shifts and slightly squeezes them)
  c.save();
  c.translate(300 + turn * 30, 0);
  c.scale(1 - 0.1 * Math.abs(turn), 1);
  c.translate(-300, 0);
  const ph = (t + (o.blinkPhase ?? 0)) % 3.5; // blink every 3.5 s
  const blink = E.closed > 0.5 || ph < 1.1 || ph > 1.22 ? 0 : Math.sin(((ph - 1.1) / 0.12) * Math.PI);
  drawEye(c, E, -1, blink);
  drawEye(c, E, 1, blink);
  drawBrow(c, E, -1, E.bL);
  drawBrow(c, E, 1, E.bR);
  drawMouth(c, E, speak);
  c.restore();

  // ---- hair (flat colour + one cel highlight)
  const hair = () => hairPath(c);
  hair();
  c.fillStyle = '#4a3326';
  c.fill();
  c.save();
  hair();
  c.clip();
  c.fillStyle = '#6a4a38';
  c.beginPath(); c.ellipse(240, 70, 90, 34, -0.3, 0, 7); c.fill();
  c.fillStyle = '#392519';
  c.beginPath(); c.ellipse(420, 150, 60, 80, 0, 0, 7); c.fill();
  c.restore();
  hair();
  ink(c, 11);

  c.restore(); // head
  c.restore(); // bob
}

// ---------------------------------------------------------------- 3D billboard card (real shadow via alphaTest caster)
export const HoodieMan: React.FC<{pose: ManPose; p: V3; s?: number; yawK?: number}> = ({pose, p, s = 0.84, yawK = 0.8}) => {
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
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawHoodieMan(ctx, pose);
  tex.needsUpdate = true;
  const w = CARD_W * METERS_PER_PX * s, h = CARD_H * METERS_PER_PX * s;
  const cy = h / 2 - (CARD_H - SOLE_Y) * METERS_PER_PX * s;
  const yaw = yawK * Math.atan2(camPos.x - p[0], camPos.z - p[2]);
  return (
    <group position={p}>
      <group rotation={[0, yaw, 0]}>
        <mesh position={[0, cy, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, cy, 0]} castShadow>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
