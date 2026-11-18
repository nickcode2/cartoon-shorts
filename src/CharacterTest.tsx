// CharacterTest v2: Ricks Clips style character in a realistically lit 3D supermarket aisle. Single-canvas kit.
// Set = standard (PBR) materials, warm key + sky fill + point lights, soft shadows, baked contact AO, DOF, bloom. Ink only on the character.
import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {staticFile, useCurrentFrame, useDelayRender} from 'remotion';
import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import * as THREE from 'three';
import {Pose, ShotSpec, SingleCanvasVideo, V3, clamp01, hash, lerp, lin, move, smooth, useTex} from './kit/kit';
import {EXPR, HoodieMan, mixExpr} from './kit/hoodieMan';
import {drawHairDebug, drawRuri, hairReport as ruriHairReport} from './kit/hoodieCurved';
import {FREDOKA, PopLabel, waitForFredoka as waitUntilDone} from './kit/PopLabel';

export const CT_FPS = 30;
export const CT_FRAMES = 60;
const VOICE = staticFile('test_voice.mp3'); // 1.3 s speech sample, used only to drive the mouth (not played)
const VOICE_START = 24; // frame the line starts


type Ctx = CanvasRenderingContext2D;
const INKC = '#241726';

// ------------------------------------------------------------------ helpers
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const lgr = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
};
const blot = (c: Ctx, seed: number, n: number, w: number, h: number, rMin: number, rMax: number, rgb: string, a: number) => {
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * w, y = hash(seed, i + 60) * h, r = rMin + hash(seed, i + 120) * (rMax - rMin);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a * (0.4 + hash(seed, i + 180) * 0.6)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
};
const outlined = (c: Ctx, text: string, x: number, y: number, fill: string, stroke: string, lw: number) => {
  c.lineJoin = 'round';
  c.strokeStyle = stroke;
  c.lineWidth = lw;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
};

// ------------------------------------------------------------------ packaging (offscreen label canvases, cached)
const BRANDS: [string, string, string][] = [
  ['CRUNCH', '#d93a40', '#ffd84a'], ['OATIES', '#f08a24', '#fff3d6'], ['MOO', '#2f7fd0', '#ffffff'],
  ['PASTA', '#3aa65b', '#ffe9a8'], ['FIZZ', '#7a52c8', '#7ad0f5'], ['CHOCO', '#6e4326', '#ffb02e'],
];
const labelCache = new Map<string, HTMLCanvasElement>();
function label(kind: 'box' | 'can' | 'bottle', i: number, ready: boolean) {
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

const paintFarShelf = (seed: number, ready: boolean) => (c: Ctx, w: number, h: number) => {
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
const paintFloorTiles = (c: Ctx, w: number, h: number) => {
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

const paintPaint = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  blot(c, 3, 40, w, h, 30, 120, '120,100,80', 0.08);
  blot(c, 8, 30, w, h, 30, 100, '255,255,255', 0.1);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(0,0,0,${hash(i, 1) * 0.04})`; c.fillRect(hash(i, 2) * w, 0, 2 + hash(i, 3) * 6, h); }
  for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(80,70,60,${hash(i, 5) * 0.08})`; c.fillRect(hash(i, 6) * w, hash(i, 7) * h, 2, 2); }
};

const paintCeiling = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#eeebe2';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(70,70,80,${0.1 + hash(i, 5) * 0.2})`; c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 2, 2); }
  blot(c, 2, 24, w, h, 30, 90, '120,130,150', 0.08);
  c.strokeStyle = '#9ba3b0';
  c.lineWidth = 7;
  c.strokeRect(0, 0, w, h);
};

