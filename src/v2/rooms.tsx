// Indoor sets for CrisisShortV2: kitchens, living room with backpack, booklet desk. Standard materials only, baked-AO strips, real textures.
import React from 'react';
import * as THREE from 'three';
import {V3, clamp01, hash, lerp} from '../kit/kit';
import {Ctx, Halo, Mat, SBall, SBox, SCyl, SPlane, blot, fitCover, fitText, lgr, outlined, paintAO, paintHalo, rr, shade} from './gfx';
import {ctex} from './street';

// ---------------------------------------------------------------- painters
export const paintPlanks = (base: string, plankH = 64, vertical = false) => (c: Ctx, w: number, h: number) => {
  const n = Math.floor((vertical ? w : h) / plankH);
  for (let i = 0; i < n; i++) {
    const k = 0.86 + hash(i, 3) * 0.28;
    c.fillStyle = shade(base, k);
    if (vertical) c.fillRect(i * plankH, 0, plankH, h); else c.fillRect(0, i * plankH, w, plankH);
    c.strokeStyle = 'rgba(40,20,5,0.18)'; c.lineWidth = 1.5;
    for (let g = 0; g < 7; g++) {
      c.beginPath();
      if (vertical) { c.moveTo(i * plankH + hash(i, g) * plankH, 0); c.bezierCurveTo(i * plankH + hash(i, g + 5) * plankH, h * 0.3, i * plankH + hash(i, g + 9) * plankH, h * 0.7, i * plankH + hash(i, g + 11) * plankH, h); }
      else { c.moveTo(0, i * plankH + hash(i, g) * plankH); c.bezierCurveTo(w * 0.3, i * plankH + hash(i, g + 5) * plankH, w * 0.7, i * plankH + hash(i, g + 9) * plankH, w, i * plankH + hash(i, g + 11) * plankH); }
      c.stroke();
    }
    c.strokeStyle = 'rgba(30,15,5,0.55)'; c.lineWidth = 3;
    c.beginPath();
    if (vertical) { c.moveTo(i * plankH, 0); c.lineTo(i * plankH, h); } else { c.moveTo(0, i * plankH); c.lineTo(w, i * plankH); }
    c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.5)';
    const seam = hash(i, 8) * (vertical ? h : w);
    if (vertical) c.fillRect(i * plankH, seam, plankH, 3); else c.fillRect(seam, i * plankH, 3, plankH);
  }
  blot(c, 3, 14, w, h, 30, 110, '255,235,200', 0.1);
};
export const paintWall = (base: string, stripe?: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  if (stripe) { c.fillStyle = stripe; for (let i = 0; i < 8; i++) c.fillRect(i * (w / 8) + w / 16 - 6, 0, 12, h); }
  blot(c, 3, 40, w, h, 30, 120, '120,100,80', 0.08);
  blot(c, 8, 30, w, h, 30, 100, '255,255,255', 0.1);
  for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(80,70,60,${hash(i, 5) * 0.08})`; c.fillRect(hash(i, 6) * w, hash(i, 7) * h, 2, 2); }
};
export const paintTilesSmall = (a: string, b: string) => (c: Ctx, w: number, h: number) => {
  const n = 8, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    c.fillStyle = (i + j) % 2 ? a : b;
    c.fillRect(i * s, j * s, s, s);
    c.fillStyle = lgr(c, i * s, j * s, (i + 1) * s, (j + 1) * s, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(0,0,0,0.1)']]);
    c.fillRect(i * s, j * s, s, s);
  }
  c.strokeStyle = 'rgba(70,64,56,0.7)'; c.lineWidth = 3;
  for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke(); c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
  void h;
};
export const paintMetro = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const cw = w / 4, ch = h / 8;
  for (let r = 0; r < 8; r++) for (let i = -1; i < 5; i++) {
    const x = i * cw + (r % 2 ? cw / 2 : 0);
    c.fillStyle = lgr(c, x, r * ch, x, (r + 1) * ch, [[0, 'rgba(255,255,255,0.22)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.15)']]);
    c.fillRect(x + 3, r * ch + 3, cw - 6, ch - 6);
  }
  c.strokeStyle = 'rgba(60,55,50,0.6)'; c.lineWidth = 3;
  for (let r = 0; r <= 8; r++) { c.beginPath(); c.moveTo(0, r * ch); c.lineTo(w, r * ch); c.stroke(); }
  for (let r = 0; r < 8; r++) for (let i = -1; i < 5; i++) { const x = i * cw + (r % 2 ? cw / 2 : 0); c.beginPath(); c.moveTo(x, r * ch); c.lineTo(x, (r + 1) * ch); c.stroke(); }
};
export const paintRug = (a: string, b: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = a; c.fillRect(0, 0, w, h);
  c.strokeStyle = b; c.lineWidth = 14; c.strokeRect(24, 24, w - 48, h - 48);
  c.lineWidth = 5; c.strokeRect(54, 54, w - 108, h - 108);
  c.fillStyle = b;
  for (let i = 0; i < 6; i++) { c.save(); c.translate(w / 2, h / 2); c.rotate((i * Math.PI) / 3); c.beginPath(); c.ellipse(0, -h * 0.2, w * 0.05, h * 0.15, 0, 0, 7); c.fill(); c.restore(); }
  for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(255,255,255,${hash(i, 2) * 0.08})`; c.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2, 2); }
};
const paintSky = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#0d1638'], [0.6, '#2b3f7d'], [1, '#4a5c93']]); c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + hash(i, 3) * 0.6})`; c.beginPath(); c.arc(hash(i, 1) * w, hash(i, 2) * h * 0.7, 1.5 + hash(i, 4) * 2, 0, 7); c.fill(); }
  c.fillStyle = '#e8ecff'; c.beginPath(); c.arc(w * 0.74, h * 0.28, 22, 0, 7); c.fill();
  c.fillStyle = '#10142c'; for (let i = 0; i < 9; i++) c.fillRect(i * (w / 9), h * 0.85 - hash(i, 7) * 60, w / 9 - 4, 200);
};
const paintDaySky = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#6fb6ea'], [1, '#d7f0ff']]); c.fillRect(0, 0, w, h);
  blot(c, 5, 6, w, h, 40, 100, '255,255,255', 0.7);
  c.fillStyle = '#6f8f6a'; for (let i = 0; i < 8; i++) c.fillRect(i * (w / 8), h * 0.82 - hash(i, 7) * 40, w / 8 - 3, 200);
};
const paintClock = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.fill();
  c.strokeStyle = '#2d313b'; c.lineWidth = 12; c.stroke();
  c.fillStyle = '#2d313b';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.save(); c.translate(w / 2, h / 2); c.rotate(a); c.fillRect(-4, -w / 2 + 22, 8, i % 3 ? 18 : 30); c.restore(); }
};
const paintCalendar = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#fffdf2'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d93a40'; c.fillRect(0, 0, w, h * 0.2);
  c.strokeStyle = '#b9b3a4'; c.lineWidth = 2;
  for (let i = 0; i <= 7; i++) { c.beginPath(); c.moveTo(8 + i * ((w - 16) / 7), h * 0.3); c.lineTo(8 + i * ((w - 16) / 7), h - 8); c.stroke(); }
  for (let j = 0; j <= 5; j++) { c.beginPath(); c.moveTo(8, h * 0.3 + j * ((h * 0.7 - 8) / 5)); c.lineTo(w - 8, h * 0.3 + j * ((h * 0.7 - 8) / 5)); c.stroke(); }
  c.strokeStyle = '#d93a40'; c.lineWidth = 6;
  for (const [i, j] of [[3, 2], [4, 2], [5, 2]]) c.strokeRect(10 + i * ((w - 16) / 7), h * 0.3 + 2 + j * ((h * 0.7 - 8) / 5), (w - 16) / 7 - 4, (h * 0.7 - 8) / 5 - 4);
};
const paintPhoto = (seed: number) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, ['#7fc4f0', '#f0c27a', '#b6a0e0'][seed % 3]], [1, ['#cfeaf8', '#f6e0b0', '#e0d4f4'][seed % 3]]]); c.fillRect(0, 0, w, h);
  c.fillStyle = ['#5b9a52', '#9a6a3a', '#4a7a9a'][seed % 3]; c.fillRect(0, h * 0.62, w, h * 0.38);
  c.fillStyle = '#f4d7b8'; c.beginPath(); c.arc(w * 0.4, h * 0.5, w * 0.1, 0, 7); c.arc(w * 0.65, h * 0.52, w * 0.09, 0, 7); c.fill();
};

