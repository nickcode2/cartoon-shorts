// Shared graphics helpers for CrisisShortV2: canvas painters and standard-material parts (copied from CharacterTest, which stays untouched).
import React from 'react';
import * as THREE from 'three';
import {V3, hash} from '../kit/kit';
import {FREDOKA} from '../kit/PopLabel';
export {FREDOKA};
export type Ctx = CanvasRenderingContext2D;
export const INKC = '#241726';

// ------------------------------------------------------------------ helpers
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
export const lgr = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};
export const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
};
export const blot = (c: Ctx, seed: number, n: number, w: number, h: number, rMin: number, rMax: number, rgb: string, a: number) => {
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * w, y = hash(seed, i + 60) * h, r = rMin + hash(seed, i + 120) * (rMax - rMin);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a * (0.4 + hash(seed, i + 180) * 0.6)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
};
export const outlined = (c: Ctx, text: string, x: number, y: number, fill: string, stroke: string, lw: number) => {
  c.lineJoin = 'round';
  c.strokeStyle = stroke;
  c.lineWidth = lw;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
};

// ------------------------------------------------------------------ packaging (offscreen label canvases, cached)
export const BRANDS: [string, string, string][] = [
  ['CRUNCH', '#d93a40', '#ffd84a'], ['OATIES', '#f08a24', '#fff3d6'], ['MOO', '#2f7fd0', '#ffffff'],
  ['PASTA', '#3aa65b', '#ffe9a8'], ['FIZZ', '#7a52c8', '#7ad0f5'], ['CHOCO', '#6e4326', '#ffb02e'],
];
export const labelCache = new Map<string, HTMLCanvasElement>();
export function label(kind: 'box' | 'can' | 'bottle', i: number, ready: boolean) {
  const key = `${kind}${i}${ready}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const w = kind === 'box' ? 256 : kind === 'can' ? 512 : 256;
  const h = kind === 'box' ? 384 : kind === 'can' ? 256 : 512;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  const [name, col, acc] = BRANDS[(kind === 'box' ? i : kind === 'can' ? i + 2 : i + 4) % BRANDS.length];
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (kind === 'box') {
    c.fillStyle = lgr(c, 0, 0, 0, h, [[0, shade(col, 1.25)], [1, shade(col, 0.78)]]);
    c.fillRect(0, 0, w, h);
    c.fillStyle = shade(col, 0.55);
    c.fillRect(0, 0, w, 22);
    c.fillStyle = acc;
    c.beginPath(); c.arc(w * 0.82, 70, 34, 0, 7); c.fill();
    c.fillStyle = col; c.font = `700 22px ${FREDOKA}`; c.fillText('NEW', w * 0.82, 70);
    c.font = `700 ${name.length > 5 ? 58 : 72}px ${FREDOKA}`;
    outlined(c, name, w / 2, 130, '#ffffff', 'rgba(30,15,25,0.85)', 12);
    // product picture: bowl with swirls
    c.fillStyle = '#fff6e4';
    c.beginPath(); c.ellipse(w / 2, 245, 78, 34, 0, 0, Math.PI); c.fill();
    c.beginPath(); c.ellipse(w / 2, 245, 78, 14, 0, 0, 7); c.fillStyle = shade(acc, 0.9); c.fill();
    for (let k = 0; k < 12; k++) { c.fillStyle = k % 2 ? acc : '#ffffff'; c.beginPath(); c.arc(w / 2 - 55 + k * 10, 238 - (k % 3) * 6, 9, 0, 7); c.fill(); }
    rr(c, 20, 306, w - 40, 62, 8, 'rgba(255,255,255,0.92)');
    c.fillStyle = '#222';
    for (let k = 0; k < 34; k++) c.fillRect(34 + k * 4.4, 316, k % 3 ? 2 : 3, 40);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(110, 0); c.lineTo(0, 200); c.fill();
  } else if (kind === 'can') {
    c.fillStyle = lgr(c, 0, 0, 0, h, [[0, shade(col, 1.15)], [1, shade(col, 0.8)]]);
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 22, w, 12); c.fillRect(0, h - 34, w, 12);
    c.fillStyle = acc;
    c.fillRect(0, 34, w, 8); c.fillRect(0, h - 42, w, 8);
    for (const x of [128, 384]) {
      c.font = `700 62px ${FREDOKA}`;
      outlined(c, name, x, 118, '#ffffff', 'rgba(30,15,25,0.8)', 10);
      c.fillStyle = acc;
      c.beginPath(); c.arc(x, 190, 20, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(30, 0, 22, h); c.fillRect(286, 0, 22, h);
  } else {
    c.fillStyle = lgr(c, 0, 0, w, 0, [[0, shade(col, 1.3)], [0.5, shade(col, 1)], [1, shade(col, 0.7)]]);
    c.fillRect(0, 0, w, h);
    c.fillStyle = acc;
    c.fillRect(0, 0, w, 58);
    rr(c, 14, 190, w - 28, 190, 14, 'rgba(255,255,255,0.94)');
    c.font = `700 ${name.length > 5 ? 50 : 62}px ${FREDOKA}`;
    outlined(c, name, w / 2, 262, col, 'rgba(255,255,255,0)', 1);
    c.fillStyle = acc;
    c.beginPath(); c.arc(w / 2, 336, 18, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(24, 70, 18, h - 90);
  }
  labelCache.set(key, cv);
  return cv;
}

export const paintFarShelf = (seed: number, ready: boolean) => (c: Ctx, w: number, h: number) => {
  const tiers = 5, th = h / tiers;
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#cfc7b4'], [1, '#b9b09b']]);
  c.fillRect(0, 0, w, h);
  for (let t = 0; t < tiers; t++) {
    const yb = t * th + th - 26;
    let x = 6, i = 0;
    while (x < w - 60) {
      const kind = hash(seed + t, i) < 0.4 ? 'box' : hash(seed + t, i) < 0.7 ? 'can' : 'bottle';
      const v = Math.floor(hash(seed + t, i + 20) * (kind === 'box' ? 6 : kind === 'can' ? 4 : 3));
      const bw = kind === 'box' ? 84 + hash(seed, i + t) * 30 : kind === 'can' ? 62 : 54;
      const bh = kind === 'box' ? 130 + hash(seed, i + t + 9) * 30 : kind === 'can' ? 92 : 150;
      const cv = label(kind, v, ready);
      c.drawImage(cv, 0, 0, cv.width, cv.height, x, yb - bh, bw, bh);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; c.strokeRect(x, yb - bh, bw, bh);
      x += bw + 4;
      i++;
    }
    c.fillStyle = lgr(c, 0, t * th, 0, t * th + 80, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]);
    c.fillRect(0, t * th, w, 80);
    c.fillStyle = lgr(c, 0, yb, 0, yb + 26, [[0, '#e9e5d9'], [1, '#a8a291']]);
    c.fillRect(0, yb, w, 26);
  }
};

// ------------------------------------------------------------------ surfaces
export const paintFloorTiles = (c: Ctx, w: number, h: number) => {
  const n = 2, ts = w / n;
  const base = ['#e3ded1', '#d7d1c2', '#e8e4d8', '#dcd6c7'];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const b = base[(i * 2 + j + (i ? 1 : 0)) % 4];
      c.fillStyle = lgr(c, i * ts, j * ts, (i + 1) * ts, (j + 1) * ts, [[0, shade(b, 1.04)], [1, shade(b, 0.94)]]);
      c.fillRect(i * ts, j * ts, ts, ts);
      c.save();
      c.beginPath(); c.rect(i * ts, j * ts, ts, ts); c.clip();
      c.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const x = i * ts + hash(i * 7 + j, k) * ts, y = j * ts + hash(i * 7 + j, k + 9) * ts;
        c.strokeStyle = `rgba(150,138,120,${0.12 + hash(k, i + j) * 0.18})`;
        c.lineWidth = 1 + hash(k, 4) * 2.5;
        c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 120, y + 40, x + 60, y + 180, x + 220, y + 260); c.stroke();
      }
      c.restore();
    }
  for (let k = 0; k < 2600; k++) {
    c.fillStyle = k % 3 ? `rgba(90,80,70,${hash(k, 1) * 0.12})` : `rgba(255,255,255,${hash(k, 2) * 0.35})`;
    c.fillRect(hash(k, 3) * w, hash(k, 4) * h, 2 + hash(k, 5) * 3, 2 + hash(k, 6) * 3);
  }
  blot(c, 6, 30, w, h, 40, 140, '255,255,255', 0.1);
  c.strokeStyle = '#8f8977';
  c.lineWidth = 10;
  for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * ts, 0); c.lineTo(i * ts, h); c.stroke(); c.beginPath(); c.moveTo(0, i * ts); c.lineTo(w, i * ts); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 3;
  for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * ts + 7, 0); c.lineTo(i * ts + 7, h); c.stroke(); c.beginPath(); c.moveTo(0, i * ts + 7); c.lineTo(w, i * ts + 7); c.stroke(); }
};

export const paintPaint = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  blot(c, 3, 40, w, h, 30, 120, '120,100,80', 0.08);
  blot(c, 8, 30, w, h, 30, 100, '255,255,255', 0.1);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(0,0,0,${hash(i, 1) * 0.04})`; c.fillRect(hash(i, 2) * w, 0, 2 + hash(i, 3) * 6, h); }
  for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(80,70,60,${hash(i, 5) * 0.08})`; c.fillRect(hash(i, 6) * w, hash(i, 7) * h, 2, 2); }
};

export const paintCeiling = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#eeebe2';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(70,70,80,${0.1 + hash(i, 5) * 0.2})`; c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 2, 2); }
  blot(c, 2, 24, w, h, 30, 90, '120,130,150', 0.08);
  c.strokeStyle = '#9ba3b0';
  c.lineWidth = 7;
  c.strokeRect(0, 0, w, h);
};

