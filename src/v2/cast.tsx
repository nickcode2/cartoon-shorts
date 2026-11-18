// The three characters of CrisisShortV2 in the approved style (see STYLE_NOTES "DEFAULT STYLE"): white skin with flat grey cel shading,
// small half-lidded eyes, brows above with a gap (MIN_GAP), single thick ink limbs, dot hands, oval shoes. Face code is the same as
// src/kit/hoodieMan.tsx (which stays untouched); this file adds outfits (hoodie man, neighbor, rescue worker), hand targets, props, walking.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {staticFile} from 'remotion';
import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {CARD_H, CARD_W, INK, METERS_PER_PX, SOLE_Y, dot, oval, poly} from '../guard';
import {V3, clamp01, lerp, useCamPos} from '../kit/kit';
import {EXPR, Expr, mixExpr} from '../kit/hoodieMan';
import {fitCover} from './gfx';

type V2 = [number, number];
type T3 = [number, number, number];

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


// ================================================================ CrisisShortV2 additions
export type Who = 'man' | 'neighbor' | 'rescue';
export type Prop = 'none' | 'bag' | 'booklet' | 'phone' | 'keys' | 'clip' | 'radio' | 'can' | 'jug' | 'lantern' | 'flash';
export type Mood = 'calm' | 'smile' | 'smirk' | 'laugh' | 'shock' | 'worry' | 'serious' | 'sad';

// only the approved expression set, blended with mixExpr
export const moodExpr = (m: Mood): Expr => {
  switch (m) {
    case 'calm': return EXPR.neutral;
    case 'smile': return mixExpr(EXPR.neutral, EXPR.smug, 0.55);
    case 'smirk': return EXPR.smug;
    case 'laugh': return EXPR.laughing;
    case 'shock': return EXPR.surprised;
    case 'worry': return mixExpr(EXPR.neutral, EXPR.surprised, 0.45);
    case 'serious': return mixExpr(EXPR.neutral, EXPR.angry, 0.35);
    default: return mixExpr(EXPR.neutral, EXPR.surprised, 0.2); // sad
  }
};

export interface CastPose {
  who: Who;
  t: number; // absolute seconds (blink / breathing)
  mood?: Mood;
  expr?: Expr; // overrides mood
  speak?: number; // 0..1 mouth opening
  turn?: number; // head turn -1..1
  look?: number; // pupils -1..1
  walk?: number; // 0 stand, 1 walk, 2 run
  hoodUp?: boolean;
  hL?: V2 | null; // viewer-left hand target (card px)
  hR?: V2 | null;
  propL?: Prop;
  propR?: Prop;
  fingers?: number; // raised fingers on the viewer-left hand
  glow?: number; // lantern / phone glow
}

const OUTFIT: Record<Who, {main: string; shade: string; light: string}> = {
  man: {main: HOOD, shade: HOOD_SHADE, light: HOOD_LIGHT},
  neighbor: {main: '#e8853f', shade: '#c46a2a', light: '#f4a468'},
  rescue: {main: '#f0661c', shade: '#cf4f0f', light: '#ff8a44'},
};

const fillInk = (c: CanvasRenderingContext2D, fill: string, w = 7) => {
  c.fillStyle = fill;
  c.fill();
  ink(c, w);
};
const rrect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, lw = 7) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  fillInk(c, fill, lw);
};

let coverCache: HTMLCanvasElement | null = null;
const coverCanvas = () => {
  if (coverCache) return coverCache;
  coverCache = document.createElement('canvas');
  coverCache.width = 320;
  coverCache.height = 470;
  fitCover(coverCache.getContext('2d')!, 320, 470);
  return coverCache;
};

