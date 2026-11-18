// The hoodie man's face (eyes, brows, mouth), copied unchanged from hoodieMan.tsx so the new characters keep exactly the same face and
// expression set (EXPR / mixExpr from hoodieMan). Coordinates are the hoodie head's (centre 300,205, radius ~142): glowChar.tsx
// translates/scales this layer onto the new head. Only the stroke colour is a parameter: dark ink on the bright sun, pale on the dark
// universe head (dark brows and mouth would be invisible on it).
import {INK, oval} from '../guard';
import {Expr} from './hoodieMan';
import {clamp01, lerp} from './kit';

type V2 = [number, number];
type T3 = [number, number, number];
const MIN_GAP = 26; // centre of the brow stroke to the lid line, px (same as hoodieMan)
let inkColor: string = INK;
let featureColor: string | null = null; // optional colour for eyebrows and mouth only (eyes keep inkColor)
const ink = (c: CanvasRenderingContext2D, w: number) => {
  c.strokeStyle = inkColor;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
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


/** Draw the face in hoodie head coordinates. `turn` shifts/squeezes the features like the hoodie man; blink every 3.5 s (staggered by blinkPhase). */
export function drawFace(c: CanvasRenderingContext2D, E: Expr, o: {t: number; turn?: number; speak?: number; blinkPhase?: number; ink?: string; featureInk?: string}) {
  inkColor = o.ink ?? INK;
  featureColor = o.featureInk ?? null;
  const turn = o.turn ?? 0, speak = o.speak ?? 0;
  c.save();
  c.translate(300 + turn * 30, 0);
  c.scale(1 - 0.1 * Math.abs(turn), 1);
  c.translate(-300, 0);
  const ph = (o.t + (o.blinkPhase ?? 0)) % 3.5;
  const blink = E.closed > 0.5 || ph < 1.1 || ph > 1.22 ? 0 : Math.sin(((ph - 1.1) / 0.12) * Math.PI);
  drawEye(c, E, -1, blink);
  drawEye(c, E, 1, blink);
  const eyeInk = inkColor;
  if (featureColor) inkColor = featureColor;
  drawBrow(c, E, -1, E.bL);
  drawBrow(c, E, 1, E.bR);
  drawMouth(c, E, speak);
  inkColor = eyeInk;
  c.restore();
  inkColor = INK;
  featureColor = null;
}