// rounded box (extruded rounded rectangle), cached geometry
const rgeoCache = new Map<string, THREE.ExtrudeGeometry>();
function rgeo(w: number, h: number, d: number, r: number) {
  const key = [w, h, d, r].join('_');
  let g = rgeoCache.get(key);
  if (!g) {
    const rr2 = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + rr2, -h / 2); s.lineTo(w / 2 - rr2, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr2);
    s.lineTo(w / 2, h / 2 - rr2); s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr2, h / 2); s.lineTo(-w / 2 + rr2, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr2); s.lineTo(-w / 2, -h / 2 + rr2); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr2, -h / 2);
    g = new THREE.ExtrudeGeometry(s, {depth: Math.max(0.002, d - 0.02), bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6});
    g.translate(0, 0, -(d - 0.02) / 2);
    rgeoCache.set(key, g);
  }
  return g;
}
export const RBox: React.FC<{s: V3; p: V3; rot?: V3; rad?: number; c?: string; map?: THREE.Texture; r?: number; m?: number; cast?: boolean; emissive?: string; ei?: number}> = ({s, p, rot, rad = 0.05, c = '#ffffff', map, r = 0.7, m = 0, cast = true, emissive, ei = 0}) => (
  <mesh geometry={rgeo(s[0], s[1], s[2], rad)} position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow>
    <Mat c={c} map={map} r={r} m={m} emissive={emissive} ei={ei} />
  </mesh>
);

/** Closed room: floor, ceiling, 4 walls with baseboards. Centered at (cx, cz). */
export const Room: React.FC<{cx?: number; cz?: number; w: number; d: number; h: number; floor: THREE.Texture; wall: THREE.Texture; ceilC?: string; base?: string; floorR?: number}> = ({cx = 0, cz = 0, w, d, h, floor, wall, ceilC = '#f1ede4', base = '#f4f1ea', floorR = 0.5}) => (
  <group>
    <SPlane w={w} h={d} p={[cx, 0, cz]} rot={[-Math.PI / 2, 0, 0]} map={floor} r={floorR} />
    <SPlane w={w} h={d} p={[cx, h, cz]} rot={[Math.PI / 2, 0, 0]} c={ceilC} r={0.95} recv={false} />
    <SPlane w={w} h={h} p={[cx, h / 2, cz - d / 2]} map={wall} r={0.9} />
    <SPlane w={w} h={h} p={[cx, h / 2, cz + d / 2]} rot={[0, Math.PI, 0]} map={wall} r={0.9} />
    <SPlane w={d} h={h} p={[cx - w / 2, h / 2, cz]} rot={[0, Math.PI / 2, 0]} map={wall} r={0.9} />
    <SPlane w={d} h={h} p={[cx + w / 2, h / 2, cz]} rot={[0, -Math.PI / 2, 0]} map={wall} r={0.9} />
    <SBox s={[w, 0.11, 0.03]} p={[cx, 0.055, cz - d / 2 + 0.015]} c={base} r={0.6} cast={false} />
    <SBox s={[w, 0.11, 0.03]} p={[cx, 0.055, cz + d / 2 - 0.015]} c={base} r={0.6} cast={false} />
    <SBox s={[0.03, 0.11, d]} p={[cx - w / 2 + 0.015, 0.055, cz]} c={base} r={0.6} cast={false} />
    <SBox s={[0.03, 0.11, d]} p={[cx + w / 2 - 0.015, 0.055, cz]} c={base} r={0.6} cast={false} />
    <SBox s={[w, 0.08, 0.06]} p={[cx, h - 0.04, cz - d / 2 + 0.03]} c={base} r={0.6} cast={false} />
  </group>
);

const AOstrip: React.FC<{p: V3; s: [number, number]; rot?: number; op?: number}> = ({p, s, rot = 0, op = 0.5}) => {
  const ao = ctex('ao', 128, 8, paintAO);
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, rot]} renderOrder={1}>
      <planeGeometry args={s} />
      <meshBasicMaterial map={ao} color="#000000" transparent opacity={op} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
};

