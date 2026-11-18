// Ruri (main character, formerly HoodieCurved; the old names stay exported as aliases): head, body and face as the hoodie man, default outfit = plain solid t-shirt.
// Arms, legs, hands and feet come from the curved-limb rig (limbs.ts): ONE smooth bezier per limb, minimum bend radius (no pointed elbows or knees),
// black round-capped strokes, black ellipse hands and feet. No glow on limbs. Poses are the same ManPose fields, so walk / pickPlace / holdPhone / sit
// from motion.ts drive it with rig = RIG_GLOW (RIG_GLOW is only the name of the limb rig used here, no character is called Glow any more).
// White outer glow + white inner edge glow on head and body only (WHITE_GLOW switches both off). Arm layering follows the gaze (see drawHoodieCurved).
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {CARD_H, CARD_W, INK, METERS_PER_PX, SOLE_Y, dot, oval} from '../guard';
import {V3, clamp01, lerp, useCamPos} from './kit';
import {EXPR, Expr, ManPose} from './hoodieMan';
import {R_MIN_ARM, R_MIN_LEG, RIG_GLOW, V2 as LV2, ik2, limbCurve, strokeLimb} from './limbs';
import {ReactionDraw, drawReactionHead} from './reactionFace';


type V2 = LV2;
type T3 = [number, number, number];

// ---------------------------------------------------------------- helpers
const MIN_GAP = 26; // centre of the brow stroke to the lid line, px. Stroke is 17 px, so the visible gap is >= 17 px.
const LIMB_W = 17; // black round-capped limb stroke
const SKIN = '#fbfaf7';
const SKIN_SHADE = '#d8d8df';
const SHIRT = '#5c8a8f'; // Ruri's default t-shirt colour (same as the old hoodie body)
/** Multiply a #rrggbb colour by k (shade < 1, light > 1). */
const tint = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const LIMB_COL = '#050505';
const R = RIG_GLOW; // the motion kit (walk, holdPhone, sit) targets are in this rig's card px
const HAND: [number, number] = [22, 19], FOOT: [number, number] = [32, 21], FOOT_DY = 14; // black ellipses
const HIP_UP = 41; // RIG_GLOW hips sit 41 px below the hoodie torso bottom (650): the legs start at the torso bottom instead
const LEG_K = (R.ground - (R.hipY - HIP_UP)) / (R.leg[0] + R.leg[1]); // legs scaled to the hoodie torso
const ARM: [number, number] = [150, 140]; // hoodie arm lengths (shoulders at y 388)
const ell = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = LIMB_COL; c.fill(); };

const ink = (c: CanvasRenderingContext2D, w: number) => {
  c.strokeStyle = INK;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
};

const BODY_PIVOT: V2 = [300, 650];
const ORD01 = [0, 1], ORD10 = [1, 0];

// ---------------------------------------------------------------- optional "reference build" (WalkTest): long legs, narrow tube torso, thin arms, no feet.
// Everything is opt-in through `RuriX.look`; omitted = the original Ruri, pixel for pixel. All numbers are card px (600x1000).
export interface RuriLook {
  hipX: [number, number]; hipY: number; ground: number; leg: [number, number]; // leg start, ankle y, thigh / shin
  shX: [number, number]; shY: number; arm: [number, number]; // arm start, upper arm / forearm
  torso: {x: number; y: number; w: number; h: number; r: number};
  headK: number; limbW: number; pivotY: number; // head scale about the neck (300,335), limb stroke width, lean pivot
  hairCol?: string; messy?: boolean; belt?: boolean; star?: boolean; badge?: boolean;
}
/** `shade` = lighting tint over the whole card (source-atop, alpha k); `shrug` = shoulders raised by that many px; `look` = reference build. */
export interface RuriX {look?: RuriLook; shade?: {color: string; k: number} | null; shrug?: number}