const paintMural = (ready: boolean) => (c: Ctx, w: number, h: number) => {
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

const paintHeader = (text: string, bg: string, ready: boolean) => (c: Ctx, w: number, h: number) => {
  rr(c, 0, 0, w, h, 10, lgr(c, 0, 0, 0, h, [[0, shade(bg, 1.2)], [1, shade(bg, 0.8)]]));
  if (!ready) return;
  c.font = `700 74px ${FREDOKA}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  outlined(c, text, w / 2, h / 2 + 4, '#ffffff', 'rgba(30,15,25,0.7)', 10);
};

const paintSign = (title: string, sub: string, bg: string, ready: boolean) => (c: Ctx, w: number, h: number) => {
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

const paintHalo = (c: Ctx, w: number, h: number) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
};
const paintSpark = (c: Ctx, w: number, h: number) => {
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
const paintAO = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, w, 0, [[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  c.fillRect(0, 0, w, h);
};
const paintArrow = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#f2c63a';
  c.beginPath(); c.moveTo(w * 0.5, h * 0.05); c.lineTo(w * 0.9, h * 0.5); c.lineTo(w * 0.62, h * 0.5); c.lineTo(w * 0.62, h * 0.95); c.lineTo(w * 0.38, h * 0.95); c.lineTo(w * 0.38, h * 0.5); c.lineTo(w * 0.1, h * 0.5); c.closePath(); c.fill();
  blot(c, 3, 14, w, h, 6, 20, '100,80,20', 0.5);
};
const paintWarn = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, w, h, [[0, '#ffe34d'], [1, '#e8ac05']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = INKC; c.strokeStyle = INKC; c.lineWidth = 12; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(w / 2, h * 0.14); c.lineTo(w * 0.8, h * 0.78); c.lineTo(w * 0.2, h * 0.78); c.closePath(); c.stroke();
  c.fillRect(w / 2 - 7, h * 0.34, 14, h * 0.24);
  c.beginPath(); c.arc(w / 2, h * 0.67, 8, 0, 7); c.fill();
};

// ------------------------------------------------------------------ standard-material parts (no ink on the set)
type MatProps = {c?: string; map?: THREE.Texture; r?: number; m?: number; emissive?: string; ei?: number; emap?: boolean};
const Mat: React.FC<MatProps & {side?: THREE.Side}> = ({c = '#ffffff', map, r = 0.7, m = 0, emissive, ei = 0, emap, side}) => (
  <meshStandardMaterial color={c} map={map} roughness={r} metalness={m} emissive={emissive ?? (emap ? '#ffffff' : '#000000')} emissiveMap={emap ? map : undefined} emissiveIntensity={ei} side={side ?? THREE.FrontSide} />
);
const SBox: React.FC<MatProps & {s: V3; p: V3; rot?: V3; cast?: boolean; recv?: boolean}> = ({s, p, rot, cast = true, recv = true, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow={recv}>
    <boxGeometry args={s} />
    <Mat {...mp} />
  </mesh>
);
const SCyl: React.FC<MatProps & {r0: number; h: number; p: V3; rot?: V3; seg?: number; cast?: boolean}> = ({r0, h, p, rot, seg = 24, cast = true, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow>
    <cylinderGeometry args={[r0, r0, h, seg]} />
    <Mat {...mp} />
  </mesh>
);
const SBall: React.FC<MatProps & {r0: number; p: V3}> = ({r0, p, ...mp}) => (
  <mesh position={p} castShadow receiveShadow>
    <sphereGeometry args={[r0, 24, 16]} />
    <Mat {...mp} />
  </mesh>
);
const SPlane: React.FC<MatProps & {w: number; h: number; p: V3; rot?: V3; recv?: boolean; side?: THREE.Side; cast?: boolean}> = ({w, h, p, rot, recv = true, cast = false, side, ...mp}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} receiveShadow={recv} castShadow={cast}>
    <planeGeometry args={[w, h]} />
    <Mat {...mp} side={side} />
  </mesh>
);

const HDR = new THREE.Color(3.4, 3.1, 2.4);
const Lamp: React.FC<{p: V3; s?: [number, number]}> = ({p, s = [1.6, 0.46]}) => (
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
const Halo: React.FC<{tex: THREE.Texture; p: V3; w: number; h?: number; rot?: V3; color?: string; op?: number}> = ({tex, p, w, h, rot, color = '#ffffff', op = 1}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} renderOrder={6}>
    <planeGeometry args={[w, h ?? w]} />
    <meshBasicMaterial map={tex} color={color} transparent opacity={op} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
  </mesh>
);

// ------------------------------------------------------------------ products: instanced 3D boxes, cans and bottles with real packaging textures
const AISLE = 1.5; // aisle half width (shelf front edge at |x| = AISLE - 0.12)
const NBOX = 6, NCAN = 4, NBOT = 3;
interface Placed {boxes: THREE.Matrix4[][]; cans: THREE.Matrix4[][]; bottles: THREE.Matrix4[][]}
let placed: Placed | null = null;
function placeProducts(): Placed {
  if (placed) return placed;
  const boxes = Array.from({length: NBOX}, () => [] as THREE.Matrix4[]);
  const cans = Array.from({length: NCAN}, () => [] as THREE.Matrix4[]);
  const bottles = Array.from({length: NBOT}, () => [] as THREE.Matrix4[]);
  const pos = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const push = (arr: THREE.Matrix4[], x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number) => {
    pos.set(x, y, z);
    sc.set(sx, sy, sz);
    q.setFromAxisAngle(up, yaw);
    arr.push(new THREE.Matrix4().compose(pos, q, sc));
  };
  let seed = 1;
  for (const sd of [-1, 1])
    for (let tier = 0; tier < 5; tier++)
      for (let row = 0; row < 2; row++) {
        const x = sd * (AISLE - 0.02 + row * 0.14);
        const base = 0.125 + tier * 0.43;
        const face = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
        let z = -1.4 - hash(seed, 1) * 0.05;
        let i = 0;
        while (z > -13.5) {
          seed++;
          const k = hash(seed, i), v = hash(seed, i + 50);
          const jitter = (hash(seed, i + 90) - 0.5) * 0.1;
          if (hash(seed, i + 130) > 0.94) { z -= 0.12; i++; continue; }
          if (k < 0.42) {
            const w = 0.12 + hash(seed, i + 3) * 0.06, h = 0.23 + hash(seed, i + 4) * 0.08 + row * 0.02;
            push(boxes[Math.floor(v * NBOX)], x, base + h / 2, z - w / 2, face + jitter, w, h, 0.09);
            z -= w + 0.012;
          } else if (k < 0.72) {
            const d = 0.078, h = 0.11, stack = hash(seed, i + 7) > 0.55 ? 2 : 1;
            for (let s2 = 0; s2 < stack; s2++) push(cans[Math.floor(v * NCAN)], x, base + h / 2 + s2 * h, z - d / 2, face + jitter * 3, d, h, d);
            z -= d + 0.008;
          } else {
            const d = 0.07, h = 0.26 + row * 0.02;
            push(bottles[Math.floor(v * NBOT)], x, base + h / 2, z - d / 2, face + jitter * 3, d, h, d);
            z -= d + 0.01;
          }
          i++;
        }
      }
  placed = {boxes, cans, bottles};
  return placed;
}

const Inst: React.FC<{mats: THREE.Matrix4[]; geo: 'box' | 'cyl'; map: THREE.Texture; cap?: string; r?: number; m?: number}> = ({mats, geo, map, cap = '#c9ccd2', r = 0.55, m = 0}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current!;
    mats.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.instanceMatrix.needsUpdate = true;
  }, [mats]);
  if (!mats.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]} castShadow receiveShadow frustumCulled={false}>
      {geo === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <cylinderGeometry args={[0.5, 0.5, 1, 20]} />}
      {geo === 'box' ? (
        <meshStandardMaterial map={map} roughness={r} metalness={m} />
      ) : (
        <>
          <meshStandardMaterial attach="material-0" map={map} roughness={r} metalness={m} />
          <meshStandardMaterial attach="material-1" color={cap} roughness={0.35} metalness={0.7} />
          <meshStandardMaterial attach="material-2" color={cap} roughness={0.35} metalness={0.7} />
        </>
      )}
    </instancedMesh>
  );
};

// ------------------------------------------------------------------ the aisle
const SEG = 4;
const Aisle: React.FC<{t: number; ready: boolean}> = ({t, ready}) => {
  const P = placeProducts();
  const boxTex = Array.from({length: NBOX}, (_, i) => useTex(`bx${i}${ready}`, 256, 384, (c) => c.drawImage(label('box', i, ready), 0, 0)));
  const canTex = Array.from({length: NCAN}, (_, i) => useTex(`cn${i}${ready}`, 512, 256, (c) => c.drawImage(label('can', i, ready), 0, 0)));
  const botTex = Array.from({length: NBOT}, (_, i) => useTex(`bt${i}${ready}`, 256, 512, (c) => c.drawImage(label('bottle', i, ready), 0, 0)));
  const farTex = [useTex('fs0' + ready, 2048, 1024, paintFarShelf(3, ready)), useTex('fs1' + ready, 2048, 1024, paintFarShelf(11, ready)), useTex('fs2' + ready, 2048, 1024, paintFarShelf(23, ready))];
  const floor = useTex('floorT', 1024, 1024, paintFloorTiles, [26 / 1.2, 70 / 1.2]);
  const ceil = useTex('ceilT', 512, 512, paintCeiling, [22, 58]);
  const wallTex = useTex('wallP', 512, 512, paintPaint('#e9dcc0'), [14, 1]);
  const halo = useTex('halo', 256, 256, paintHalo);
  const spark = useTex('spark', 256, 256, paintSpark);
  const ao = useTex('ao', 128, 8, paintAO);
  const arrow = useTex('arrowT', 128, 128, paintArrow);
  const warn = useTex('warnT', 128, 128, paintWarn);
  const hdr = [
    useTex('hd0' + ready, 1024, 128, paintHeader('SNACKS', '#d93a40', ready)),
    useTex('hd1' + ready, 1024, 128, paintHeader('DRINKS', '#2f7fd0', ready)),
    useTex('hd2' + ready, 1024, 128, paintHeader('CEREAL', '#f08a24', ready)),
    useTex('hd3' + ready, 1024, 128, paintHeader('PASTA', '#3aa65b', ready)),
  ];
  const sg = [
    useTex('sg0' + ready, 512, 256, paintSign('AISLE 7', 'SNACKS  *  DRINKS', '#2f7fd0', ready)),
    useTex('sg1' + ready, 512, 256, paintSign('SALE', 'ALL WEEK  *  2 FOR 1', '#d93a40', ready)),
    useTex('sg2' + ready, 512, 256, paintSign('FRESH', 'FRUIT  *  VEG  *  BAKERY', '#3aa65b', ready)),
  ];
  const mural = useTex('mural' + ready, 2048, 768, paintMural(ready));
  const lampZ = [0.5, -2.5, -5.5, -8.5, -11.5, -14.5, -17.5, -20.5];
  const tw = (i: number) => 1 + 0.25 * Math.sin(t * 5 + i * 1.7);
  const segs = Array.from({length: 12}, (_, k) => k);
  return (
    <group>
      {/* lighting: warm key (soft shadows), cool sky fill, ambient, ceiling point lights */}
      <hemisphereLight args={['#bcd6ff', '#e9d3b4', 1.2]} />
      <directionalLight color="#ffd0a0" intensity={1.9} position={[3.4, 5, 5.5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.8} position={[-4, 2.5, 3]} />
      <ambientLight color="#ffffff" intensity={0.12} />
      {[0.5, -5.5, -11.5, -17.5].map((z) => <pointLight key={z} position={[0, 3.2, z]} color="#fff0d2" intensity={14} distance={11} decay={2} />)}

      {/* shell: extends far beyond any camera view */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -17]} receiveShadow>
        <planeGeometry args={[28, 70]} />
        <meshStandardMaterial map={floor} roughness={0.36} metalness={0.04} />
      </mesh>
      <SPlane w={28} h={70} p={[0, 3.6, -17]} rot={[Math.PI / 2, 0, 0]} map={ceil} r={0.9} recv={false} />
      <SPlane w={70} h={3.6} p={[-14, 1.8, -17]} rot={[0, Math.PI / 2, 0]} map={wallTex} r={0.85} />
      <SPlane w={70} h={3.6} p={[14, 1.8, -17]} rot={[0, -Math.PI / 2, 0]} map={wallTex} r={0.85} />
      <SPlane w={28} h={3.6} p={[0, 1.8, -24]} c="#eadcbc" r={0.85} />
      <SPlane w={28} h={3.6} p={[0, 1.8, 9]} rot={[0, Math.PI, 0]} c="#eadcbc" r={0.85} />
      <SPlane w={9} h={3.0} p={[0, 1.6, -23.94]} map={mural} r={0.8} emap ei={0.25} />

      {/* ceiling: fixtures with glow, ducts */}
      {lampZ.map((z) => (
        <group key={z}>
          <Lamp p={[0, 3.56, z]} />
          <Lamp p={[3, 3.56, z]} />
          <Lamp p={[-3, 3.56, z]} />
          <Halo tex={halo} p={[0, 3.4, z + 0.2]} w={2.2} color="#fff0c8" op={0.5} />
          <Halo tex={halo} p={[0, 0.015, z - 0.2]} w={1.4} h={3.4} rot={[-Math.PI / 2, 0, 0]} color="#fff6dc" op={0.28} />
        </group>
      ))}
      <SCyl r0={0.14} h={60} p={[1.7, 3.38, -17]} rot={[Math.PI / 2, 0, 0]} c="#c3cad6" r={0.4} m={0.7} cast={false} />
      <SCyl r0={0.07} h={60} p={[-1.9, 3.44, -17]} rot={[Math.PI / 2, 0, 0]} c="#c9373d" r={0.5} m={0.2} cast={false} />

      {/* shelving: textured backing + real boards + 3D products */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <SBox s={[0.7, 2.3, 46]} p={[sd * (AISLE + 0.6), 1.15, -17]} c="#d3d9df" r={0.6} m={0.2} />
          {segs.map((k) => {
            const z = 1 - SEG * k;
            const near = k >= 1 && k <= 3; // products are real 3D here, the backing sits behind them
            return (
              <group key={k}>
                <SPlane w={SEG} h={2.2} p={[sd * (near ? AISLE + 0.28 : AISLE - 0.02), 1.15, z]} rot={[0, -sd * (Math.PI / 2), 0]} map={farTex[(k + (sd > 0 ? 1 : 0)) % 3]} r={0.8} />
                <SPlane w={SEG - 0.1} h={0.45} p={[sd * (AISLE - 0.13), 2.5, z]} rot={[0, -sd * (Math.PI / 2), 0]} map={hdr[(k + (sd > 0 ? 2 : 0)) % 4]} r={0.6} emap ei={0.45} />
                <SBox s={[0.1, 2.75, 0.1]} p={[sd * (AISLE - 0.1), 1.375, z + SEG / 2]} c="#2c6fc0" r={0.45} m={0.3} cast={false} />
              </group>
            );
          })}
          {[0, 1, 2, 3, 4].map((tr) => (
            <SBox key={tr} s={[0.4, 0.04, 46]} p={[sd * (AISLE + 0.08), 0.105 + tr * 0.43, -17]} c="#e4e1d8" r={0.45} m={0.3} />
          ))}
          <SBox s={[0.42, 0.1, 46]} p={[sd * (AISLE + 0.07), 0.05, -17]} c="#334463" r={0.6} />
        </group>
      ))}
      {P.boxes.map((mt, i) => <Inst key={'b' + i} mats={mt} geo="box" map={boxTex[i]} r={0.6} />)}
      {P.cans.map((mt, i) => <Inst key={'c' + i} mats={mt} geo="cyl" map={canTex[i]} r={0.4} m={0.35} />)}
      {P.bottles.map((mt, i) => <Inst key={'t' + i} mats={mt} geo="cyl" map={botTex[i]} cap="#f4f1e8" r={0.3} m={0.05} />)}

      {/* hanging signs */}
      {[[-5.2, 0], [-9.5, 1], [-14, 2]].map(([z, i]) => (
        <group key={z}>
          <SBox s={[0.012, 0.7, 0.012]} p={[-0.5, 3.25, z]} c="#555a66" r={0.4} m={0.8} cast={false} />
          <SBox s={[0.012, 0.7, 0.012]} p={[0.5, 3.25, z]} c="#555a66" r={0.4} m={0.8} cast={false} />
          <SBox s={[1.5, 0.76, 0.05]} p={[0, 2.82, z]} c="#f4f4f4" r={0.5} />
          <SPlane w={1.46} h={0.73} p={[0, 2.82, z + 0.03]} map={sg[i]} r={0.5} emap ei={0.4} />
          <SPlane w={1.46} h={0.73} p={[0, 2.82, z - 0.03]} rot={[0, Math.PI, 0]} map={sg[i]} r={0.5} emap ei={0.4} />
        </group>
      ))}

      {/* floor: markings, glossy spill, baked contact AO along the shelf bases and walls */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <SPlane w={0.06} h={46} p={[sd * (AISLE - 0.28), 0.004, -17]} rot={[-Math.PI / 2, 0, 0]} c="#e8bd2c" r={0.5} recv />
          <mesh position={[sd * (AISLE - 0.4), 0.006, -17]} rotation={[-Math.PI / 2, 0, 0]} scale={[sd, 1, 1]} renderOrder={1}>
            <planeGeometry args={[0.8, 46]} />
            <meshBasicMaterial map={ao} color="#000000" transparent opacity={0.6} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      ))}
      {[-5.5, -11].map((z) => <SPlane key={z} w={0.55} h={0.55} p={[0, 0.005, z]} rot={[-Math.PI / 2, 0, 0]} map={arrow} r={0.5} />)}
      <mesh position={[0.45, 0.008, -3.6]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial color="#b6d8f2" roughness={0.04} metalness={0.0} transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* props */}
      <group position={[-0.9, 0, -3.6]} rotation={[0, 0.25, 0]}>
        <SBox s={[0.62, 0.34, 0.5]} p={[0, 0.17, 0]} c="#b8793d" r={0.85} />
        {Array.from({length: 14}).map((_, i) => (
          <SBall key={i} r0={0.075} p={[-0.2 + (i % 5) * 0.1, 0.4 + Math.floor(i / 5) * 0.08, -0.12 + (i % 3) * 0.12]} c={['#f08a24', '#f5a02d', '#ee7a1c'][i % 3]} r={0.45} />
        ))}
      </group>
      <group position={[1.0, 0, -4.4]} rotation={[0, -0.2, 0]}>
        {[[-0.27, 0.14], [0.27, 0.14], [0, 0.14], [-0.14, 0.42], [0.14, 0.42], [0, 0.7]].map(([x, y], i) => (
          <group key={i} position={[x, y, 0]}>
            <SBox s={[0.26, 0.28, 0.36]} p={[0, 0, 0]} c="#cc2f36" r={0.5} />
            <SPlane w={0.2} h={0.1} p={[0, 0.02, 0.182]} c="#ffffff" r={0.6} />
            {[-0.06, 0.06].map((xx) => <SCyl key={xx} r0={0.028} h={0.09} p={[xx, 0.18, 0]} c="#f4f1e8" r={0.3} seg={12} cast={false} />)}
          </group>
        ))}
      </group>
      <group position={[-0.45, 0, -6]} rotation={[0, 0.5, 0]}>
        <SPlane w={0.34} h={0.5} p={[0, 0.25, 0.1]} rot={[-0.28, 0, 0]} map={warn} r={0.4} cast side={THREE.DoubleSide} />
        <SPlane w={0.34} h={0.5} p={[0, 0.25, -0.1]} rot={[0.28, Math.PI, 0]} map={warn} r={0.4} cast side={THREE.DoubleSide} />
      </group>
      <group position={[0.6, 0, -8.6]} rotation={[0, -0.3, 0]}>
        <SBox s={[0.6, 0.04, 0.85]} p={[0, 0.38, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.6, 0.34, 0.03]} p={[0, 0.56, 0.42]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.6, 0.34, 0.03]} p={[0, 0.56, -0.42]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.03, 0.34, 0.85]} p={[0.3, 0.56, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.03, 0.34, 0.85]} p={[-0.3, 0.56, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.66, 0.04, 0.05]} p={[0, 0.95, 0.5]} c="#cc2f36" r={0.5} />
        {[-0.2, 0.2].map((x) => [-0.34, 0.34].map((z) => <SBall key={x + '' + z} r0={0.045} p={[x, 0.05, z]} c="#222" r={0.7} />))}
        <SBox s={[0.18, 0.2, 0.16]} p={[-0.1, 0.5, 0.1]} c="#e8bd2c" r={0.6} />
        <SBox s={[0.2, 0.26, 0.16]} p={[0.12, 0.53, -0.12]} c="#3aa65b" r={0.6} />
      </group>
      <group position={[0.1, 0, -19.5]}>
        {[[-0.4, 0.2], [0.4, 0.2], [0, 0.6]].map(([x, y], i) => <SBox key={i} s={[0.7, 0.4, 0.7]} p={[x, y, 0]} c={['#b8793d', '#cc2f36', '#2f7fd0'][i]} r={0.8} />)}
      </group>

      {/* bright glints on packaging and the spill */}
      {[[-1.4, 1.3, -3.2], [-1.4, 0.8, -4.6], [1.38, 1.6, -3.8], [1.38, 0.9, -6.2], [-1.4, 1.75, -6.5], [0.45, 0.05, -3.6]].map((q, i) => (
        <Halo key={i} tex={spark} p={q as V3} w={0.4 * tw(i)} color="#fff6d8" op={0.8} rot={[0, q[0] < -1 ? Math.PI / 2 : q[0] > 1 ? -Math.PI / 2 : 0, 0]} />
      ))}
    </group>
  );
};

const FOCUS_CENTER = new THREE.Vector3(0, 0.8, 0);
const POP = 30; // frame the label pops in

// ------------------------------------------------------------------ shot
// full body, character about 50% of the frame height, slow push-in (camera 3.75 m -> 3.25 m)
const cam = move(
  {p: [-0.1, 1.0, 3.75], l: [0, 0.92, 0], fov: 50},
  {p: [0.1, 1.0, 3.25], l: [0, 0.95, 0], fov: 50},
  lin,
);

const RealPost: React.FC<{pose: Pose}> = ({pose}) => {
  const focus = new THREE.Vector3(...pose.p).distanceTo(FOCUS_CENTER);
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.8} />
      <DepthOfField worldFocusDistance={focus} worldFocusRange={2.6} bokehScale={2.4} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.32} darkness={0.4} />
    </EffectComposer>
  );
};

const Scene: React.FC<{t: number; u: number; ready: boolean; speak: number}> = ({t, u, ready, speak}) => {
  const f = Math.round(t * CT_FPS);
  const kx = smooth((f - 10) / 22); // neutral -> smug
  const base = mixExpr(EXPR.neutral, EXPR.smug, kx);
  const expr = {...base, gx: lerp(-0.8, EXPR.smug.gx, smooth((f - 12) / 20))};
  const turn = lerp(-0.8, 0.3, smooth((f - 8) / 24));
  const hips = smooth((f - 16) / 20);
  return (
    <>
      <Aisle t={t} ready={ready} />
      <HoodieMan pose={{t, expr, turn, hips, speak}} p={[0, 0, 0]} s={0.84} yawK={0.8} />
      <PopLabel text="3 DAYS" pose={cam(u, t)} f={f} start={POP} ready={ready} focus={FOCUS_CENTER} />
    </>
  );
};

// mouth opening from the voice sample: energy of the low/mid frequency bins, per frame
function useMouthFlap(frame: number): number {
  const data = useAudioData(VOICE);
  if (!data) return 0;
  const f = frame - VOICE_START;
  if (f < 0) return 0;
  const bins = visualizeAudio({fps: CT_FPS, frame: f, audioData: data, numberOfSamples: 32});
  const e = bins.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  return clamp01(Math.sqrt(e) * 2.6);
}

// Ruri hair check (add `?hair=1` to the Studio URL): 2D strip of Ruri at the gaze/tilt/expression extremes with the debug overlay
// (head magenta, hair cyan, tips yellow) plus the numeric report, also logged as [hair]. Not part of the WebGL scene, not rendered unless the flag is on.
const RURI_HAIR_POSES: {n: string; turn: number; roll: number; nod: number; expr: keyof typeof EXPR}[] = [
  {n: 'look left', turn: -1, roll: 0, nod: 0, expr: 'neutral'}, {n: 'front', turn: 0, roll: 0, nod: 0, expr: 'surprised'}, {n: 'look right', turn: 1, roll: 0, nod: 0, expr: 'neutral'},
  {n: 'angry', turn: 0.5, roll: 0, nod: 0, expr: 'angry'}, {n: 'laugh shake', turn: 0, roll: 0, nod: 0, expr: 'laughing'}, {n: 'roll 10 + nod 14', turn: -0.5, roll: 10, nod: 14, expr: 'smug'},
];
const RuriHairCheck: React.FC = () => {
  const on = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hair') === '1';
  const ref = useRef<HTMLCanvasElement>(null);
  const rep = useMemo(() => ruriHairReport(), []);
  useLayoutEffect(() => {
    if (!on || !ref.current) return;
    console.info('[hair] Ruri', JSON.stringify(rep));
    const c = ref.current.getContext('2d')!, w = 180, h = 300;
    c.fillStyle = '#9a9ac0'; c.fillRect(0, 0, 1080, 400);
    RURI_HAIR_POSES.forEach((hp, i) => {
      c.save();
      c.translate(i * 180, 0); c.scale(0.3, 0.3);
      drawRuri(c, {t: 0.4, expr: EXPR[hp.expr], turn: hp.turn, headRoll: hp.roll, nod: hp.nod});
      drawHairDebug(c);
      c.restore();
      c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.fillText(hp.n, i * 180 + 8, h + 20);
    });
    c.fillStyle = rep.ok ? '#bfffd0' : '#ffb0b0'; c.font = '20px sans-serif';
    c.fillText(rep.ok ? 'HAIR CHECK: OK' : 'HAIR CHECK: FAIL - ' + rep.issues.join('; '), 12, h + 56);
  }, [on, rep]);
  return on ? <canvas ref={ref} width={1080} height={400} style={{position: 'absolute', left: 0, top: 0}} /> : null;
};

export const CharacterTest: React.FC = () => {
  const [ready, setReady] = useState(false);
  const frame = useCurrentFrame();
  const speak = Math.round(useMouthFlap(frame) * 20) / 20;
  const {delayRender, continueRender} = useDelayRender();
  useLayoutEffect(() => {
    const h = delayRender('Fredoka font', {timeoutInMilliseconds: 15000});
    waitUntilDone()
      .then(() => document.fonts.load(`700 100px ${FREDOKA}`))
      .catch(() => undefined)
      .then(() => {
        setReady(true);
        continueRender(h);
      });
  }, [delayRender, continueRender]);
  const shots: ShotSpec[] = useMemo(
    () => [
      {
        from: 0,
        to: CT_FRAMES,
        light: 'indoor',
        ownLights: true,
        cam,
        post: (_f, pose) => <RealPost pose={pose} />,
        render: (t, u) => <Scene t={t} u={u} ready={ready} speak={speak} />,
      },
    ],
    [ready, speak],
  );
  return (
    <>
      <SingleCanvasVideo shots={shots} fps={CT_FPS} />
      <RuriHairCheck />
    </>
  );
};