// ================================================================================================== KITCHEN
export const Kitchen: React.FC<{
  t: number; variant: 'man' | 'neighbor'; lamp: number; clock?: boolean; phoneGlow?: number; tapDrip?: number; sky?: number; fridgeOpen?: number; dayWindow?: boolean;
}> = ({t, variant, lamp, clock, phoneGlow = 0, sky = 0.5, fridgeOpen = 0, dayWindow}) => {
  const man = variant === 'man';
  const halo = ctex('halo', 256, 256, paintHalo);
  const floor = ctex('kfloor' + variant, 512, 512, man ? paintPlanks('#b98a5a', 64) : paintTilesSmall('#e9e2cf', '#c9a14a'), [3, 3]);
  const wall = ctex('kwall' + variant, 512, 512, paintWall(man ? '#bfd8d4' : '#f0d58f'), [4, 1]);
  const metro = ctex('metro' + variant, 512, 512, paintMetro(man ? '#f2f6f4' : '#f6efe0'), [3, 1]);
  const night = ctex('winnight', 256, 256, paintSky);
  const dayTex = ctex('winday', 256, 256, paintDaySky);
  const clockTex = ctex('clockface', 256, 256, paintClock);
  const cal = ctex('calendar', 256, 320, paintCal());
  const photo = [ctex('ph0', 128, 128, paintPhoto(0)), ctex('ph1', 128, 128, paintPhoto(1)), ctex('ph2', 128, 128, paintPhoto(2))];
  const rug = ctex('krug' + variant, 512, 512, paintRug(man ? '#c9d9d3' : '#d98a5a', man ? '#6a9a94' : '#8a3a20'));
  const dark = lamp < 0.5;
  const doorWood = man ? '#e9e2d0' : '#8a5a3a';
  const cab = man ? '#9fc3be' : '#c97a3c';
  const top = man ? '#e8e6e0' : '#4a4a52';
  const fx = man ? -2.9 : -1.4; // fridge x
  const sinkX = man ? 0.9 : 1.6;
  const stoveX = man ? -1.3 : -3.0;
  const open = fridgeOpen;
  const pend = lamp * (0.9 + 0.1 * Math.sin(t * 40));
  const run: [number, number][] = man ? [[-2.3, -0.9], [-0.4, 2.5]] : [[-3.4, -2.6], [-0.2, 3.4]];
  return (
    <group>
      {/* lighting */}
      <hemisphereLight args={dark ? ['#2b3a78', '#14141c', 0.55] : ['#fff0d8', '#e0c9a8', 1.15]} />
      <directionalLight color={dark ? '#7f9cff' : '#fff0d8'} intensity={dark ? 0.6 : 1.1} position={dark ? [1, 2.2, 5] : [-1, 3, 5]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-3} shadow-camera-near={0.5} shadow-camera-far={20} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <ambientLight color="#ffffff" intensity={dark ? 0.04 : 0.14} />
      {lamp > 0 && <pointLight position={[man ? 1.9 : 1.6, 2.2, 0.6]} color="#ffe2b8" intensity={26 * pend} distance={9} decay={2} />}
      {lamp > 0 && <pointLight position={[-1.5, 2.4, -0.8]} color="#fff0d8" intensity={12 * pend} distance={8} decay={2} />}
      {phoneGlow > 0 && <pointLight position={[man ? 2.0 : 1.6, 1.0, 0.4]} color="#8fe3ff" intensity={2.6} distance={3.5} decay={2} />}
      {dark && <pointLight position={[man ? 0.9 : 1.6, 1.8, -1.5]} color="#7f9cff" intensity={4 + 6 * sky} distance={7} decay={2} />}

      <Room cx={0} cz={1.3} w={7.4} d={7.4} h={2.75} floor={floor} wall={wall} floorR={man ? 0.5 : 0.28} />
      {/* backsplash */}
      <SPlane w={7.2} h={0.75} p={[0, 1.3, -2.39]} map={metro} r={0.25} />
      {/* base cabinets + worktops */}
      {run.map(([a, b], k) => {
        const w = b - a, cx = (a + b) / 2;
        return (
          <group key={k}>
            <SBox s={[w, 0.82, 0.62]} p={[cx, 0.43, -2.08]} c={cab} r={0.55} />
            <SBox s={[w + 0.04, 0.05, 0.68]} p={[cx, 0.875, -2.06]} c={top} r={0.25} m={man ? 0 : 0.2} />
            {Array.from({length: Math.floor(w / 0.6)}).map((_, i) => (
              <group key={i} position={[a + 0.3 + i * (w / Math.floor(w / 0.6)) + (w / Math.floor(w / 0.6) - 0.6) / 2, 0.43, -1.765]}>
                <SBox s={[0.54, 0.7, 0.025]} p={[0, 0, 0]} c={doorWood} r={0.5} />
                <SBox s={[0.4, 0.55, 0.012]} p={[0, 0, 0.018]} c={shade(doorWood, 0.94)} r={0.5} />
                <SBox s={[0.02, 0.14, 0.03]} p={[0.2, 0.2, 0.04]} c="#c9ccd2" r={0.25} m={0.9} cast={false} />
              </group>
            ))}
            <SBox s={[w, 0.1, 0.6]} p={[cx, 0.05, -2.08]} c="#2d313b" r={0.7} cast={false} />
          </group>
        );
      })}
      {/* upper cabinets */}
      {(man ? [[-2.4, -0.25], [1.9, 3.2]] : [[-3.4, -2.2], [0.6, 3.4]]).map(([a, b], k) => (
        <group key={k}>
          <SBox s={[b - a, 0.8, 0.36]} p={[(a + b) / 2, 1.95, -2.2]} c={cab} r={0.55} />
          {Array.from({length: Math.floor((b - a) / 0.55)}).map((_, i) => (
            <SBox key={i} s={[(b - a) / Math.floor((b - a) / 0.55) - 0.04, 0.72, 0.02]} p={[a + (i + 0.5) * ((b - a) / Math.floor((b - a) / 0.55)), 1.95, -2.01]} c={doorWood} r={0.5} />
          ))}
        </group>
      ))}
      {/* window above the sink with a sky behind it */}
      <group position={[sinkX, 1.7, -2.395]}>
        <SBox s={[1.34, 1.14, 0.06]} p={[0, 0, 0]} c="#f4f1ea" r={0.6} />
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[1.2, 1.0]} />
          <meshBasicMaterial map={dayWindow ? dayTex : night} toneMapped={false} color={new THREE.Color(0.6 + sky * 2, 0.6 + sky * 2, 0.6 + sky * 2.2)} />
        </mesh>
        <SBox s={[0.04, 1.0, 0.04]} p={[0, 0, 0.06]} c="#f4f1ea" r={0.6} />
        <SBox s={[1.2, 0.04, 0.04]} p={[0, 0, 0.06]} c="#f4f1ea" r={0.6} />
        <SBox s={[0.22, 1.1, 0.04]} p={[-0.7, 0, 0.1]} c={man ? '#e8b55a' : '#c0392b'} r={0.95} />
        <SBox s={[0.22, 1.1, 0.04]} p={[0.7, 0, 0.1]} c={man ? '#e8b55a' : '#c0392b'} r={0.95} />
        <SBox s={[1.5, 0.05, 0.1]} p={[0, 0.62, 0.1]} c="#7a5230" r={0.7} />
      </group>
      {/* sink + tap */}
      <group position={[sinkX, 0.9, -2.08]}>
        <SBox s={[0.7, 0.012, 0.42]} p={[0, 0.02, 0.0]} c="#2d313b" r={0.6} />
        <SBox s={[0.64, 0.01, 0.36]} p={[0, 0.03, 0]} c="#aeb7c0" r={0.2} m={0.9} />
        <SCyl r0={0.025} h={0.3} p={[0, 0.17, -0.2]} c="#d8dde2" r={0.15} m={1} seg={12} />
        <SCyl r0={0.02} h={0.22} p={[0, 0.31, -0.1]} rot={[Math.PI / 2, 0, 0]} c="#d8dde2" r={0.15} m={1} seg={12} />
        <SBox s={[0.12, 0.03, 0.04]} p={[0.07, 0.24, -0.2]} c="#d8dde2" r={0.15} m={1} />
      </group>
      {/* stove + hood */}
      <group position={[stoveX, 0.9, -2.06]}>
        <SBox s={[0.62, 0.02, 0.58]} p={[0, 0.02, 0]} c="#1c1e24" r={0.2} m={0.4} />
        {[[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]].map(([x, z], i) => <SCyl key={i} r0={i % 2 ? 0.07 : 0.055} h={0.015} p={[x, 0.04, z]} c="#44474f" r={0.4} m={0.7} seg={20} />)}
        <SCyl r0={0.1} h={0.1} p={[0.14, 0.1, 0.12]} c="#c9ccd2" r={0.2} m={0.9} seg={18} />
      </group>
      <SBox s={[0.7, 0.4, 0.45]} p={[stoveX, 1.9, -2.15]} c="#c9ccd2" r={0.25} m={0.85} />
      {/* fridge (door animates) */}
      <group position={[fx, 0, -2.0]}>
        <SBox s={[0.84, 1.86, 0.74]} p={[0, 0.93, 0]} c="#dfe3e8" r={0.3} m={0.55} />
        {open > 0.02 && (
          <group>
            {/* interior shelves */}
            {[0.4, 0.8, 1.2, 1.55].map((y) => <SBox key={y} s={[0.74, 0.02, 0.62]} p={[0, y, 0.04]} c="#e8f4f8" r={0.1} m={0.1} />)}
            <SBox s={[0.76, 1.7, 0.02]} p={[0, 0.93, -0.3]} c="#eef6f8" r={0.5} />
            {!man && <>
              <SCyl r0={0.045} h={0.16} p={[-0.2, 0.9, 0.1]} c="#7aa84a" r={0.4} />
              <SBall r0={0.05} p={[0.15, 0.85, 0.12]} c="#f2d23a" r={0.6} />
              <SCyl r0={0.03} h={0.2} p={[0.25, 1.32, 0.0]} c="#d93a40" r={0.4} />
              <SBox s={[0.14, 0.05, 0.1]} p={[-0.1, 0.43, 0.2]} c="#f6e08a" r={0.6} />
            </>}
            <pointLight position={[0, 1.2, 0.4]} color="#e8f6ff" intensity={5 * open} distance={3} decay={2} />
            <mesh position={[0, 1.2, 0.2]}><boxGeometry args={[0.7, 1.5, 0.5]} /><meshBasicMaterial color={new THREE.Color(1.8 * open, 1.9 * open, 2 * open)} transparent opacity={0.0} /></mesh>
          </group>
        )}
        <group position={[-0.42, 0.93, 0.37]} rotation={[0, -open * 1.75, 0]}>
          <SBox s={[0.84, 1.86, 0.06]} p={[0.42, 0, 0.0]} c="#e4e8ec" r={0.3} m={0.55} />
          <SBox s={[0.03, 0.5, 0.05]} p={[0.74, 0.1, 0.06]} c="#9aa3ad" r={0.2} m={0.9} cast={false} />
          <SBox s={[0.04, 0.6, 0.05]} p={[0.74, 0.7, 0.06]} c="#9aa3ad" r={0.2} m={0.9} cast={false} />
          {[0, 1, 2, 3].map((i) => <SBox key={i} s={[0.07, 0.07, 0.015]} p={[0.15 + (i % 2) * 0.16, 0.2 + Math.floor(i / 2) * 0.12, 0.04]} c={['#d93a40', '#2f7fd0', '#f2c53d', '#3aa65b'][i]} r={0.5} cast={false} />)}
          <SPlane w={0.2} h={0.2} p={[0.38, 0.62, 0.035]} map={photo[0]} r={0.5} />
          <SPlane w={0.16} h={0.2} p={[0.6, 0.4, 0.035]} map={photo[1]} r={0.5} />
          {!man && <SPlane w={0.3} h={0.2} p={[0.3, 0.1, 0.035]} c="#f6f0d0" r={0.8} />}
          {open > 0.02 && <SBox s={[0.76, 0.5, 0.06]} p={[0.42, -0.5, -0.07]} c="#e8f4f8" r={0.3} />}
        </group>
      </group>
      {/* wall clock + calendar */}
      {clock && (
        <group position={[man ? -1.0 : 1.0, 2.0, -2.38]}>
          <SCyl r0={0.3} h={0.05} p={[0, 0, 0.02]} rot={[Math.PI / 2, 0, 0]} c="#2d313b" r={0.5} seg={32} />
          <SPlane w={0.52} h={0.52} p={[0, 0, 0.05]} map={clockTex} r={0.4} />
          <group position={[0, 0, 0.07]}>
            <group rotation={[0, 0, -(t * 6.0)]}><SBox s={[0.014, 0.2, 0.01]} p={[0, 0.1, 0]} c="#d93a40" r={0.5} cast={false} /></group>
            <group rotation={[0, 0, -(t * 0.5 + 1)]}><SBox s={[0.03, 0.15, 0.012]} p={[0, 0.07, 0]} c="#2d313b" r={0.5} cast={false} /></group>
          </group>
        </group>
      )}
      <SPlane w={0.4} h={0.5} p={[man ? -2.2 : 0.2, 1.65, -2.38]} map={cal} r={0.8} />
      {/* worktop clutter */}
      <group position={[man ? 2.0 : 2.6, 0.9, -2.0]}>
        <SBox s={[0.34, 0.04, 0.24]} p={[0, 0.04, 0]} c="#b8793d" r={0.8} />
        <SBox s={[0.28, 0.2, 0.22]} p={[0.7, 0.12, 0]} c="#c9ccd2" r={0.25} m={0.9} />
        <SCyl r0={0.1} h={0.2} p={[0.4, 0.12, 0.05]} c={man ? '#d98a5a' : '#8fb0c8'} r={0.6} seg={18} />
        {man && <SBall r0={0.12} p={[-0.5, 0.15, 0.0]} c="#4f9a4a" r={0.9} />}
        {man && <SCyl r0={0.09} h={0.14} p={[-0.5, 0.06, 0]} c="#c9743a" r={0.9} seg={14} />}
      </group>
      {/* dining table + chairs */}
      <group position={[man ? 2.0 : 1.9, 0, 0.7]}>
        <SCyl r0={0.55} h={0.05} p={[0, 0.82, 0]} c={man ? '#d9b480' : '#8a5a3a'} r={0.5} seg={36} />
        <SCyl r0={0.06} h={0.8} p={[0, 0.4, 0]} c="#2d313b" r={0.5} m={0.5} seg={12} />
        <SCyl r0={0.3} h={0.04} p={[0, 0.02, 0]} c="#2d313b" r={0.5} m={0.5} seg={20} />
        {[-0.3, 0.3].map((x) => <group key={x} position={[x * 1.5, 0, 0.1]}>
          <RBox s={[0.42, 0.06, 0.42]} p={[0, 0.46, 0]} c={man ? '#e8b55a' : '#c0392b'} r={0.7} rad={0.04} />
          <RBox s={[0.42, 0.45, 0.05]} p={[0, 0.72, -0.2]} c={man ? '#e8b55a' : '#c0392b'} r={0.7} rad={0.04} />
          {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([a, b], i) => <SBox key={i} s={[0.04, 0.44, 0.04]} p={[a, 0.22, b]} c="#2d313b" r={0.5} cast={false} />)}
        </group>)}
        {man ? <>
          <SCyl r0={0.12} h={0.05} p={[-0.2, 0.87, 0.1]} c="#f4f1ea" r={0.3} seg={24} />
          <SCyl r0={0.05} h={0.1} p={[0.18, 0.92, -0.1]} c="#c0392b" r={0.5} seg={16} />
          <SBox s={[0.28, 0.01, 0.2]} p={[0.0, 0.855, 0.3]} c="#e9e4d4" r={0.9} />
        </> : <>
          <SBox s={[0.34, 0.05, 0.34]} p={[-0.1, 0.87, 0.0]} c="#c8873a" r={0.8} />
          <SBox s={[0.34, 0.05, 0.34]} p={[-0.1, 0.92, 0.0]} c="#c8873a" r={0.8} rot={[0, 0.3, 0]} />
          <SCyl r0={0.05} h={0.1} p={[0.2, 0.92, 0.12]} c="#e8e8e8" r={0.5} seg={16} />
        </>}
      </group>
      {/* pendant lamp over the table */}
      <group position={[man ? 2.0 : 1.9, 2.75, 0.7]}>
        <SCyl r0={0.008} h={0.7} p={[0, -0.35, 0]} c="#2d313b" r={0.5} seg={6} cast={false} />
        <mesh position={[0, -0.76, 0]}>
          <coneGeometry args={[0.28, 0.2, 24, 1, true]} />
          <meshStandardMaterial color={man ? '#d98a5a' : '#2f6fae'} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.82, 0]}><sphereGeometry args={[0.07, 14, 10]} /><meshStandardMaterial color={lamp > 0 ? new THREE.Color(3.4, 3.1, 2.4) : '#555'} emissive="#ffd9a0" emissiveIntensity={lamp > 0 ? 1 : 0} toneMapped={false} /></mesh>
        {lamp > 0 && <Halo tex={halo} p={[0, -0.85, 0.1]} w={1.4} color="#ffe2b0" op={0.5 * pend} />}
      </group>
      {/* rug, AO, plants, shelf with jars, bin */}
      <SPlane w={2.2} h={1.5} p={[man ? 0.4 : 0.2, 0.006, -0.2]} rot={[-Math.PI / 2, 0, 0]} map={rug} r={1} />
      <AOstrip p={[0, 0.007, -1.72]} s={[7, 0.6]} rot={0} op={0.5} />
      <AOstrip p={[-3.4, 0.007, 1.3]} s={[7, 0.5]} rot={Math.PI / 2} op={0.4} />
      <AOstrip p={[3.4, 0.007, 1.3]} s={[7, 0.5]} rot={-Math.PI / 2} op={0.4} />
      <group position={[3.25, 0, 1.8]}>
        <SBox s={[0.3, 1.5, 0.9]} p={[0, 0.75, 0]} c="#9a6b3c" r={0.7} />
        {[0.3, 0.7, 1.1, 1.45].map((y, i) => <SBox key={i} s={[0.32, 0.03, 0.88]} p={[0, y, 0]} c="#7a5230" r={0.7} />)}
        {Array.from({length: 8}).map((_, i) => <SCyl key={i} r0={0.06} h={0.18} p={[0, 0.8 + Math.floor(i / 4) * 0.4 + 0.1, -0.3 + (i % 4) * 0.2]} c={['#d98a5a', '#4f9a4a', '#f2c53d', '#2f7fd0'][i % 4]} r={0.4} seg={14} />)}
      </group>
      <group position={[-3.3, 0, 2.6]}>
        <SCyl r0={0.16} h={0.3} p={[0, 0.15, 0]} c="#c9743a" r={0.9} seg={16} />
        {[0, 1, 2, 3, 4].map((i) => <SBall key={i} r0={0.14} p={[Math.sin(i * 1.3) * 0.12, 0.5 + i * 0.1, Math.cos(i * 1.3) * 0.12]} c="#3f9a4a" r={0.9} />)}
      </group>
      <SBox s={[0.5, 0.05, 0.4]} p={[-1.3, 0.04, -1.4]} c="#7aa8c8" r={0.9} cast={false} />
      {!man && <>
        {/* messy bachelor kitchen: pizza boxes, cans, dishes in the sink, dishcloth */}
        {[0, 1, 2].map((i) => <SBox key={i} s={[0.42, 0.05, 0.42]} p={[1.6 + i * 0.01, 0.94 + i * 0.05, -2.0]} c="#c8873a" r={0.8} rot={[0, 0.2 * i, 0]} />)}
        {[0, 1, 2, 3].map((i) => <SCyl key={i} r0={0.04} h={0.12} p={[0.5 + i * 0.1, 0.98, -2.0]} c={['#d93a40', '#2f7fd0', '#3aa65b', '#f2c53d'][i]} r={0.4} m={0.4} seg={14} />)}
        {[0, 1, 2].map((i) => <SCyl key={'d' + i} r0={0.11} h={0.015} p={[sinkX - 0.1 + i * 0.04, 0.93 + i * 0.03, -2.08]} c="#f4f1ea" r={0.3} seg={20} />)}
      </>}
      {/* phone is its own prop on the table in shot 26 (drawn by the shot) */}
    </group>
  );
};
function paintCal() {
  return (c: Ctx, w: number, h: number) => {
    c.fillStyle = '#fffdf2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d93a40'; c.fillRect(0, 0, w, h * 0.2);
    c.strokeStyle = '#b9b3a4'; c.lineWidth = 2;
    const gx = (w - 16) / 7, gy = (h * 0.7 - 8) / 5;
    for (let i = 0; i <= 7; i++) { c.beginPath(); c.moveTo(8 + i * gx, h * 0.3); c.lineTo(8 + i * gx, h - 8); c.stroke(); }
    for (let j = 0; j <= 5; j++) { c.beginPath(); c.moveTo(8, h * 0.3 + j * gy); c.lineTo(w - 8, h * 0.3 + j * gy); c.stroke(); }
    c.strokeStyle = '#d93a40'; c.lineWidth = 6;
    for (const [i, j] of [[3, 2], [4, 2], [5, 2]]) c.strokeRect(10 + i * gx, h * 0.3 + 2 + j * gy, gx - 4, gy - 4);
  };
}