export const paintMural = (ready: boolean) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#83cdf0'], [0.55, '#fff0b8'], [1, '#ffc27a']]);
  c.fillRect(0, 0, w, h);
  blot(c, 8, 24, w, h, 40, 160, '255,255,255', 0.22);
  for (let i = 0; i < 16; i++) {
    c.fillStyle = i % 2 ? '#ffffff' : '#d93a40';
    c.beginPath(); c.moveTo(i * (w / 16), h * 0.3); c.lineTo((i + 1) * (w / 16), h * 0.3); c.lineTo((i + 1) * (w / 16), h * 0.4); c.arc((i + 0.5) * (w / 16), h * 0.4, w / 32, 0, Math.PI); c.fill();
  }
  const fruit = ['#f08a24', '#d93a40', '#ffd84a', '#3aa65b', '#7a52c8'];
  for (let k = 0; k < 7; k++) {
    const cx = 80 + k * ((w - 160) / 6);
    rr(c, cx - 120, h * 0.62, 240, h * 0.3, 12, '#b8793d');
    for (let j = 0; j < 12; j++) { c.fillStyle = fruit[(k + j) % fruit.length]; c.beginPath(); c.arc(cx - 95 + (j % 6) * 38, h * 0.62 - 6 + Math.floor(j / 6) * 26, 20, 0, 7); c.fill(); }
  }
  if (ready) {
    c.font = `700 150px ${FREDOKA}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    outlined(c, 'FRESH MARKET', w / 2, h * 0.14, '#3aa65b', 'rgba(30,15,25,0.85)', 22);
  }
};

export const paintHeader = (text: string, bg: string, ready: boolean) => (c: Ctx, w: number, h: number) => {
  rr(c, 0, 0, w, h, 10, lgr(c, 0, 0, 0, h, [[0, shade(bg, 1.2)], [1, shade(bg, 0.8)]]));
  if (!ready) return;
  c.font = `700 74px ${FREDOKA}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  outlined(c, text, w / 2, h / 2 + 4, '#ffffff', 'rgba(30,15,25,0.7)', 10);
};