function drawProp(c: CanvasRenderingContext2D, p: Prop, x: number, y: number, t: number, glow: number, side: number) {
  c.save();
  c.translate(x, y);
  switch (p) {
    case 'bag': {
      rrect(c, -54, 34, 108, 160, 8, '#d9b384');
      c.fillStyle = '#c49a6a'; c.fillRect(24, 38, 26, 152);
      c.beginPath(); c.moveTo(-50, 70); c.lineTo(50, 70); ink(c, 4);
      c.beginPath(); c.moveTo(-26, 34); c.quadraticCurveTo(0, -16, 26, 34); ink(c, 7);
      c.save(); c.translate(-26, 28); c.rotate(-0.35); rrect(c, -10, -52, 22, 70, 10, '#e0a85a', 5); c.restore();
      c.save(); c.translate(22, 28); c.rotate(0.3); rrect(c, -8, -44, 16, 60, 8, '#5fae52', 5); c.restore();
      break;
    }
    case 'booklet': {
      c.rotate(side * 0.1);
      c.drawImage(coverCanvas(), -54, -184, 108, 158);
      c.beginPath(); c.rect(-54, -184, 108, 158); ink(c, 6);
      break;
    }
    case 'phone': {
      c.rotate(side * 0.1);
      rrect(c, -34, -104, 68, 112, 12, '#262b38');
      c.fillStyle = glow > 0.05 ? '#8fe3ff' : '#0c0d12';
      c.fillRect(-27, -94, 54, 92);
      if (glow > 0.05) {
        c.fillStyle = '#e8fbff';
        for (let i = 0; i < 3; i++) c.fillRect(-18 + i * 14, -40 - i * 10, 9, 28 + i * 10);
      }
      break;
    }
    case 'keys': {
      c.rotate(Math.sin(t * 10) * 0.12);
      c.beginPath(); c.arc(0, 18, 18, 0, 7); ink(c, 6);
      for (const a of [-0.4, 0.3]) { c.save(); c.rotate(a); rrect(c, -8, 32, 16, 62, 4, '#e8c24a', 5); c.restore(); }
      break;
    }
    case 'clip': {
      rrect(c, -62, -176, 124, 164, 8, '#9b6b3c');
      c.fillStyle = '#fffdf2'; c.fillRect(-50, -154, 100, 126);
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-40, -138 + i * 24); c.lineTo(40 - (i % 2) * 22, -138 + i * 24); ink(c, 4); }
      rrect(c, -24, -190, 48, 24, 5, '#c8ccd6', 5);
      break;
    }
    case 'radio': {
      rrect(c, -66, -86, 132, 82, 12, '#c0392b');
      c.beginPath(); c.arc(-24, -46, 22, 0, 7); fillInk(c, '#f4e3d0', 5);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(16, -66 + i * 16); c.lineTo(52, -66 + i * 16); ink(c, 5); }
      c.beginPath(); c.moveTo(44, -86); c.lineTo(76, -160); ink(c, 5);
      break;
    }
    case 'can': {
      rrect(c, -26, -72, 52, 72, 6, '#d7513b', 6);
      c.fillStyle = '#f3e2c0'; c.fillRect(-23, -52, 46, 22);
      break;
    }
    case 'jug': {
      rrect(c, -48, -128, 96, 128, 20, '#7cc9f2');
      rrect(c, -20, -152, 40, 30, 8, '#2f7fb8', 6);
      c.beginPath(); c.moveTo(36, -108); c.quadraticCurveTo(70, -92, 36, -62); ink(c, 6);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-34, -112, 10, 84);
      break;
    }
    case 'lantern': {
      if (glow > 0) {
        const g = c.createRadialGradient(0, -48, 5, 0, -48, 230);
        g.addColorStop(0, `rgba(255,214,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = g; c.fillRect(-240, -290, 480, 480);
      }
      rrect(c, -32, -86, 64, 78, 10, '#2b3a4a', 6);
      c.beginPath(); c.ellipse(0, -46, 20, 28, 0, 0, 7); fillInk(c, '#ffd77a', 4);
      c.beginPath(); c.moveTo(-22, -86); c.quadraticCurveTo(0, -122, 22, -86); ink(c, 5);
      break;
    }
    case 'flash': {
      c.rotate(side * -0.3);
      rrect(c, -15, -90, 30, 84, 8, '#2a2f3a', 6);
      rrect(c, -24, -122, 48, 40, 8, '#f2c53d', 6);
      break;
    }
    default:
  }
  c.restore();
}

// ---------------------------------------------------------------- the person
export function drawCast(c: CanvasRenderingContext2D, o: CastPose) {
  const {t, who} = o;
  const OF = OUTFIT[who];
  const E0 = o.expr ?? moodExpr(o.mood ?? 'calm');
  const E: Expr = o.look !== undefined ? {...E0, gx: o.look} : E0;
  const turn = o.turn ?? 0;
  const speak = o.speak ?? 0;
  const walk = o.walk ?? 0;
  c.clearRect(0, 0, CARD_W, CARD_H);
  const shake = Math.sin(t * 24) * E.shake;
  const ph = t * (walk === 2 ? 9 : 6.2);
  const bob = Math.sin(t * 2.2) * 2 + shake * 5 + (walk ? Math.abs(Math.sin(ph)) * (walk === 2 ? 12 : 7) : 0);

  // ---- legs
  const hipsP: V2[] = [[274, 644], [326, 644]];
  const ank: V2[] = [];
  [0, 1].forEach((i) => {
    const side = i ? 1 : -1;
    const p = ph + i * Math.PI;
    const sw = walk ? Math.sin(p) * (walk === 2 ? 46 : 30) : 0;
    const lift = walk ? Math.max(0, Math.cos(p)) * (walk === 2 ? 38 : 22) : 0;
    const a: V2 = [300 + side * 38 + sw, 942 - lift];
    const k: V2 = [(hipsP[i][0] + a[0]) / 2 + side * 6 + (walk ? lift * 0.5 * side : 0), 800 - lift * 0.45];
    ank.push(a);
    poly(c, [hipsP[i], k, a], LIMB_W);
    if (who === 'neighbor') {
      const mid: V2 = [lerp(hipsP[i][0], k[0], 0.9), lerp(hipsP[i][1], k[1], 0.75)];
      poly(c, [[hipsP[i][0], hipsP[i][1] - 6], mid], 58, INK);
      poly(c, [[hipsP[i][0], hipsP[i][1] - 6], mid], 44, '#3f6fb0');
      poly(c, [[hipsP[i][0] + side * 12, hipsP[i][1] - 6], [mid[0] + side * 12, mid[1]]], 12, '#2e558f');
    }
    if (who === 'rescue') {
      const b: V2 = [lerp(k[0], a[0], 0.72), lerp(k[1], a[1], 0.72)];
      c.save();
      c.translate(b[0], b[1]);
      c.beginPath(); c.roundRect(-20, -7, 40, 14, 4);
      fillInk(c, '#dfe7ee', 5);
      c.restore();
    }
  });
  // ---- shoes
  ank.forEach((a, i) => {
    const cx = a[0], cy = a[1] + 14;
    c.beginPath(); c.ellipse(cx, cy, 36, 15, 0, 0, 7);
    c.fillStyle = who === 'rescue' ? '#3b3b46' : who === 'neighbor' ? '#e9ecf2' : '#f4f3ee';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = who === 'rescue' ? '#26262e' : SKIN_SHADE;
    c.fillRect(cx - 40, cy + 3, 80, 16);
    c.restore();
    ink(c, 7);
    void i;
  });

  c.save();
  c.translate(0, bob);

  // ---- hood behind the head (man) / collar base
  if (who === 'man') {
    c.beginPath(); c.ellipse(300, 352, 112, 46, 0, 0, 7);
    c.fillStyle = HOOD_SHADE; c.fill(); ink(c, 11);
  }

  // ---- torso
  const torso = () => { c.beginPath(); c.roundRect(222, 340, 156, 310, 42); };
  torso();
  c.fillStyle = OF.main;
  c.fill();
  c.save();
  torso();
  c.clip();
  c.fillStyle = OF.shade;
  c.beginPath(); c.moveTo(340, 340); c.quadraticCurveTo(326, 500, 344, 650); c.lineTo(380, 650); c.lineTo(380, 340); c.closePath(); c.fill();
  c.fillStyle = OF.light;
  c.beginPath(); c.moveTo(222, 380); c.quadraticCurveTo(238, 480, 230, 560); c.lineTo(222, 560); c.closePath(); c.fill();
  if (who === 'man') { c.fillStyle = HOOD_SHADE; c.fillRect(222, 618, 156, 40); }
  if (who === 'neighbor') {
    c.fillStyle = '#fbf3df'; c.fillRect(222, 462, 156, 30);
    c.fillStyle = '#e9dcc2'; c.fillRect(340, 462, 40, 30);
    c.fillStyle = OF.shade; c.fillRect(222, 626, 156, 30);
  }
  if (who === 'rescue') {
    c.fillStyle = '#2f4a78'; c.fillRect(222, 340, 28, 140); c.fillRect(350, 340, 28, 140);
    c.fillStyle = '#e4ecf1'; c.fillRect(222, 500, 156, 28); c.fillRect(222, 570, 156, 28);
    c.fillStyle = '#b9c6cf'; c.fillRect(340, 500, 40, 28); c.fillRect(340, 570, 40, 28);
    c.fillStyle = OF.shade; c.fillRect(222, 626, 156, 30);
  }
  c.restore();
  torso();
  ink(c, 12);
  if (who === 'man') { c.beginPath(); c.moveTo(224, 618); c.lineTo(376, 618); ink(c, 7); }
  if (who === 'rescue') {
    for (const y of [500, 570]) { c.beginPath(); c.rect(224, y, 152, 28); ink(c, 4); }
    c.beginPath(); c.moveTo(300, 380); c.lineTo(300, 640); ink(c, 5);
  }
  if (who === 'neighbor') { c.beginPath(); c.moveTo(224, 462); c.lineTo(376, 462); ink(c, 4); c.beginPath(); c.moveTo(224, 492); c.lineTo(376, 492); ink(c, 4); }

  // kangaroo pocket (hoodie)
  if (who === 'man') {
    c.beginPath(); c.roundRect(246, 508, 108, 76, 20);
    c.fillStyle = '#527f85'; c.fill();
    c.save();
    c.beginPath(); c.roundRect(246, 508, 108, 76, 20); c.clip();
    c.fillStyle = HOOD_SHADE; c.fillRect(246, 566, 108, 20);
    c.restore();
    c.beginPath(); c.roundRect(246, 508, 108, 76, 20); ink(c, 8);
  }

  // ---- arms: single thick ink lines + round dot hands (+ props)
  const sway = Math.sin(t * 2.2 + 1) * 3;
  const SH: [V2, V2] = [[232, 388], [368, 388]];
  const HANG: [V2, V2] = [[210 - sway, 656], [390 + sway, 656]];
  const targets: (V2 | null | undefined)[] = [o.hL, o.hR];
  const hands: V2[] = [0, 1].map((i) => {
    const tg = targets[i];
    if (tg) return tg;
    if (walk) {
      const p = ph + (i ? 0 : Math.PI);
      return [HANG[i][0] + (i ? 6 : -6), HANG[i][1] - 18 + Math.cos(p) * (walk === 2 ? 44 : 26)] as V2;
    }
    return HANG[i];
  });
  const props: (Prop | undefined)[] = [o.propL, o.propR];
  [-1, 1].forEach((side, i) => {
    const el = elbow(SH[i], hands[i], side);
    poly(c, [SH[i], el, hands[i]], LIMB_W);
  });
  [0, 1].forEach((i) => {
    const pr = props[i];
    if (pr && pr !== 'none') drawProp(c, pr, hands[i][0], hands[i][1], t, o.glow ?? 0, i ? 1 : -1);
    dot(c, hands[i][0], hands[i][1], 23);
  });
  if ((o.fingers ?? 0) > 0) {
    const n = o.fingers!;
    for (let k = 0; k < n; k++) {
      const a = (k - (n - 1) / 2) * 0.42;
      c.beginPath();
      c.moveTo(hands[0][0] + Math.sin(a) * 14, hands[0][1] - 16);
      c.lineTo(hands[0][0] + Math.sin(a) * 62, hands[0][1] - 16 - Math.cos(a) * 62);
      c.strokeStyle = INK; c.lineWidth = 15; c.lineCap = 'round'; c.stroke();
    }
  }

  // ---- drawstrings (hoodie)
  if (who === 'man') {
    for (const [x1, x2] of [[282, 276], [318, 324]]) {
      c.beginPath(); c.moveTo(x1, 372); c.quadraticCurveTo(x1 - 3, 420, x2, 462);
      c.strokeStyle = '#f4f1e8'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();
      dot(c, x2, 466, 6);
    }
  }

  // ---- front collar
  c.beginPath(); c.ellipse(300, 352, who === 'man' ? 72 : 52, who === 'man' ? 25 : 20, 0, 0, 7);
  c.fillStyle = who === 'man' ? HOOD_LIGHT : who === 'neighbor' ? OF.light : '#2f4a78';
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = who === 'man' ? HOOD_SHADE : who === 'neighbor' ? OF.shade : '#233a60';
  c.fillRect(220, 354, 160, 30);
  c.restore();
  ink(c, 9);

  // ---- head
  const tilt = ((E.tilt + shake * 3) * Math.PI) / 180;
  c.save();
  c.translate(300, 335);
  c.rotate(tilt);
  c.translate(-300, -335);
  const hx = 300, hy = 205, rx = 142, ry = 133;
  c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7);
  c.fillStyle = SKIN_SHADE; c.fill();
  c.save();
  c.clip();
  c.beginPath(); c.ellipse(hx - 16, hy - 12, rx - 2, ry - 4, 0, 0, 7);
  c.fillStyle = SKIN; c.fill();
  // hair / helmet cast shadow on the forehead
  c.save();
  c.translate(0, 20);
  c.beginPath();
  c.moveTo(166, 200); c.bezierCurveTo(146, 8, 454, 8, 434, 200);
  c.bezierCurveTo(424, 152, 394, 120, 342, 114); c.bezierCurveTo(300, 108, 252, 112, 214, 130); c.bezierCurveTo(190, 140, 172, 166, 166, 200);
  c.closePath();
  c.fillStyle = SKIN_SHADE; c.fill();
  c.restore();
  c.restore();
  c.beginPath(); c.ellipse(hx, hy, rx, ry, 0, 0, 7);
  ink(c, 12);

  // features
  c.save();
  c.translate(300 + turn * 30, 0);
  c.scale(1 - 0.1 * Math.abs(turn), 1);
  c.translate(-300, 0);
  const bph = t % 3.5;
  const blink = E.closed > 0.5 || bph < 1.1 || bph > 1.22 ? 0 : Math.sin(((bph - 1.1) / 0.12) * Math.PI);
  drawEye(c, E, -1, blink);
  drawEye(c, E, 1, blink);
  drawBrow(c, E, -1, E.bL);
  drawBrow(c, E, 1, E.bR);
  drawMouth(c, E, speak);
  c.restore();

  // ---- headwear
  const hair = () => {
    c.beginPath();
    c.moveTo(166, 200); c.bezierCurveTo(146, 8, 454, 8, 434, 200);
    c.bezierCurveTo(424, 152, 394, 120, 342, 114); c.bezierCurveTo(300, 108, 252, 112, 214, 130); c.bezierCurveTo(190, 140, 172, 166, 166, 200);
    c.closePath();
  };
  if (who === 'man' && o.hoodUp) {
    c.beginPath();
    c.ellipse(300, 212, 170, 162, 0, 0, 7);
    c.moveTo(428, 222);
    c.ellipse(300, 222, 128, 120, 0, 0, 7);
    c.fillStyle = HOOD;
    c.fill('evenodd');
    c.save();
    c.beginPath(); c.ellipse(300, 212, 170, 162, 0, 0, 7); c.moveTo(428, 222); c.ellipse(300, 222, 128, 120, 0, 0, 7); c.clip('evenodd');
    c.fillStyle = HOOD_SHADE;
    c.beginPath(); c.ellipse(350, 240, 190, 150, 0, 0, 7); c.fill();
    c.fillStyle = HOOD;
    c.beginPath(); c.ellipse(286, 220, 164, 156, 0, 0, 7); c.fill();
    c.restore();
    c.beginPath(); c.ellipse(300, 212, 170, 162, 0, 0, 7); ink(c, 11);
    c.beginPath(); c.ellipse(300, 222, 128, 120, 0, 0, 7); ink(c, 8);
  } else if (who === 'rescue') {
    // helmet: white dome, red band, lamp, brim
    const dome = () => { c.beginPath(); c.moveTo(150, 170); c.bezierCurveTo(138, -6, 462, -6, 450, 170); c.closePath(); };
    dome();
    c.fillStyle = '#f4f4ee'; c.fill();
    c.save(); dome(); c.clip();
    c.fillStyle = '#d2d2ca'; c.beginPath(); c.ellipse(420, 120, 70, 120, 0, 0, 7); c.fill();
    c.fillStyle = '#d93a40'; c.fillRect(120, 70, 360, 26);
    c.fillStyle = '#b72d33'; c.fillRect(380, 70, 100, 26);
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(240, 44, 70, 18, -0.3, 0, 7); c.fill();
    c.restore();
    dome(); ink(c, 11);
    c.beginPath(); c.roundRect(268, 100, 64, 38, 8); fillInk(c, '#f2c53d', 6);
    c.beginPath(); c.ellipse(300, 170, 156, 24, 0, 0, 7); fillInk(c, '#e9e9e1', 10);
  } else {
    hair();
    c.fillStyle = who === 'man' ? '#4a3326' : '#d7a640';
    c.fill();
    c.save();
    hair(); c.clip();
    c.fillStyle = who === 'man' ? '#6a4a38' : '#e9c46a';
    c.beginPath(); c.ellipse(240, 70, 90, 34, -0.3, 0, 7); c.fill();
    c.fillStyle = who === 'man' ? '#392519' : '#b98a2c';
    c.beginPath(); c.ellipse(420, 150, 60, 80, 0, 0, 7); c.fill();
    c.restore();
    hair(); ink(c, 11);
    if (who === 'neighbor') {
      // messy tufts
      for (const [tx, ty, ang] of [[236, 40, -0.5], [300, 14, 0], [366, 42, 0.5]] as [number, number, number][]) {
        c.save(); c.translate(tx, ty); c.rotate(ang);
        c.beginPath(); c.moveTo(-24, 28); c.quadraticCurveTo(-8, -26, 6, -34); c.quadraticCurveTo(14, -2, 26, 28); c.closePath();
        fillInk(c, '#d7a640', 9);
        c.restore();
      }
    }
  }

  c.restore(); // head
  c.restore(); // bob
}

// ---------------------------------------------------------------- 3D billboard card (real shadow via alphaTest caster)
export const Cast: React.FC<{pose: CastPose; p: V3; s?: number; yawK?: number; yaw?: number}> = ({pose, p, s = 0.84, yawK = 0.8, yaw: fixedYaw}) => {
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
  drawCast(ctx, pose);
  tex.needsUpdate = true;
  const w = CARD_W * METERS_PER_PX * s, h = CARD_H * METERS_PER_PX * s;
  const cy = h / 2 - (CARD_H - SOLE_Y) * METERS_PER_PX * s;
  const yaw = fixedYaw ?? yawK * Math.atan2(camPos.x - p[0], camPos.z - p[2]);
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

// ---------------------------------------------------------------- mouth flap from the real voice file (window = frames of the spoken line)
const VOICE = staticFile('voiceover_clean.mp3');
export function useMouthFlap(frame: number, from: number, to: number): number {
  const data = useAudioData(VOICE);
  if (!data || frame < from || frame >= to) return 0;
  const bins = visualizeAudio({fps: 30, frame, audioData: data, numberOfSamples: 32});
  const e = bins.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  return Math.round(clamp01(Math.sqrt(e) * 2.6) * 20) / 20;
}