// ================================================================================================== LIVING ROOM + BACKPACK
const PACK = '#e0752b';
export const Backpack: React.FC<{p: V3; open: number; zip: number; yaw?: number}> = ({p, open, zip, yaw = 0}) => {
  const pull = lerp(-0.18, 0.18, zip);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <RBox s={[0.46, 0.62, 0.26]} p={[0, 0.31, 0]} c={PACK} r={0.75} rad={0.1} />
      <RBox s={[0.38, 0.28, 0.1]} p={[0, 0.2, 0.17]} c="#b85a1c" r={0.75} rad={0.05} />
      <RBox s={[0.1, 0.34, 0.14]} p={[-0.27, 0.22, 0.02]} c="#b85a1c" r={0.75} rad={0.04} />
      <RBox s={[0.1, 0.34, 0.14]} p={[0.27, 0.22, 0.02]} c="#b85a1c" r={0.75} rad={0.04} />
      {/* lid flap, hinged at the back-top edge */}
      <group position={[0, 0.62, -0.1]} rotation={[-open * 1.5, 0, 0]}>
        <RBox s={[0.44, 0.04, 0.3]} p={[0, 0.02, 0.15]} c="#c9622a" r={0.75} rad={0.02} />
        <SBox s={[0.06, 0.02, 0.05]} p={[0, 0.0, 0.3]} c="#2d313b" r={0.5} />
      </group>
      {/* zipper track + pull */}
      <SBox s={[0.34, 0.012, 0.012]} p={[0, 0.605, 0.12]} c="#2d313b" r={0.5} cast={false} />
      <SBox s={[0.03, 0.03, 0.02]} p={[pull, 0.6, 0.13]} c="#d8dde2" r={0.2} m={0.9} cast={false} />
      <SBox s={[0.06, 0.03, 0.12]} p={[0, 0.65, -0.02]} c="#b85a1c" r={0.7} />
      {[-1, 1].map((sd) => <SBox key={sd} s={[0.06, 0.5, 0.03]} p={[sd * 0.14, 0.3, -0.14]} c="#2d313b" r={0.8} />)}
      {/* dark interior seen when open */}
      {open > 0.1 && <SBox s={[0.38, 0.02, 0.2]} p={[0, 0.6, 0]} c="#3a2418" r={1} />}
    </group>
  );
};