export const paintSign = (title: string, sub: string, bg: string, ready: boolean) => (c: Ctx, w: number, h: number) => {
  rr(c, 0, 0, w, h, 22, lgr(c, 0, 0, 0, h, [[0, shade(bg, 1.25)], [1, shade(bg, 0.78)]]));
  if (!ready) return;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `700 118px ${FREDOKA}`;
  outlined(c, title, w / 2, h * 0.4, '#ffffff', 'rgba(30,15,25,0.7)', 14);
  c.font = `700 44px ${FREDOKA}`;
  c.fillStyle = '#fff6d8';
  c.fillText(sub, w / 2, h * 0.78);
};

export const paintHalo = (c: Ctx, w: number, h: number) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
};
export const paintSpark = (c: Ctx, w: number, h: number) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  for (const [rx, ry] of [[w * 0.5, 4], [4, h * 0.5]]) {
    const lg2 = c.createLinearGradient(w / 2 - rx, h / 2 - ry, w / 2 + rx, h / 2 + ry);
    lg2.addColorStop(0, 'rgba(255,255,255,0)'); lg2.addColorStop(0.5, 'rgba(255,255,255,1)'); lg2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg2;
    c.beginPath(); c.ellipse(w / 2, h / 2, rx, ry, 0, 0, 7); c.fill();
  }
};
export const paintAO = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, w, 0, [[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  c.fillRect(0, 0, w, h);
};
export const paintArrow = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#f2c63a';
  c.beginPath(); c.moveTo(w * 0.5, h * 0.05); c.lineTo(w * 0.9, h * 0.5); c.lineTo(w * 0.62, h * 0.5); c.lineTo(w * 0.62, h * 0.95); c.lineTo(w * 0.38, h * 0.95); c.lineTo(w * 0.38, h * 0.5); c.lineTo(w * 0.1, h * 0.5); c.closePath(); c.fill();
  blot(c, 3, 14, w, h, 6, 20, '100,80,20', 0.5);
};
export const paintWarn = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, w, h, [[0, '#ffe34d'], [1, '#e8ac05']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = INKC; c.strokeStyle = INKC; c.lineWidth = 12; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(w / 2, h * 0.14); c.lineTo(w * 0.8, h * 0.78); c.lineTo(w * 0.2, h * 0.78); c.closePath(); c.stroke();
  c.fillRect(w / 2 - 7, h * 0.34, 14, h * 0.24);
  c.beginPath(); c.arc(w / 2, h * 0.67, 8, 0, 7); c.fill();
};