// ---------------------------------------------------------------- outfits (same white body, only the clothes change)
// 'tshirt' is the default: plain solid colour (no hood, no pocket); pass `outfitColor` to change the colour per video. 'police' = navy shirt + cap + gold badge.
// 'casual' = lilac t-shirt + dark hair + shoulder bag. 'hoodie' is kept as a type alias of 'tshirt' (the hood and pocket are gone).
export type Outfit = 'tshirt' | 'hoodie' | 'police' | 'casual';
interface OutfitStyle {top: string; shade: string; light: string; hair: string; hairHi: string; hairLo: string}
const OUTFITS: Record<Exclude<Outfit, 'hoodie'>, OutfitStyle> = {
  tshirt: {top: SHIRT, shade: tint(SHIRT, 0.8), light: tint(SHIRT, 1.17), hair: '#4a3326', hairHi: '#6a4a38', hairLo: '#392519'},
  police: {top: '#34518a', shade: '#263d6b', light: '#4e6fae', hair: '#4a3326', hairHi: '#6a4a38', hairLo: '#392519'},
  casual: {top: '#BBA8E3', shade: '#9a86cc', light: '#d3c5f1', hair: '#241b30', hairHi: '#3d3050', hairLo: '#17111f'},
};

/** One switch for the white glow (outer halo + inner edge glow on head and body). false = no glow, nothing extra is drawn. */
export const WHITE_GLOW = true;
const GLOW_COL = '#ffffff';
const GLOW_OUTER_A = 0.8, GLOW_INNER_A = 0.12; // same strengths the Sun had in white
const GLOW_BLURS: [number, number][] = [[16, 0.9], [46, 0.75]]; // tight + wide halo (card px, alpha)
const torsoShape = (c: CanvasRenderingContext2D) => { c.beginPath(); c.roundRect(222, 340, 156, 310, 42); };
const headShape = (c: CanvasRenderingContext2D) => { c.beginPath(); c.ellipse(300, 205, 142, 133, 0, 0, 7); };
/** Outer halo: the shape filled white with a soft shadow; the opaque fill is drawn over it afterwards. K = canvas raster scale (shadowBlur is not scaled by the transform). */
const outerGlow = (c: CanvasRenderingContext2D, K: number, shape: (c: CanvasRenderingContext2D) => void) => {
  if (!WHITE_GLOW) return;
  c.save();
  c.fillStyle = GLOW_COL;
  c.shadowColor = GLOW_COL;
  for (let i = 0; i < GLOW_BLURS.length; i++) {
    c.shadowBlur = GLOW_BLURS[i][0] * K; c.globalAlpha = GLOW_BLURS[i][1] * GLOW_OUTER_A;
    shape(c); c.fill();
  }
  c.restore();
};
/** Inner edge glow clipped to the shape: stacked outline strokes of growing width, brightest at the edge and fading toward the centre (about 26 px deep). */
const innerGlow = (c: CanvasRenderingContext2D, shape: (c: CanvasRenderingContext2D) => void) => {
  if (!WHITE_GLOW) return;
  c.save();
  shape(c); c.clip();
  c.strokeStyle = GLOW_COL;
  c.globalAlpha = GLOW_INNER_A;
  for (let i = 0; i < 9; i++) { c.lineWidth = 4 + i * 6; shape(c); c.stroke(); }
  c.restore();
};

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
  [[154, 238], [128, -5], [472, -5], [446, 238]], // 0: outer cap, left tip -> right tip
  [[446, 238], [434, 196], [428, 164], [404, 146]], // 1: right hairline (temple) down to the right end of the fringe
  [[404, 146], [396, 160], [372, 160], [358, 144]], // 2..4: fringe, 3 soft scallops that fall a little over the forehead (lowest point y about 156)
  [[358, 144], [348, 158], [318, 160], [304, 144]],
  [[304, 144], [292, 156], [258, 156], [236, 140]],
  [[236, 140], [212, 148], [182, 168], [154, 238]], // last: left hairline, runs back to the left tip
];
const FRINGE_FIRST = 2, FRINGE_LAST = HAIR.length - 2;
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
  let poke = false; // hairline (temples + fringe) must stay inside the head; skip the sideburn ends, which sit on the outline by design
  HAIR.forEach((seg, k) => {
    if (k === 0) return;
    const from = k === 1 ? 4 : 0, to = k === HAIR.length - 1 ? 20 : 24;
    for (let i = from; i <= to; i++) if (ellipseVal(bez(seg, i / 24)) > 1) poke = true;
  });
  if (poke) issues.push('hairline pokes outside the head');
  // fringe must not reach the brows: lowest fringe point vs the highest brow top edge over every expression (brow stroke 17 px wide)
  let fringeLow = 0, browTop = 1e9;
  for (let k = FRINGE_FIRST; k <= FRINGE_LAST; k++) for (let i = 0; i <= 24; i++) fringeLow = Math.max(fringeLow, bez(HAIR[k], i / 24)[1]);
  for (const E of Object.values(EXPR)) for (const [side, h] of [[-1, E.bL], [1, E.bR]] as const) {
    const cx = 300 + side * EX;
    [0.5, -0.35, -1.2].forEach((k, j) => { browTop = Math.min(browTop, lidY(E, side, cx, cx - side * E.er * k) - Math.max(MIN_GAP, h[j]) - 8.5); });
  }
  if (fringeLow > browTop - 2) issues.push(`fringe reaches the brows (fringe ${fringeLow.toFixed(0)} vs brow top ${browTop.toFixed(0)})`);
  if (fringeLow < 142) issues.push('fringe too short: does not fall over the forehead');
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
/** `reaction` (optional, see reactionFace.tsx): when set, a reaction face replaces the WHOLE head (hair, face, cap); body, limbs and outfit stay. */
export function drawRuri(c: CanvasRenderingContext2D, o: ManPose, outfit: Outfit = 'tshirt', outfitColor?: string, reaction?: ReactionDraw | null, x?: RuriX) {
  const LK = x?.look;
  const {t} = o;
  const kind = outfit === 'hoodie' ? 'tshirt' : outfit;
  const base = OUTFITS[kind];
  let OF: OutfitStyle = outfitColor && kind === 'tshirt' ? {...base, top: outfitColor, shade: tint(outfitColor, 0.8), light: tint(outfitColor, 1.17)} : base;
  if (LK?.hairCol) OF = {...OF, hair: LK.hairCol, hairHi: tint(LK.hairCol, 1.35), hairLo: tint(LK.hairCol, 0.75)};
  const E = o.expr;
  const turn = o.turn ?? 0;
  const hips = o.hips ?? 0;
  const speak = o.speak ?? 0;
  c.clearRect(0, 0, CARD_W, CARD_H);
  const K = WHITE_GLOW ? c.getTransform().a || 1 : 1;
  const shake = Math.sin(t * 24) * E.shake;
  const bob = Math.sin(t * 2.2) * 2 + shake * 5;

  const bdx = o.body?.dx ?? 0, bdy = o.body?.dy ?? 0, lean = o.body?.lean ?? 0;
  const face = o.face ?? 0;
  const feet: [T3, T3] = o.feet ?? [[R.stanceX[0], R.ground, 0], [R.stanceX[1], R.ground, 0]];
  const legOrder = LK && feet[0][1] < feet[1][1] ? ORD10 : ORD01; // the lifted (swinging, nearer) leg is drawn last: the far leg passes behind
  legOrder.forEach((i) => {
    const hp: V2 = LK ? [LK.hipX[i] + bdx, LK.hipY + bdy] : [R.hipX[i] + bdx, R.hipY - HIP_UP + bdy];
    const an: V2 = [feet[i][0], feet[i][1]];
    const kn = o.knees?.[i];
    let cv, end: V2;
    if (kn) { cv = limbCurve(hp, kn, an, R_MIN_LEG); end = an; }
    else {
      const dir = face === 0 ? (i === 0 ? -1 : 1) : face;
      const r = LK ? ik2(hp, an, LK.leg[0], LK.leg[1], (p) => (p[0] - hp[0]) * dir) : ik2(hp, an, R.leg[0] * LEG_K, R.leg[1] * LEG_K, (p) => (p[0] - hp[0]) * dir);
      cv = limbCurve(hp, r.m, r.end, R_MIN_LEG); end = r.end;
    }
    strokeLimb(c, cv, LK ? LK.limbW : LIMB_W, LIMB_COL);
    if (LK) { // no drawn foot: the leg ends in a round cap, tilted a little toward the travel direction
      c.beginPath(); c.moveTo(end[0], end[1]); c.lineTo(end[0] + face * 9 + feet[i][2] * 22, end[1] + 1);
      c.strokeStyle = LIMB_COL; c.lineWidth = LK.limbW; c.lineCap = 'round'; c.stroke();
      return;
    }
    const sx = end[0] + (face === 0 ? 0 : face * 18), sy = end[1] + FOOT_DY;
    c.save();
    c.translate(sx, sy); c.rotate(feet[i][2]); c.translate(-sx, -sy);
    ell(c, sx, sy, FOOT[0], FOOT[1]);
    c.restore();
  });

  c.save();
  c.translate(bdx, bob + bdy);
  const PVY = LK ? LK.pivotY : BODY_PIVOT[1];
  if (lean) { c.translate(BODY_PIVOT[0], PVY); c.rotate(lean); c.translate(-BODY_PIVOT[0], -PVY); }
  // card-space point -> upper-body space (inverse of the transform above), so `hands` can be given in card px
  const toBody = (q: V2): V2 => {
    let x = q[0] - bdx, y = q[1] - (bob + bdy);
    if (lean) {
      const dx = x - BODY_PIVOT[0], dy = y - PVY, cs = Math.cos(-lean), sn = Math.sin(-lean);
      x = BODY_PIVOT[0] + dx * cs - dy * sn; y = PVY + dx * sn + dy * cs;
    }
    return [x, y];
  };

  // ---- arms: ONE smooth curve each (limbs.ts), black round-capped, ellipse hands, no glow.
  // Layering follows the gaze: the arm on the side the character looks toward is BEHIND the body, the other arm is in FRONT.
  // Slots: 0 = card-left arm, 1 = card-right arm. Gaze = sign of `turn` (card-right = +) when |turn| > 0.05, else the walk direction `face`, else card-right.
  // Gaze card-right: slot 0 front, slot 1 behind. Gaze card-left: slot 1 front, slot 0 behind. Instant swap when the sign flips.
  const sway = Math.sin(t * 2.2 + 1) * 3;
  const HIP: [V2, V2] = [[240, 612], [360, 612]];
  const shY = LK ? LK.shY - (x?.shrug ?? 0) : 388;
  const SH: [V2, V2] = LK ? [[LK.shX[0], shY], [LK.shX[1], shY]] : [[232, 388], [368, 388]];
  const armL = LK ? LK.arm : ARM, armW = LK ? LK.limbW : LIMB_W;
  const gaze = Math.abs(turn) > 0.05 ? Math.sign(turn) : face !== 0 ? face : 1;
  const front = gaze > 0 ? 0 : 1, back = 1 - front;
  const drawPhone = (h: V2) => {
    if (!o.phone) return;
    c.save();
    c.translate(h[0], h[1]);
    c.rotate(((o.phone.tilt ?? 0) * Math.PI) / 180);
    c.beginPath(); c.roundRect(-30, -112, 60, 116, 12);
    c.fillStyle = '#2b2d3a'; c.fill();
    c.beginPath(); c.roundRect(-24, -104, 48, 96, 7);
    c.fillStyle = o.phone.glow ?? '#9fd0ff'; c.fill();
    c.beginPath(); c.roundRect(-30, -112, 60, 116, 12); ink(c, 6);
    c.restore();
  };
  const drawArm = (i: number) => {
    const tgt = o.hands?.[i];
    let hand: V2;
    if (tgt) hand = toBody(tgt);
    else {
      const rest = R.handRest[i];
      hand = [lerp(rest[0] + (i ? sway : -sway), HIP[i][0], hips), lerp(rest[1], HIP[i][1], hips)];
    }
    const {m, end} = ik2(SH[i], hand, armL[0], armL[1], (p) => (p[0] - 300) * (i ? 1 : -1) + p[1] * 0.2);
    strokeLimb(c, limbCurve(SH[i], m, end, R_MIN_ARM), armW, LIMB_COL);
    if (o.phone && o.phone.hand === i) drawPhone(hand);
    const g = 2 * (o.grip?.[i] ?? 0);
    if (LK) ell(c, end[0], end[1], 9 - g * 0.5, 9 - g * 0.5);
    else ell(c, end[0], end[1], HAND[0] - g, HAND[1] - g);
  };

  // ---- back arm (behind the body)
  drawArm(back);

  // ---- body: outer glow, hood behind the head, torso (flat colour + hard cel shade), inner edge glow
  const T = LK ? LK.torso : null;
  const tShape = T ? (cc: CanvasRenderingContext2D) => { cc.beginPath(); cc.roundRect(T.x, T.y, T.w, T.h, T.r); } : torsoShape;
  outerGlow(c, K, tShape);
  const torso = () => tShape(c);
  torso();
  c.fillStyle = OF.top;
  c.fill();
  c.save();
  torso();
  c.clip();
  if (T) {
    c.fillStyle = OF.shade; c.fillRect(T.x + T.w * 0.66, T.y, T.w, T.h);
    c.fillStyle = OF.light; c.fillRect(T.x, T.y + 10, T.w * 0.16, T.h * 0.6);
    if (LK!.belt) { c.fillStyle = '#10182e'; c.fillRect(T.x, T.y + T.h - 56, T.w, 18); }
  } else {
  c.fillStyle = OF.shade;
  c.beginPath(); c.moveTo(340, 340); c.quadraticCurveTo(326, 500, 344, 650); c.lineTo(380, 650); c.lineTo(380, 340); c.closePath(); c.fill();
  c.fillStyle = OF.light;
  c.beginPath(); c.moveTo(222, 380); c.quadraticCurveTo(238, 480, 230, 560); c.lineTo(222, 560); c.closePath(); c.fill();
  c.fillStyle = OF.shade;
  c.fillRect(222, 618, 156, 40);
  }
  if (kind === 'casual') { // bag strap across the chest (clipped to the torso)
    c.beginPath(); c.moveTo(258, 330); c.lineTo(296, 330); c.lineTo(392, 600); c.lineTo(350, 616); c.closePath();
    c.fillStyle = '#c9788a'; c.fill();
  }
  c.restore();
  innerGlow(c, tShape);
  torso();
  ink(c, 12);
  if (T) {
    if (LK!.belt) { // buckle
      c.beginPath(); c.roundRect(T.x + T.w / 2 - 11, T.y + T.h - 59, 22, 24, 4); c.fillStyle = '#f2c14e'; c.fill(); ink(c, 5);
    }
    if (kind === 'police') { // small gold badge on the chest
      c.beginPath(); c.moveTo(T.x + 58, T.y + 40); c.lineTo(T.x + 86, T.y + 40); c.quadraticCurveTo(T.x + 86, T.y + 66, T.x + 72, T.y + 76); c.quadraticCurveTo(T.x + 58, T.y + 66, T.x + 58, T.y + 40); c.closePath();
      c.fillStyle = '#f2c14e'; c.fill(); ink(c, 5);
    }
    if (LK!.badge) { // prisoner chest tag
      c.beginPath(); c.roundRect(T.x + 58, T.y + 38, 30, 22, 4); c.fillStyle = '#f4f1e8'; c.fill(); ink(c, 4);
      c.beginPath(); c.moveTo(T.x + 64, T.y + 49); c.lineTo(T.x + 82, T.y + 49); ink(c, 4);
    }
  } else { c.beginPath(); c.moveTo(224, 618); c.lineTo(376, 618); ink(c, 7); }

  if (T) { /* badge drawn above for the reference build */ } else if (kind === 'police') { // badge: gold shield on the left chest (viewer right)
    c.beginPath(); c.moveTo(318, 430); c.lineTo(358, 430); c.quadraticCurveTo(358, 470, 338, 488); c.quadraticCurveTo(318, 470, 318, 430); c.closePath();
    c.fillStyle = '#f2c14e'; c.fill(); ink(c, 6);
    c.beginPath(); c.arc(338, 456, 7, 0, 7); c.fillStyle = '#b8862b'; c.fill();
  } else if (kind === 'casual' && !T) { // small shoulder bag at the hip (dusty rose)
    c.beginPath(); c.roundRect(318, 552, 76, 64, 14); c.fillStyle = '#E9A6B3'; c.fill();
    c.beginPath(); c.roundRect(318, 552, 76, 26, 14); c.fillStyle = '#d98a9b'; c.fill();
    c.beginPath(); c.roundRect(318, 552, 76, 64, 14); ink(c, 7);
    c.beginPath(); c.arc(356, 580, 5, 0, 7); c.fillStyle = '#f4f1e8'; c.fill();
  }

  // ---- front arm (in front of the body)
  drawArm(front);

  // ---- crew neckline (plain t-shirt, no hood): small neck opening in the shade colour
  c.beginPath(); c.ellipse(300, T ? T.y + 8 : 346, T ? 30 : 54, T ? 10 : 17, 0, 0, 7);
  c.fillStyle = OF.shade;
  c.fill();
  ink(c, 9);

  // ---- head (no ears, no nose, no blush)
  const tilt = ((E.tilt + shake * 3 + (o.headRoll ?? 0)) * Math.PI) / 180;
  c.save();
  c.translate(0, o.nod ?? 0);
  c.translate(300, 335);
  c.rotate(tilt);
  if (LK) c.scale(LK.headK, LK.headK);
  c.translate(-300, -335);
  const hx = 300, hy = 205, rx = 142, ry = 133;
  if (reaction) drawReactionHead(c, K, reaction, WHITE_GLOW ? GLOW_BLURS : null, GLOW_OUTER_A);
  else {
  outerGlow(c, K, headShape);
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
  innerGlow(c, headShape);
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
  c.fillStyle = OF.hair;
  c.fill();
  c.save();
  hair();
  c.clip();
  c.fillStyle = OF.hairHi;
  c.beginPath(); c.ellipse(240, 70, 90, 34, -0.3, 0, 7); c.fill();
  c.fillStyle = OF.hairLo;
  c.beginPath(); c.ellipse(420, 150, 60, 80, 0, 0, 7); c.fill();
  c.restore();
  hair();
  ink(c, 11);
  if (LK?.messy) { // short messy tufts poking out of the cap (deterministic)
    const TU: [number, number, number, number][] = [[0.22, 34, -6, 20], [0.34, 46, 8, 22], [0.47, 38, -10, 24], [0.6, 50, 6, 22], [0.73, 36, -4, 20]]; // t on the cap, length, sideways lean, half base
    for (const [tt, len, lean2, hb] of TU) {
      const P = bez(HAIR[0], tt), Q = bez(HAIR[0], tt + 0.02);
      let nx = P[0] - 300, ny = P[1] - 215; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const tx = Q[0] - P[0], ty = Q[1] - P[1], tl = Math.hypot(tx, ty) || 1;
      const ux = tx / tl, uy = ty / tl;
      const tip: V2 = [P[0] + nx * len + ux * lean2, P[1] + ny * len + uy * lean2];
      c.beginPath();
      c.moveTo(P[0] - ux * hb, P[1] - uy * hb + 6);
      c.quadraticCurveTo(P[0] - ux * hb * 0.6 + nx * len * 0.6, P[1] - uy * hb * 0.6 + ny * len * 0.6, tip[0], tip[1]);
      c.quadraticCurveTo(P[0] + ux * hb * 0.6 + nx * len * 0.5, P[1] + uy * hb * 0.6 + ny * len * 0.5, P[0] + ux * hb, P[1] + uy * hb + 6);
      c.closePath(); c.fillStyle = OF.hair; c.fill(); ink(c, 7);
    }
    hair(); c.fillStyle = OF.hair; c.fill(); // re-cover the tuft bases so they merge into the cap
  }

  if (kind === 'police') { // cap: dome + band + thin visor, kept above the brows (brows reach up to about y 161)
    c.beginPath(); c.moveTo(150, 128); c.bezierCurveTo(138, 0, 462, 0, 450, 128); c.closePath();
    c.fillStyle = OF.top; c.fill();
    c.save(); c.clip();
    c.fillStyle = OF.shade; c.beginPath(); c.ellipse(430, 90, 70, 70, 0, 0, 7); c.fill();
    c.fillStyle = OF.light; c.beginPath(); c.ellipse(230, 50, 80, 22, -0.25, 0, 7); c.fill();
    c.restore();
    c.beginPath(); c.moveTo(150, 128); c.bezierCurveTo(138, 0, 462, 0, 450, 128); c.closePath(); ink(c, 10);
    c.beginPath(); c.roundRect(142, 106, 316, 32, 14); c.fillStyle = '#1f2f55'; c.fill(); ink(c, 8);
    c.beginPath(); c.ellipse(300, 142, 112, 9, 0, 0, 7); c.fillStyle = '#10182e'; c.fill(); ink(c, 6);
    if (LK?.star) { // small gold star on the cap band
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 7 : 16; c.lineTo(300 + Math.cos(a) * rr, 122 + Math.sin(a) * rr); }
      c.closePath(); c.fillStyle = '#f2c14e'; c.fill(); ink(c, 4);
    } else {
    c.beginPath(); c.moveTo(300, 60); c.lineTo(322, 62); c.quadraticCurveTo(322, 86, 300, 98); c.quadraticCurveTo(278, 86, 278, 62); c.closePath();
    c.fillStyle = '#f2c14e'; c.fill(); ink(c, 5);
    }
  }
  } // end of Ruri's own head (skipped while a reaction face is shown)

  c.restore(); // head
  c.restore(); // bob
  if (x?.shade && x.shade.k > 0) { // lighting shift (e.g. standing in a shadow): tint everything painted so far
    c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = x.shade.k; c.fillStyle = x.shade.color; c.fillRect(0, 0, CARD_W, CARD_H); c.restore();
  }
}

// ---------------------------------------------------------------- 3D billboard card (real shadow via alphaTest caster)
/** Old name, same function. */
export const drawHoodieCurved = drawRuri;
export const Ruri: React.FC<{pose: ManPose; p: V3; s?: number; yawK?: number; outfit?: Outfit; outfitColor?: string; reaction?: ReactionDraw | null; x?: RuriX}> = ({pose, p, s = 0.84, yawK = 0.8, outfit = 'tshirt', outfitColor, reaction, x}) => {
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
  useEffect(() => () => tex.dispose(), [tex]); // raw CanvasTexture is not tracked by the kit: free it when the shot ends (Render stability rule 1)
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawRuri(ctx, pose, outfit, outfitColor, reaction, x);
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
/** Old name, same component. */
export const HoodieCurved = Ruri;