const FlyItem: React.FC<{kind: string; u: number; from: V3; to: V3; seed: number}> = ({kind, u, from, to, seed}) => {
  if (u <= 0 || u >= 1) return null;
  const k = u * u * (3 - 2 * u);
  const pos: V3 = [lerp(from[0], to[0], k), lerp(from[1], to[1], k) + Math.sin(u * Math.PI) * 0.7, lerp(from[2], to[2], k)];
  const rot: V3 = [u * 4 + seed, u * 3, u * 5];
  return (
    <group position={pos} rotation={rot}>
      {kind === 'bottle' && <><SCyl r0={0.05} h={0.26} p={[0, 0, 0]} c="#68b7ee" r={0.2} seg={14} /><SCyl r0={0.022} h={0.05} p={[0, 0.15, 0]} c="#1f5fa8" r={0.4} seg={10} /></>}
      {kind === 'can' && <SCyl r0={0.045} h={0.11} p={[0, 0, 0]} c="#d9552b" r={0.4} m={0.3} seg={14} />}
      {kind === 'torch' && <><SCyl r0={0.03} h={0.2} p={[0, 0, 0]} c="#2a2f3a" r={0.4} seg={12} /><SCyl r0={0.045} h={0.07} p={[0, 0.12, 0]} c="#f2c53d" r={0.4} seg={12} /></>}
      {kind === 'radio' && <><SBox s={[0.24, 0.14, 0.1]} p={[0, 0, 0]} c="#c0392b" r={0.5} /><SBox s={[0.008, 0.16, 0.008]} p={[0.09, 0.14, 0]} c="#c9ccd2" r={0.3} m={0.8} /></>}
      {kind === 'cash' && <><SBox s={[0.16, 0.05, 0.08]} p={[0, 0, 0]} c="#6fb06a" r={0.8} /><SBox s={[0.04, 0.052, 0.082]} p={[0, 0, 0]} c="#e8e1c0" r={0.8} /></>}
      {kind === 'blanket' && <SCyl r0={0.07} h={0.3} p={[0, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#7a8fb8" r={0.95} seg={14} />}
    </group>
  );
};

export const Home: React.FC<{t: number; zip: number; items: {kind: string; u: number}[]; packOpen: number; lift: number; pack?: V3; showItems?: boolean}> = ({t, zip, items, packOpen, lift, pack = [-0.9, 0, -0.6], showItems = true}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const floor = ctex('hfloor', 512, 512, paintPlanks('#a9774a', 72), [4, 4]);
  const wall = ctex('hwall', 512, 512, paintWall('#e6d9c4', '#dccdb3'), [5, 1]);
  const rug = ctex('hrug', 512, 512, paintRug('#6f8fb0', '#e8d9a8'));
  const night = ctex('winnight', 256, 256, paintSky);
  const day = ctex('winday', 256, 256, paintDaySky);
  const photo = [ctex('ph0', 128, 128, paintPhoto(0)), ctex('ph1', 128, 128, paintPhoto(1)), ctex('ph2', 128, 128, paintPhoto(2))];
  void night;
  const packPos: V3 = [pack[0], pack[1] + lift, pack[2]];
  const itemFrom: V3[] = [[-2.4, 1.0, 0.1], [-2.4, 1.1, 0.1], [-2.3, 1.2, 0.2], [-2.3, 1.1, 0.0], [-2.4, 1.2, 0.1], [-2.3, 1.0, 0.2]];
  return (
    <group>
      <hemisphereLight args={['#fff0d8', '#d9c4a0', 1.15]} />
      <directionalLight color="#ffe0b0" intensity={1.9} position={[3, 4.5, 5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-5} shadow-camera-near={0.5} shadow-camera-far={22} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.5} position={[-4, 2, 3]} />
      <ambientLight intensity={0.14} />
      <pointLight position={[-1.5, 2.3, 0.5]} color="#ffe2b8" intensity={18} distance={9} decay={2} />
      <pointLight position={[2.0, 2.3, -1]} color="#ffe2b8" intensity={12} distance={8} decay={2} />
      <Room cx={0} cz={1} w={9} d={8} h={2.8} floor={floor} wall={wall} />
      <SPlane w={3.4} h={2.3} p={[-1.0, 0.007, -0.1]} rot={[-Math.PI / 2, 0, 0]} map={rug} r={1} />
      <AOstrip p={[0, 0.008, -2.97]} s={[9, 0.6]} op={0.5} />
      <AOstrip p={[-4.47, 0.008, 1]} s={[8, 0.5]} rot={Math.PI / 2} op={0.4} />
      <AOstrip p={[4.47, 0.008, 1]} s={[8, 0.5]} rot={-Math.PI / 2} op={0.4} />
      {/* front door + coat rack + shoes + console table, on the back wall */}
      <group position={[1.7, 0, -2.95]}>
        <SBox s={[1.2, 2.3, 0.08]} p={[0, 1.15, -0.02]} c="#f4f1ea" r={0.6} />
        <SBox s={[0.96, 2.14, 0.06]} p={[0, 1.1, 0.02]} c="#2f6fae" r={0.5} />
        <SBox s={[0.7, 0.9, 0.02]} p={[0, 1.48, 0.06]} c="#27598f" r={0.5} />
        <SBox s={[0.7, 0.9, 0.02]} p={[0, 0.5, 0.06]} c="#27598f" r={0.5} />
        <SBall r0={0.04} p={[0.38, 1.05, 0.08]} c="#d8b04a" r={0.3} m={0.8} />
        <SBox s={[0.5, 0.012, 0.5]} p={[0, 0.01, 0.4]} c="#7a5230" r={1} />
      </group>
      <group position={[3.2, 0, -2.85]}>
        <SBox s={[0.04, 1.9, 0.04]} p={[0, 0.95, 0]} c="#2d313b" r={0.5} m={0.5} />
        {[0, 1, 2].map((i) => <SBox key={i} s={[0.3, 0.03, 0.03]} p={[0.0, 1.5 - i * 0.2, 0.0]} c="#2d313b" r={0.5} />)}
        <RBox s={[0.45, 0.8, 0.08]} p={[-0.1, 1.15, 0.1]} c="#5c7a9a" r={0.9} rad={0.12} />
        <RBox s={[0.4, 0.7, 0.08]} p={[0.15, 1.1, 0.14]} c="#9a3f3a" r={0.9} rad={0.12} />
      </group>
      {[0, 1].map((i) => <SBox key={i} s={[0.28, 0.1, 0.1]} p={[2.5 - i * 0.35, 0.06, -2.6]} c={['#2d313b', '#7a5230'][i]} r={0.8} rot={[0, 0.3 * i, 0]} />)}
      {/* window with curtains */}
      <group position={[-2.6, 1.55, -2.97]}>
        <SBox s={[1.6, 1.3, 0.06]} p={[0, 0, 0]} c="#f4f1ea" r={0.6} />
        <mesh position={[0, 0, 0.04]}><planeGeometry args={[1.46, 1.16]} /><meshBasicMaterial map={day} toneMapped={false} color={new THREE.Color(1.5, 1.5, 1.5)} /></mesh>
        <SBox s={[0.04, 1.16, 0.04]} p={[0, 0, 0.06]} c="#f4f1ea" r={0.6} />
        <SBox s={[1.46, 0.04, 0.04]} p={[0, 0, 0.06]} c="#f4f1ea" r={0.6} />
        <SBox s={[0.34, 1.5, 0.06]} p={[-0.85, 0, 0.1]} c="#d98a5a" r={0.95} />
        <SBox s={[0.34, 1.5, 0.06]} p={[0.85, 0, 0.1]} c="#d98a5a" r={0.95} />
        <SBox s={[2.1, 0.04, 0.04]} p={[0, 0.82, 0.12]} c="#7a5230" r={0.5} />
        <Halo tex={halo} p={[0, -0.2, 0.9]} w={2.6} h={2.6} color="#fff0c0" op={0.14} />
      </group>
      {/* sofa + cushions + coffee table + lamp (left side, where the items start) */}
      <group position={[-3.4, 0, 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <RBox s={[2.0, 0.42, 0.9]} p={[0, 0.3, 0]} c="#5c7a9a" r={0.95} rad={0.1} />
        <RBox s={[2.0, 0.55, 0.22]} p={[0, 0.7, -0.35]} c="#4e6a88" r={0.95} rad={0.1} />
        {[-1, 1].map((sd) => <RBox key={sd} s={[0.22, 0.55, 0.9]} p={[sd * 1.0, 0.5, 0]} c="#4e6a88" r={0.95} rad={0.1} />)}
        {[-0.45, 0.45].map((x) => <RBox key={x} s={[0.85, 0.16, 0.7]} p={[x, 0.58, 0.05]} c="#6a8aab" r={0.95} rad={0.07} />)}
        <RBox s={[0.34, 0.34, 0.12]} p={[-0.7, 0.72, 0.15]} c="#e8b55a" r={0.95} rad={0.08} rot={[-0.2, 0.2, 0.1]} />
        <RBox s={[0.34, 0.34, 0.12]} p={[0.75, 0.72, 0.15]} c="#d9525a" r={0.95} rad={0.08} rot={[-0.2, -0.3, -0.1]} />
        {[[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]].map(([a, b], i) => <SBox key={i} s={[0.05, 0.1, 0.05]} p={[a, 0.05, b]} c="#3a2418" r={0.7} />)}
      </group>
      <group position={[-2.2, 0, 0.2]}>
        <SBox s={[0.7, 0.04, 1.1]} p={[0, 0.42, 0]} c="#7a5230" r={0.5} />
        {[[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]].map(([a, b], i) => <SBox key={i} s={[0.05, 0.4, 0.05]} p={[a, 0.2, b]} c="#3a2418" r={0.6} />)}
        <SCyl r0={0.09} h={0.03} p={[0.1, 0.46, 0.3]} c="#c0392b" r={0.5} seg={18} />
      </group>
      <group position={[-3.9, 0, -2.2]}>
        <SCyl r0={0.14} h={0.03} p={[0, 0.015, 0]} c="#2d313b" r={0.5} seg={18} />
        <SCyl r0={0.015} h={1.4} p={[0, 0.7, 0]} c="#2d313b" r={0.5} seg={8} />
        <mesh position={[0, 1.5, 0]}><coneGeometry args={[0.22, 0.28, 20, 1, true]} /><meshStandardMaterial color="#f6e7c2" emissive="#ffd9a0" emissiveIntensity={0.6} side={THREE.DoubleSide} /></mesh>
        <Halo tex={halo} p={[0, 1.45, 0.2]} w={1.4} color="#ffe2b0" op={0.45} />
      </group>
      {/* bookshelf on the right wall with photos */}
      <group position={[4.3, 0, -0.4]} rotation={[0, -Math.PI / 2, 0]}>
        <SBox s={[1.6, 2.1, 0.34]} p={[0, 1.05, 0]} c="#8a5a3a" r={0.7} />
        {[0.3, 0.72, 1.14, 1.56, 1.98].map((y) => <SBox key={y} s={[1.56, 0.03, 0.36]} p={[0, y, 0.01]} c="#6f4528" r={0.7} />)}
        {Array.from({length: 24}).map((_, i) => <SBox key={i} s={[0.05 + hash(i, 1) * 0.04, 0.26 + hash(i, 2) * 0.1, 0.22]} p={[-0.7 + (i % 8) * 0.19 + hash(i, 4) * 0.03, 0.46 + Math.floor(i / 8) * 0.42, 0.04]} c={['#d93a40', '#2f7fd0', '#f2c53d', '#3aa65b', '#7a52c8', '#f08a24'][i % 6]} r={0.8} />)}
        <SPlane w={0.3} h={0.3} p={[0.4, 1.0, 0.2]} map={photo[2]} r={0.5} />
      </group>
      <SPlane w={0.5} h={0.4} p={[4.47, 1.8, 2.3]} rot={[0, -Math.PI / 2, 0]} map={photo[1]} r={0.5} />
      {/* the backpack and a stool next to it */}
      <Backpack p={packPos} open={packOpen} zip={zip} yaw={0.25} />
      <group position={[0.1, 0, -1.4]}>
        <SCyl r0={0.22} h={0.04} p={[0, 0.46, 0]} c="#c9a14a" r={0.6} seg={24} />
        {[0, 1, 2].map((i) => <SBox key={i} s={[0.03, 0.46, 0.03]} p={[Math.sin(i * 2.1) * 0.15, 0.23, Math.cos(i * 2.1) * 0.15]} c="#6f4528" r={0.6} />)}
        <SBox s={[0.12, 0.2, 0.08]} p={[0, 0.58, 0]} c="#e8c24a" r={0.6} />
      </group>
      {/* items waiting on the coffee table, then flying into the pack */}
      {showItems && items.map((it, i) => <FlyItem key={it.kind} kind={it.kind} u={it.u} from={itemFrom[i]} to={[packPos[0], packPos[1] + 0.7, packPos[2] + 0.03]} seed={i} />)}
      {showItems && items.map((it, i) => it.u <= 0 ? <FlyItem key={'w' + i} kind={it.kind} u={0.5} from={[-2.35 + i * 0.07, 0.62, 0.0 + i * 0.12]} to={[-2.35 + i * 0.07, 0.5, 0.0 + i * 0.12]} seed={0} /> : null)}
      <group visible={false}>{t < -1 && null}</group>
    </group>
  );
};

// ================================================================================================== DESK (booklet close-up)
export const Desk: React.FC<{t: number}> = ({t}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const cover = ctex('deskcover', 640, 900, (c, w, h) => fitCover(c, w, h));
  const wood = ctex('deskwood', 1024, 1024, paintPlanks('#9a6a40', 128, true), [2, 2]);
  const wall = ctex('deskwall', 512, 512, paintWall('#3f5f86', '#37557b'), [6, 1]);
  const cork = ctex('cork', 256, 256, (c, w, h) => { c.fillStyle = '#c09560'; c.fillRect(0, 0, w, h); blot(c, 4, 60, w, h, 6, 22, '110,70,30', 0.35); blot(c, 9, 50, w, h, 6, 22, '230,200,150', 0.3); });
  const flutter = Math.sin(t * 5) * 0.012;
  const steam = (i: number) => ({y: ((t * 0.3 + i / 4) % 1), x: Math.sin(t * 3 + i) * 0.02});
  return (
    <group>
      <hemisphereLight args={['#bcd6ff', '#7a5a3a', 0.9]} />
      <directionalLight color="#ffd0a0" intensity={1.6} position={[-2.5, 5, 3.5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-3} shadow-camera-near={0.5} shadow-camera-far={16} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <pointLight position={[-1.45, 1.4, 0.2]} color="#ffd9a0" intensity={14} distance={6} decay={2} />
      <ambientLight intensity={0.1} />
      {/* big desk top (extends far past every edge), wall, floor */}
      <SPlane w={26} h={26} p={[0, 0, 0]} rot={[-Math.PI / 2, 0, 0]} map={wood} r={0.5} />
      <SPlane w={26} h={9} p={[0, 4.5, -3.2]} map={wall} r={0.9} />
      <SPlane w={26} h={9} p={[0, 4.5, 9]} rot={[0, Math.PI, 0]} map={wall} r={0.9} />
      <SPlane w={16} h={9} p={[-13, 4.5, 3]} rot={[0, Math.PI / 2, 0]} map={wall} r={0.9} />
      <SPlane w={16} h={9} p={[13, 4.5, 3]} rot={[0, -Math.PI / 2, 0]} map={wall} r={0.9} />
      <SPlane w={26} h={26} p={[0, 9, 3]} rot={[Math.PI / 2, 0, 0]} c="#e9e4d8" r={0.95} recv={false} />
      <SPlane w={2.6} h={1.6} p={[1.6, 1.8, -3.15]} map={cork} r={0.9} />
      {[[1.0, 2.2], [1.9, 1.7], [2.3, 2.3], [1.3, 1.5]].map(([x, y], i) => <SBox key={i} s={[0.4, 0.3, 0.01]} p={[x, y, -3.12]} c={['#f6f0d0', '#d9e8f6', '#f6d9d9', '#e0f0d6'][i]} r={0.9} rot={[0, 0, (i - 1.5) * 0.12]} />)}
      <SBox s={[0.9, 0.04, 0.3]} p={[-2.0, 2.4, -3.0]} c="#6f4528" r={0.7} />
      {[0, 1, 2, 3, 4, 5].map((i) => <SBox key={i} s={[0.1, 0.3 + hash(i, 1) * 0.1, 0.22]} p={[-2.35 + i * 0.13, 2.6, -3.0]} c={['#d93a40', '#2f7fd0', '#f2c53d', '#3aa65b', '#7a52c8', '#f08a24'][i]} r={0.8} />)}
      {/* the booklet */}
      <group position={[0, 0.5, 0.2]} rotation={[-0.45 + flutter, 0.1, 0.08]}>
        <SBox s={[1.1, 1.55, 0.04]} p={[0, 0, 0]} c="#fffdf2" r={0.7} />
        <SPlane w={1.06} h={1.5} p={[0, 0, 0.022]} map={cover} r={0.45} />
        <SBox s={[1.08, 1.53, 0.02]} p={[0.02, -0.02, -0.03]} c="#efe9d6" r={0.8} />
      </group>
      {/* desk clutter: lamp, mug with steam, pens cup, glasses, notebook, keys, plant, envelopes, clip */}
      <group position={[-1.6, 0, -0.7]}>
        <SCyl r0={0.22} h={0.05} p={[0, 0.025, 0]} c="#2d313b" r={0.5} m={0.6} seg={24} />
        <SBox s={[0.03, 0.9, 0.03]} p={[0.05, 0.45, 0]} c="#2d313b" r={0.5} m={0.6} />
        <group position={[0.05, 0.9, 0]} rotation={[0, 0, 0.7]}>
          <SBox s={[0.03, 0.55, 0.03]} p={[0, 0.27, 0]} c="#2d313b" r={0.5} m={0.6} />
          <mesh position={[0, 0.58, 0]} rotation={[0, 0, 1.2]}><coneGeometry args={[0.17, 0.26, 20, 1, true]} /><meshStandardMaterial color="#d9a53a" side={THREE.DoubleSide} roughness={0.4} metalness={0.4} emissive="#ffd9a0" emissiveIntensity={0.4} /></mesh>
        </group>
        <Halo tex={halo} p={[0.35, 0.95, 0.2]} w={1.3} color="#ffe2b0" op={0.45} />
      </group>
      <group position={[1.5, 0, 0.9]}>
        <SCyl r0={0.11} h={0.2} p={[0, 0.1, 0]} c="#f4f1ea" r={0.3} seg={22} />
        <SCyl r0={0.095} h={0.01} p={[0, 0.19, 0]} c="#3a2418" r={0.2} seg={20} />
        {[0, 1, 2, 3].map((i) => { const s = steam(i); return <Halo key={i} tex={halo} p={[s.x, 0.3 + s.y * 0.5, 0.0]} w={0.22 + s.y * 0.2} color="#ffffff" op={0.4 * (1 - s.y)} />; })}
      </group>
      <group position={[-1.1, 0, 1.2]}>
        <SCyl r0={0.07} h={0.2} p={[0, 0.1, 0]} c="#2f7fd0" r={0.5} seg={18} />
        {[0, 1, 2, 3].map((i) => <SCyl key={i} r0={0.008} h={0.28} p={[(i - 1.5) * 0.025, 0.28, 0]} rot={[0.05 * (i - 1.5), 0, 0.2 * (i - 1.5)]} c={['#d93a40', '#f2c53d', '#3aa65b', '#2d313b'][i]} r={0.5} seg={6} />)}
      </group>
      <SBox s={[0.5, 0.05, 0.36]} p={[-0.9, 0.03, 0.4]} c="#d93a40" r={0.7} rot={[0, 0.4, 0]} />
      <SBox s={[0.5, 0.045, 0.36]} p={[-0.9, 0.075, 0.4]} c="#fff6dc" r={0.8} rot={[0, 0.4, 0]} />
      <group position={[1.4, 0, -0.6]}>
        {[0, 1, 2].map((i) => <SBox key={i} s={[0.4, 0.01, 0.28]} p={[0, 0.006 + i * 0.012, 0]} c={['#f6f0d0', '#e8f0f6', '#f4e6e6'][i]} r={0.9} rot={[0, 0.2 + i * 0.25, 0]} />)}
        <SCyl r0={0.04} h={0.3} p={[0.3, 0.04, 0.4]} rot={[0, 0, Math.PI / 2]} c="#f2c53d" r={0.4} seg={8} />
      </group>
      <group position={[0.7, 0, 1.55]}>
        <SCyl r0={0.007} h={0.2} p={[0, 0.01, 0]} rot={[Math.PI / 2, 0, 0.3]} c="#c9ccd2" r={0.3} m={0.9} seg={6} />
        <SBall r0={0.05} p={[0.3, 0.05, -0.1]} c="#c9ccd2" r={0.3} m={0.9} />
      </group>
      <group position={[2.3, 0, -1.3]}>
        <SCyl r0={0.16} h={0.28} p={[0, 0.14, 0]} c="#c9743a" r={0.9} seg={18} />
        {[0, 1, 2, 3, 4, 5].map((i) => <SBall key={i} r0={0.1} p={[Math.sin(i * 1.1) * 0.14, 0.4 + (i % 3) * 0.1, Math.cos(i * 1.1) * 0.14]} c="#3f9a4a" r={0.9} />)}
      </group>
      <AOstrip p={[0, 0.002, -3.1]} s={[26, 0.5]} op={0.0} />
    </group>
  );
};