// ------------------------------------------------------------------ standard-material parts (no ink on the set)
type MatProps = {c?: string; map?: THREE.Texture; r?: number; m?: number; emissive?: string; ei?: number; emap?: boolean};
export const Mat: React.FC<MatProps & {side?: THREE.Side}> = ({c = '#ffffff', map, r = 0.7, m = 0, emissive, ei = 0, emap, side}) => (
  <meshStandardMaterial color={c} map={map} roughness={r} metalness={m} emissive={emissive ?? (emap ? '#ffffff' : '#000000')} emissiveMap={emap ? map : undefined} emissiveIntensity={ei} side={side ?? THREE.FrontSide} />
);
export const SBox: React.FC<MatProps & {s: V3; p: V3; rot?: V3; cast?: boolean; recv?: boolean}> = ({s, p, rot, cast = true, recv = true, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow={recv}>
    <boxGeometry args={s} />
    <Mat {...mp} />
  </mesh>
);
export const SCyl: React.FC<MatProps & {r0: number; h: number; p: V3; rot?: V3; seg?: number; cast?: boolean}> = ({r0, h, p, rot, seg = 24, cast = true, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow>
    <cylinderGeometry args={[r0, r0, h, seg]} />
    <Mat {...mp} />
  </mesh>
);
export const SBall: React.FC<MatProps & {r0: number; p: V3}> = ({r0, p, ...mp}) => (
  <mesh position={p} castShadow receiveShadow>
    <sphereGeometry args={[r0, 24, 16]} />
    <Mat {...mp} />
  </mesh>
);
export const SPlane: React.FC<MatProps & {w: number; h: number; p: V3; rot?: V3; recv?: boolean; side?: THREE.Side; cast?: boolean}> = ({w, h, p, rot, recv = true, cast = false, side, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} receiveShadow={recv} castShadow={cast}>
    <planeGeometry args={[w, h]} />
    <Mat {...mp} side={side} />
  </mesh>
);

export const HDR = new THREE.Color(3.4, 3.1, 2.4);
export const Lamp: React.FC<{p: V3; s?: [number, number]}> = ({p, s = [1.6, 0.46]}) => (
  <group position={p}>
    <mesh position={[0, 0.03, 0]}>
      <boxGeometry args={[s[1] + 0.1, 0.06, s[0] + 0.1]} />
      <meshStandardMaterial color="#c9ccd2" roughness={0.5} metalness={0.4} />
    </mesh>
    <mesh position={[0, -0.005, 0]}>
      <boxGeometry args={[s[1], 0.02, s[0]]} />
      <meshBasicMaterial color={HDR} toneMapped={false} />
    </mesh>
  </group>
);
export const Halo: React.FC<{tex: THREE.Texture; p: V3; w: number; h?: number; rot?: V3; color?: string; op?: number}> = ({tex, p, w, h, rot, color = '#ffffff', op = 1}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} renderOrder={6}>
    <planeGeometry args={[w, h ?? w]} />
    <meshBasicMaterial map={tex} color={color} transparent opacity={op} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
  </mesh>
);

// ------------------------------------------------------------------ booklet cover: every line is fitted INSIDE the cover with padding
export function fitCover(c: Ctx, w: number, h: number) {
  const pad = w * 0.12;
  c.fillStyle = '#1d5fb4';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#174e96';
  c.fillRect(0, h * 0.64, w, h * 0.36);
  c.fillStyle = '#f7c928';
  c.fillRect(0, h * 0.05, w, h * 0.05);
  c.fillRect(0, h * 0.9, w, h * 0.04);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const lines: [string, string][] = [['IF CRISIS', '#ffffff'], ['OR WAR', '#f7c928'], ['COMES', '#ffffff']];
  let fs = h * 0.16;
  c.font = `700 ${fs}px ${FREDOKA}, Arial Black, sans-serif`;
  const widest = Math.max(...lines.map(([s]) => c.measureText(s).width));
  fs *= Math.min(1, (w - pad * 2) / widest);
  c.font = `700 ${fs}px ${FREDOKA}, Arial Black, sans-serif`;
  lines.forEach(([s, col], i) => {
    c.fillStyle = col;
    c.fillText(s, w / 2, h * (0.27 + i * 0.145));
  });
  // emblem: cross in a disc, kept well inside the cover
  const ey = h * 0.79, er = w * 0.1;
  c.fillStyle = '#f7c928';
  c.beginPath(); c.arc(w / 2, ey, er, 0, 7); c.fill();
  c.fillStyle = '#1d5fb4';
  c.fillRect(w / 2 - er * 0.14, ey - er * 0.62, er * 0.28, er * 1.24);
  c.fillRect(w / 2 - er * 0.62, ey - er * 0.14, er * 1.24, er * 0.28);
  c.strokeStyle = '#120a14';
  c.lineWidth = w * 0.025;
  c.strokeRect(w * 0.0125, w * 0.0125, w * 0.975, h - w * 0.025);
}

// text fitted into a box with padding (shared by signs on props); returns the font size used
export function fitText(c: Ctx, text: string, boxW: number, maxFs: number, weight = 700) {
  let fs = maxFs;
  c.font = `${weight} ${fs}px ${FREDOKA}`;
  const w = c.measureText(text).width;
  fs *= Math.min(1, boxW / w);
  c.font = `${weight} ${fs}px ${FREDOKA}`;
  return fs;
}
