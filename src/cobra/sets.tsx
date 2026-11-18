// COBRA_EFFECT sets: STREET, OFFICE, GARAGE (the only three). Real 3D, shaded as clean toon with painted shadow cuts (`tm`), warm sunny India-like day.
// Coordinates: metres, x right, y up, z toward the camera; characters stand near z = 0 / -2, cameras look toward -z.
// Everything is built once per mount (useMemo), geometry is unit geometry + scale, repeated parts are instanced (BoxField).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex} from '../kit/kit';
import {Sky} from '../kit/kit';
import {B, BoxField, BoxInst, C, Cy, Line3, Pl, Sp, onString} from './common';

const WALLS = ['#E8B27A', '#F0C48E', '#DDA066', '#E9A678', '#F2D3A0'];
const CREAM = '#F7E7C6', GLASS = '#4C7F9E';

// ---------------------------------------------------------------- lights
export const Lights: React.FC<{mode: 'street' | 'office' | 'garage'; ss?: number}> = ({mode, ss = 2048}) => {
  const cfg = {
    street: {hemi: ['#CFEFFA', C.shade, 2.1], sun: ['#FFE2B8', 2.0, [-5, 9, 7]], ext: 16},
    office: {hemi: ['#FFF1D2', C.shade, 2.0], sun: ['#FFE6BE', 1.5, [-3, 5.5, 4]], ext: 7},
    garage: {hemi: ['#FFF0D2', C.shade, 2.0], sun: ['#FFE6BE', 1.5, [-2, 5.5, 4]], ext: 9},
  }[mode] as {hemi: [string, string, number]; sun: [string, number, V3]; ext: number};
  return (
    <>
      <hemisphereLight args={cfg.hemi} />
      <directionalLight color={cfg.sun[0]} intensity={cfg.sun[1]} position={cfg.sun[2]} castShadow shadow-mapSize={[ss, ss]} shadow-camera-left={-cfg.ext} shadow-camera-right={cfg.ext} shadow-camera-top={cfg.ext} shadow-camera-bottom={-cfg.ext} shadow-camera-near={1} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.02} />
    </>
  );
};

// ---------------------------------------------------------------- painted sky: clouds at different depths + sun glow (planes behind the set, seen when the camera looks toward -z)
const paintCloud = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const puffs: [number, number, number][] = [[0.18, 0.62, 0.16], [0.34, 0.5, 0.21], [0.52, 0.42, 0.25], [0.7, 0.52, 0.2], [0.84, 0.64, 0.14], [0.5, 0.66, 0.2]];
  for (const [x, y, r] of puffs) { const g = c.createRadialGradient(x * w, y * h - r * h * 0.15, 0, x * w, y * h, r * w); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x * w, y * h, r * w, 0, 7); c.fill(); }
  c.globalCompositeOperation = 'source-atop'; const lg = c.createLinearGradient(0, h * 0.3, 0, h * 0.85); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(168,208,232,0.75)'); c.fillStyle = lg; c.fillRect(0, 0, w, h); // cool painted underside
  c.globalCompositeOperation = 'source-over'; for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + hash(i, 4) * 0.35})`; const a = hash(i, 1) * 6.28, rr = 0.2 + hash(i, 2) * 0.12; c.beginPath(); c.ellipse(w * (0.5 + Math.cos(a) * 0.4 * (0.6 + rr)), h * (0.55 + Math.sin(a) * 0.25 * (0.6 + rr)), 6 + hash(i, 3) * 10, 3 + hash(i, 5) * 5, a, 0, 7); c.fill(); } // brush-edge flecks
};
const paintGlow = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,248,214,1)'); g.addColorStop(0.18, 'rgba(255,240,190,0.7)'); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
export const Clouds: React.FC = () => {
  const tex = useMemo(() => makeTex(512, 256, paintCloud), []), glow = useMemo(() => makeTex(256, 256, paintGlow), []);
  const list: [number, number, number, number][] = [[-14, 20, -70, 34], [12, 30, -95, 46], [-4, 42, -120, 54], [26, 17, -62, 26], [-30, 36, -105, 40], [4, 12, -80, 22]];
  return (<group><Pl p={[-8, 34, -135]} w={70} h={70} map={glow} basic recv={false} />{list.map(([x, y, z, w], i) => <Pl key={i} p={[x, y, z]} w={w} h={w / 2} map={tex} basic recv={false} />)}</group>);
};
const wallTex = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 140; i++) { const l = hash(i, 1) > 0.5; c.strokeStyle = l ? 'rgba(255,255,255,0.5)' : 'rgba(150,100,70,0.10)'; c.lineWidth = 3 + hash(i, 2) * 8; c.lineCap = 'round'; const x = hash(i, 3) * w, y = hash(i, 4) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20 + hash(i, 5) * 50, y + (hash(i, 6) - 0.5) * 14); c.stroke(); } }; // soft paint strokes on walls (clean otherwise)

// ---------------------------------------------------------------- STREET
interface StreetData {bodies: BoxInst[]; roofs: BoxInst[]; trims: BoxInst[]; glass: BoxInst[]; doors: BoxInst[]; awnings: {p: V3; w: number; side: number; c: string}[]; lamps: V3[]; plants: V3[]; rooftop: BoxInst[]; crates: BoxInst[]; banners: BoxInst[]}
function buildStreet(): StreetData {
  const d: StreetData = {bodies: [], roofs: [], trims: [], glass: [], doors: [], awnings: [], lamps: [], plants: [], rooftop: [], crates: [], banners: []};
  for (const side of [-1, 1]) {
    let z = 14, i = 0;
    while (z > -34) {
      const k = i + (side > 0 ? 40 : 0), dz = 2.7 + hash(k, 3) * 1.6, h = 3.5 + hash(k, 7) * 2.2, dx = 3.6 + hash(k, 5) * 1.2;
      if (z - dz < -6.4 && z > -9.9) { z = -9.9; continue; } // the cross street (z -9.9 .. -6.4) stays open
      const cz = z - dz / 2, cx = side * (2.9 + dx / 2), col = WALLS[Math.floor(hash(k, 9) * WALLS.length) % WALLS.length];
      d.bodies.push({p: [cx, h / 2, cz], s: [dx, h, dz - 0.06], c: col});
      d.roofs.push({p: [cx, h + 0.12, cz], s: [dx + 0.3, 0.24, dz + 0.1], c: C.terra});
      d.trims.push({p: [side * 2.86, 0.55, cz], s: [0.1, 1.1, dz - 0.04], c: '#C98A55'}); // painted plinth
      d.trims.push({p: [side * 2.86, 3.02, cz], s: [0.12, 0.1, dz - 0.04], c: CREAM}); // floor ledge
      const nWin = Math.max(1, Math.floor((dz - 0.5) / 1.2));
      for (let r = 0; r < (h > 4.6 ? 2 : 1); r++) for (let w = 0; w < nWin; w++) {
        const wz = cz - dz / 2 + 0.25 + (dz - 0.5) * ((w + 0.5) / nWin), wy = 2.0 + r * 1.55 + (r === 0 ? 0.35 : 0.1);
        d.trims.push({p: [side * 2.86, wy, wz], s: [0.1, 1.0, 0.72], c: CREAM});
        d.glass.push({p: [side * 2.82, wy, wz], s: [0.1, 0.82, 0.56], c: GLASS});
        if (hash(k + r, w + 2) > 0.45) { d.doors.push({p: [side * 2.8, wy, wz - 0.46], s: [0.08, 0.96, 0.2], c: hash(k, w) > 0.5 ? C.terra : '#3E8E7E'}); d.doors.push({p: [side * 2.8, wy, wz + 0.46], s: [0.08, 0.96, 0.2], c: hash(k, w) > 0.5 ? C.terra : '#3E8E7E'}); }
      }
      d.doors.push({p: [side * 2.84, 1.05, cz + dz * 0.25], s: [0.1, 2.1, 1.0], c: hash(k, 12) > 0.5 ? '#3E8E7E' : '#7A4A2A'}); // front door
      if (hash(k, 14) > 0.4) d.awnings.push({p: [side * 2.5, 2.35, cz - dz * 0.2], w: Math.min(2.2, dz - 0.4), side, c: hash(k, 15) > 0.5 ? C.terra : '#E9B23A'});
      if (h > 4.6) { d.trims.push({p: [side * 2.62, 3.12, cz], s: [0.5, 0.08, dz * 0.7], c: '#3E4A52'}, {p: [side * 2.4, 3.45, cz], s: [0.05, 0.7, dz * 0.7], c: '#3E4A52'}, {p: [side * 2.62, 3.45, cz - dz * 0.33], s: [0.5, 0.7, 0.05], c: '#3E4A52'}, {p: [side * 2.62, 3.45, cz + dz * 0.33], s: [0.5, 0.7, 0.05], c: '#3E4A52'}); } // balcony: slab + rails
      d.rooftop.push({p: [cx + (hash(k, 20) - 0.5) * dx * 0.5, h + 0.55, cz], s: [0.7, 0.6, 0.7], c: hash(k, 21) > 0.5 ? '#D8D2C4' : '#B5B0A6'}, {p: [cx + (hash(k, 22) - 0.5) * dx * 0.6, h + 0.9, cz + 0.3], s: [0.5, 1.3, 0.5], c: '#8A7A68'}); // AC box / water tank, chimney
      if (hash(k, 23) > 0.5) d.banners.push({p: [side * 2.84, 3.3, cz - dz * 0.1], s: [0.06, 1.1, 0.42], c: hash(k, 24) > 0.5 ? '#E9B23A' : '#3E8E7E'}, {p: [side * 2.8, 3.4, cz - dz * 0.1], s: [0.05, 0.22, 0.22], c: '#FFF3C8', rz: Math.PI / 4}); // wordless banner with a diamond emblem
      if (hash(k, 25) > 0.45) { for (let q = 0; q < 3; q++) d.crates.push({p: [side * 2.55, 0.3 + (q > 1 ? 0.5 : 0), cz + dz * 0.45 + (q % 2) * 0.55], s: [0.5, 0.5, 0.5], c: q % 2 ? '#B9824A' : '#C99A5B', ry: hash(k, q) }); }
      if (hash(k, 16) > 0.55) d.plants.push([side * 2.5, 0.1, cz + dz * 0.4]);
      z -= dz + 0.08; i++;
    }
  }
  for (let zz = 10; zz > -30; zz -= 8) { d.lamps.push([-2.35, 0, zz], [2.35, 0, zz - 4]); }
  return d;
}
const paintRoad = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#B8916A'); g.addColorStop(0.2, C.road); g.addColorStop(0.5, '#D3AE88'); g.addColorStop(0.8, C.road); g.addColorStop(1, '#B8916A');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 380; i++) { c.fillStyle = `rgba(143,90,60,${0.05 + hash(i, 1) * 0.08})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 3 + hash(i, 4) * 12, 2 + hash(i, 5) * 6, hash(i, 6) * 3, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(35,26,40,0.55)'; c.lineWidth = 2.2; c.lineCap = 'round'; // a few occasional ink cracks
  for (let i = 0; i < 7; i++) { let x = hash(i, 21) * w, y = hash(i, 22) * h; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (hash(i, 30 + q) - 0.5) * 60; y += 20 + hash(i, 40 + q) * 40; c.lineTo(x, y); } c.stroke(); }
};
/** FAR FIELD (kit default 2026-11-16: every set has one): the city keeps going in all directions, a skyline and hills on the horizon, ground to the horizon, roofs with props. */
const roofTex = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); for (let r = 0; r < 12; r++) { c.fillStyle = r % 2 ? 'rgba(120,50,30,0.16)' : 'rgba(255,240,220,0.18)'; c.fillRect(0, (r * h) / 12, w, h / 12); c.strokeStyle = 'rgba(100,40,25,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, (r * h) / 12); c.lineTo(w, (r * h) / 12); c.stroke(); for (let q = 0; q < 14; q++) { c.beginPath(); c.moveTo(((q + (r % 2) * 0.5) * w) / 14, (r * h) / 12); c.lineTo(((q + (r % 2) * 0.5) * w) / 14, ((r + 1) * h) / 12); c.stroke(); } } };
function farCity(): {bodies: BoxInst[]; roofs: BoxInst[]; props: BoxInst[]; domes: {p: V3; r: number; c: string}[]; trees: V3[]} {
  const o = {bodies: [] as BoxInst[], roofs: [] as BoxInst[], props: [] as BoxInst[], domes: [] as {p: V3; r: number; c: string}[], trees: [] as V3[]}, HAZE = new THREE.Color('#CFE3EA'), col = new THREE.Color();
  let n = 0;
  for (const side of [-1, 1]) for (let ix = 0; ix < 13; ix++) for (let iz = 0; iz < 34; iz++) {
    const gx = ix % 4 === 3, gz = iz % 5 === 4; if (gx || gz) continue; // side streets and avenues
    const k = n++, x = side * (9 + ix * 6 + hash(k, 1) * 1.5), z = 32 - iz * 6 - hash(k, 2) * 1.5, dist = Math.hypot(x, z + 10), hz = 3.5 + hash(k, 3) * 5 + (dist > 60 ? hash(k, 4) * 9 : 0), w = 3.8 + hash(k, 5) * 1.8, d = 3.8 + hash(k, 6) * 1.6, haze = Math.min(0.7, dist / 190);
    col.set(WALLS[Math.floor(hash(k, 7) * WALLS.length) % WALLS.length]).lerp(HAZE, haze); const wall = '#' + col.getHexString(); col.set(hash(k, 8) > 0.35 ? C.terra : '#C9A06C').lerp(HAZE, haze); const roof = '#' + col.getHexString();
    o.bodies.push({p: [x, hz / 2, z], s: [w, hz, d], c: wall}); o.roofs.push({p: [x, hz + 0.12, z], s: [w + 0.3, 0.24, d + 0.3], c: roof});
    if (hash(k, 9) > 0.35) o.props.push({p: [x + 0.8, hz + 0.65, z], s: [0.9, 0.9, 0.9], c: '#D8D2C4'}); // water tank / AC
    if (hash(k, 10) > 0.6) o.props.push({p: [x - 0.9, hz + 1.2, z + 0.5], s: [0.06, 2.0, 0.06], c: '#3E4A52'}); // antenna
    if (hash(k, 11) > 0.7) o.props.push({p: [x, hz + 0.45, z - 1.0], s: [1.4, 0.4, 0.5], c: '#4FA24A'}); // roof garden
    if (hash(k, 12) > 0.86 && dist < 120) o.domes.push({p: [x, hz + 0.24, z], r: Math.min(w, d) * 0.42, c: hash(k, 13) > 0.5 ? '#F2E9D8' : '#3E8E7E'});
    if (hash(k, 14) > 0.88 && dist < 70) o.trees.push([x + 3.2, 0, z + 3]);
  }
  for (let i = 0; i < 40; i++) { const a = -Math.PI * (0.05 + 0.9 * (i / 40)) + Math.PI * 0.0, dist = 110 + hash(i, 20) * 120, hz = 18 + hash(i, 21) * 30; col.set('#B9C9D0').lerp(HAZE, 0.5); o.bodies.push({p: [Math.cos(a + Math.PI) * dist, hz / 2, -10 + Math.sin(a) * dist * 0.9 - 100], s: [10 + hash(i, 22) * 14, hz, 10 + hash(i, 23) * 12], c: '#' + col.getHexString()}); } // skyline towers on the horizon
  return o;
}
const Far: React.FC = () => {
  const c = useMemo(farCity, []), roof = useMemo(() => makeTex(128, 128, roofTex), []);
  return (
    <group>
      <BoxField items={c.bodies} cast={false} /> <BoxField items={c.roofs} cast={false} map={roof} /> <BoxField items={c.props} cast={false} />
      {c.domes.map((d, i) => <Sp key={i} p={d.p} s={[d.r, d.r * 0.8, d.r]} c={d.c} cast={false} ink={0.03} />)}
      {c.trees.map((t, i) => <group key={i} position={t}><Cy p={[0, 1.2, 0]} r={0.2} h={2.4} c="#7A4A2A" cast={false} /><Sp p={[0, 3.0, 0]} s={[1.5, 1.2, 1.5]} c="#4FA24A" cast={false} /><Sp p={[0.8, 2.6, 0.3]} s={[1.0, 0.9, 1.0]} c="#5DB65A" cast={false} /></group>)}
      {[[-260, -300, 190, 40], [-60, -330, 230, 55], [190, -310, 210, 45], [330, -250, 150, 38], [-380, -180, 140, 35]].map(([x, z, w, h], i) => <Sp key={i} p={[x, -h * 0.35, z]} s={[w, h, w * 0.5]} c={i % 2 ? '#8FB5A0' : '#9CBFB0'} basic cast={false} />)}
      <Pl p={[0, -0.02, -60]} w={900} h={900} c="#B98E65" rot={[-Math.PI / 2, 0, 0]} recv={false} />
    </group>
  );
};
export const Street: React.FC = () => {
  const d = useMemo(buildStreet, []);
  const road = useMemo(() => makeTex(256, 1024, paintRoad), []);
  const wall = useMemo(() => makeTex(256, 256, wallTex), []), roofT = useMemo(() => makeTex(128, 128, roofTex), []);
  const STR: {a: V3; b: V3; sag: number; kind: 'flag' | 'laundry'}[] = [{a: [-2.84, 3.35, -3.6], b: [2.84, 3.25, -3.6], sag: 0.55, kind: 'flag'}, {a: [-2.84, 3.1, -5.9], b: [2.84, 3.2, -5.9], sag: 0.6, kind: 'laundry'}, {a: [-2.84, 3.4, -13], b: [2.84, 3.3, -13], sag: 0.6, kind: 'flag'}];
  const cloth = useMemo<BoxInst[]>(() => {
    const out: BoxInst[] = [], cols = ['#E8553D', '#F5C84C', '#3FA7C9', '#F4EFE0', '#8E6BBF'];
    for (const st of STR) { const n = st.kind === 'flag' ? 11 : 6; for (let i = 0; i < n; i++) { const t = (i + 0.7) / (n + 0.4), q = onString(st.a, st.b, st.sag, t), h = st.kind === 'flag' ? 0.36 : 0.62; out.push({p: [q[0], q[1] - h / 2 - 0.01, q[2]], s: [st.kind === 'flag' ? 0.3 : 0.42, h, 0.02], c: st.kind === 'flag' ? cols[i % cols.length] : (i % 2 ? '#F4EFE0' : cols[(i * 2) % cols.length]), rz: (t - 0.5) * -0.35 }); } }
    return out;
  }, []);
  return (
    <group>
      <Sky top={C.skyTop} bottom={C.skyBot} r={160} /><Clouds />
      <Pl p={[0, 0, -10]} w={5.6} h={90} c="#fff" map={road} rot={[-Math.PI / 2, 0, 0]} />
      <Far />
      <Pl p={[0, 0.001, -8.15]} w={140} h={3.3} c={C.road} rot={[-Math.PI / 2, 0, 0]} /> {/* cross street */}
      <B p={[-2.45, 0.05, -10]} s={[0.9, 0.1, 90]} c="#D8B48A" recv /> <B p={[2.45, 0.05, -10]} s={[0.9, 0.1, 90]} c="#D8B48A" recv />
      <BoxField items={d.bodies} map={wall} /> <BoxField items={d.roofs} map={roofT} /> <BoxField items={d.rooftop} /> <BoxField items={d.crates} /> <BoxField items={d.banners} cast={false} />
      {STR.map((st, i) => <Line3 key={i} a={st.a} b={st.b} sag={st.sag} />)}
      {/* a market cart on the left sidewalk */}
      <group position={[-2.4, 0, -4.9]}><B p={[0, 0.55, 0]} s={[0.8, 0.3, 1.5]} c="#9A5532" ink={0.012} /><B p={[0, 0.78, -0.2]} s={[0.7, 0.2, 0.9]} c="#B9824A" /><Cy p={[0.45, 0.3, 0.35]} r={0.3} h={0.08} c="#6B4A32" rot={[0, 0, Math.PI / 2]} ink={0.01} /><Cy p={[-0.45, 0.3, 0.35]} r={0.3} h={0.08} c="#6B4A32" rot={[0, 0, Math.PI / 2]} ink={0.01} /><B p={[0, 0.7, 1.1]} s={[0.05, 0.05, 0.9]} c="#6B4A32" /><Sp p={[-0.15, 1.0, -0.4]} s={[0.22, 0.2, 0.2]} c="#E8553D" ink={0.01} /><Sp p={[0.18, 1.0, -0.1]} s={[0.2, 0.18, 0.2]} c="#F5C84C" ink={0.01} /></group>
      <BoxField items={d.bodies.slice(0, 0)} /> <BoxField items={d.trims} cast={false} /> <BoxField items={d.glass} cast={false} basic /> <BoxField items={d.doors} cast={false} /> <BoxField items={cloth} cast={false} />
      {d.awnings.map((a, i) => ( // sloped striped awning: terracotta / cream stripes over a shop front
        <group key={i} position={a.p} rotation={[0, 0, a.side * 0.35]}>
          {Array.from({length: 4}, (_, s) => <B key={s} p={[0, 0, (s - 1.5) * (a.w / 4)]} s={[0.9, 0.06, a.w / 4]} c={s % 2 ? CREAM : a.c} cast ink={0.012} />)}
        </group>
      ))}
      {d.lamps.map((l, i) => (<group key={i} position={l}><Cy p={[0, 1.7, 0]} r={0.06} h={3.4} c="#3E4A52" cast ink={0.012} /><Sp p={[0, 3.5, 0]} s={[0.2, 0.2, 0.2]} c="#FFF3C8" basic cast={false} /></group>))}
      {d.plants.map((q, i) => (<group key={i} position={q}><Cy p={[0, 0.2, 0]} r={0.2} h={0.4} c={C.terra} cast ink={0.012} /><Sp p={[0, 0.65, 0]} s={[0.3, 0.32, 0.3]} c="#4FA24A" cast ink={0.012} /></group>))}
      {/* end of the street: a big arch building + a banyan tree */}
      <B p={[0, 3.5, -36]} s={[14, 7, 3]} c="#E9A678" /> <B p={[0, 1.6, -34.4]} s={[3.2, 3.2, 0.2]} c="#2B1D1A" cast={false} /> <B p={[0, 7.15, -36]} s={[14.4, 0.3, 3.3]} c={C.terra} />
      <group position={[-5.5, 0, -24]}><Cy p={[0, 1.4, 0]} r={0.3} h={2.8} c="#7A4A2A" ink={0.02} /><Sp p={[0, 3.3, 0]} s={[1.5, 1.1, 1.5]} c="#4FA24A" ink={0.03} /><Sp p={[0.9, 2.9, 0.3]} s={[1.0, 0.8, 1.0]} c="#5DB65A" ink={0.03} /></group>
    </group>
  );
};

// ---------------------------------------------------------------- OFFICE
const paintFloor = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#A9663F'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(${hash(i, 1) > 0.5 ? '255,214,160' : '70,32,18'},${0.05 + hash(i, 2) * 0.08})`; c.fillRect(0, (i * h) / 12, w, h / 12); c.fillStyle = 'rgba(35,26,40,0.5)'; c.fillRect(0, (i * h) / 12, w, 2.5); }
  for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(35,26,40,0.5)'; c.fillRect(hash(i, 5) * w, Math.floor(hash(i, 6) * 12) * (h / 12), 2.5, h / 12); }
};
const paintRug = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#9C2F2A'; c.fillRect(0, 0, w, h); c.strokeStyle = C.gold; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28); c.strokeStyle = '#F2D9A0'; c.lineWidth = 4; c.strokeRect(34, 34, w - 68, h - 68);
  c.fillStyle = '#C9503F'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(w / 2, h * (0.2 + i * 0.15)); c.lineTo(w * 0.7, h * (0.27 + i * 0.15)); c.lineTo(w / 2, h * (0.34 + i * 0.15)); c.lineTo(w * 0.3, h * (0.27 + i * 0.15)); c.closePath(); c.fill(); }
};
/** The snake drawing on the wall: cream paper, lime snake + a gold coin, ink outline, NO words. torn = 'left' | 'right' draws one torn half (ragged edge). */
export const paintPoster = (c: CanvasRenderingContext2D, w: number, h: number, half?: 'left' | 'right') => {
  if (half) { c.beginPath(); const x0 = half === 'left' ? 0 : w / 2; c.moveTo(x0, 0); const xs = half === 'left' ? [w * 0.5, w * 0.56, w * 0.46, w * 0.55, w * 0.48, w * 0.54] : [w * 0.5, w * 0.44, w * 0.54, w * 0.45, w * 0.52, w * 0.46]; if (half === 'left') { c.lineTo(0, 0); c.lineTo(xs[0], 0); xs.slice(1).forEach((x, i) => c.lineTo(x, ((i + 1) / 5) * h)); c.lineTo(0, h); } else { c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(xs[5], h); for (let i = 4; i >= 0; i--) c.lineTo(xs[i], (i / 5) * h); } c.closePath(); c.clip(); }
  c.fillStyle = '#F6E9C8'; c.fillRect(0, 0, w, h); c.strokeStyle = C.ink; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = w * 0.115; c.beginPath(); c.moveTo(w * 0.2, h * 0.28); c.bezierCurveTo(w * 0.85, h * 0.2, w * 0.1, h * 0.55, w * 0.78, h * 0.62); c.stroke();
  c.strokeStyle = C.lime; c.lineWidth = w * 0.085; c.stroke();
  c.fillStyle = C.lime; c.strokeStyle = C.ink; c.lineWidth = 8; c.beginPath(); c.ellipse(w * 0.2, h * 0.28, w * 0.1, w * 0.075, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = C.ink; for (const dx of [-0.035, 0.035]) { c.beginPath(); c.arc(w * (0.2 + dx), h * 0.265, 7, 0, 7); c.fill(); }
  c.fillStyle = C.gold; c.beginPath(); c.arc(w * 0.5, h * 0.82, w * 0.14, 0, 7); c.fill(); c.lineWidth = 9; c.stroke(); c.strokeStyle = '#E0A91C'; c.lineWidth = 5; c.beginPath(); c.arc(w * 0.5, h * 0.82, w * 0.09, 0, 7); c.stroke();
};
export const Poster: React.FC<{p: V3; w: number; h: number; half?: 'left' | 'right'; rot?: [number, number, number]}> = ({p, w, h, half, rot}) => {
  const tex = useMemo(() => makeTex(384, 512, (c, ww, hh) => paintPoster(c, ww, hh, half)), [half]);
  return <group position={p} rotation={rot ?? [0, 0, 0]}><B p={[0, 0, -0.012]} s={[w * 0.97, h * 0.97, 0.02]} c="#E8DCB8" cast={false} /><Pl p={[0, 0, 0]} w={w} h={h} map={tex} basic recv={false} /></group>; // a real board with thickness (hero object), not a flat card
};
export const Office: React.FC<{poster?: boolean; fan?: boolean}> = ({poster = true, fan = true}) => {
  const floor = useMemo(() => makeTex(512, 512, paintFloor), []), rug = useMemo(() => makeTex(256, 384, paintRug), []);
  const slats = useMemo<BoxInst[]>(() => Array.from({length: 13}, (_, i) => ({p: [-2.3, 1.2 + i * 0.14, -3.08], s: [1.5, 0.07, 0.04], c: '#F4EFE0'})), []);
  const sunset = useMemo(() => makeTex(256, 160, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5EC8E8'); g.addColorStop(0.6, '#FFD27A'); g.addColorStop(1, '#D9663F'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#8F5A3C'; c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.3, h * 0.62); c.lineTo(w * 0.6, h * 0.85); c.lineTo(w * 0.85, h * 0.6); c.lineTo(w, h); c.fill(); }), []);
  const books = useMemo<BoxInst[]>(() => { const cols = ['#9C2F2A', '#2F5F7F', '#E0B03A', '#3E8E7E', '#7A4A2A', '#F4EFE0']; const o: BoxInst[] = []; for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) o.push({p: [2.45 + i * 0.075 - 0.45, 0.75 + r * 0.55 + 0.19, -2.95], s: [0.06, 0.34 + hash(i, r) * 0.08, 0.26], c: cols[(i + r * 2) % cols.length]}); return o; }, []);
  return (
    <group>
      <Pl p={[0, 0, 1.4]} w={9} h={10} c="#fff" map={floor} rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[0, 3.4, 1.4]} w={9} h={10} c="#F4E9CF" rot={[Math.PI / 2, 0, 0]} recv={false} />
      <B p={[0, 1.7, -3.25]} s={[9, 3.4, 0.2]} c={C.offWall} cast={false} /> <B p={[-4.1, 1.7, 1.4]} s={[0.2, 3.4, 10]} c={C.offWall} cast={false} /> <B p={[4.1, 1.7, 1.4]} s={[0.2, 3.4, 10]} c={C.offWall} cast={false} />
      <B p={[0, 0.55, -3.1]} s={[8, 1.1, 0.1]} c={C.wood} cast={false} ink={0.01} /> <B p={[0, 1.13, -3.06]} s={[8, 0.07, 0.16]} c="#F7E7C6" cast={false} /> {/* wainscot + chair rail */}
      <B p={[-3.98, 0.55, 1.4]} s={[0.1, 1.1, 9.6]} c={C.wood} cast={false} /> <B p={[3.98, 0.55, 1.4]} s={[0.1, 1.1, 9.6]} c={C.wood} cast={false} />
      {/* window with blinds (bright sky behind) */}
      <B p={[-2.3, 1.9, -3.12]} s={[1.7, 1.9, 0.06]} c="#BFEAF5" basic cast={false} /> <BoxField items={slats} cast={false} />
      <B p={[-2.3, 2.9, -3.08]} s={[1.9, 0.12, 0.1]} c={CREAM} cast={false} ink={0.01} /> <B p={[-2.3, 0.95, -3.08]} s={[1.9, 0.12, 0.14]} c={CREAM} cast={false} ink={0.01} />
      {poster && <><B p={[0.8, 1.95, -3.12]} s={[1.14, 1.48, 0.06]} c="#7A4A2A" cast={false} ink={0.012} /><Poster p={[0.8, 1.95, -3.08]} w={0.98} h={1.32} /></>}
      {/* bookshelf, ceiling fan */}
      <B p={[2.95, 1.45, -2.98]} s={[1.5, 2.6, 0.34]} c="#7A4A2A" cast={false} ink={0.012} /> <BoxField items={books} cast={false} />
      {fan && <>      <Cy p={[0, 3.15, -0.6]} r={0.03} h={0.5} c="#3E4A52" cast={false} /><Cy p={[0, 2.9, -0.6]} r={0.14} h={0.12} c="#3E4A52" cast={false} />
      {[0, 1, 2, 3].map((i) => <B key={i} p={[Math.cos((i * Math.PI) / 2) * 0.62, 2.9, -0.6 + Math.sin((i * Math.PI) / 2) * 0.62]} s={[i % 2 ? 0.2 : 1.1, 0.03, i % 2 ? 1.1 : 0.2]} c="#8A5A3A" cast={false} />)}</>}
      {/* rug */}
      <Pl p={[0, 0.01, 0.2]} w={3.2} h={3.4} map={rug} rot={[-Math.PI / 2, 0, 0]} />
      {/* curtains with tie-backs, wall frame (abstract sunset, no map), floor lamp */}
      {[-1, 1].map((sg) => <group key={sg}><B p={[-2.3 + sg * 1.05, 1.85, -3.0]} s={[0.42, 2.2, 0.12]} c="#9C2F2A" ink={0.01} cast={false} /><B p={[-2.3 + sg * 0.85, 1.85, -2.95]} s={[0.06, 2.2, 0.1]} c="#7A1F1C" cast={false} /><B p={[-2.3 + sg * 0.92, 1.45, -2.9]} s={[0.5, 0.06, 0.08]} c={C.gold} basic cast={false} /></group>)}
      <B p={[-2.3, 3.0, -3.0]} s={[2.9, 0.06, 0.06]} c={C.gold} basic cast={false} />
      <B p={[-0.2, 2.45, -3.12]} s={[0.9, 0.6, 0.05]} c="#7A4A2A" cast={false} ink={0.01} /><Pl p={[-0.2, 2.45, -3.085]} w={0.78} h={0.48} map={sunset} basic recv={false} />
      <Cy p={[-3.5, 0.9, -2.4]} r={0.025} h={1.8} c="#3E4A52" ink={0.006} /><Cy p={[-3.5, 0.03, -2.4]} r={0.2} h={0.06} c="#3E4A52" /><Cy p={[-3.5, 1.85, -2.4]} r={0.2} h={0.3} c="#FFE6A8" basic cast={false} />
      <OfficeFar />
      <Desk />
    </group>
  );
};
/** Office far field: wallpaper stripes, ceiling beams, props on the side walls, so no surface is a flat single colour. */
const OfficeFar: React.FC = () => {
  const items = useMemo(() => {
    const stripes: BoxInst[] = [], beams: BoxInst[] = [], cab: BoxInst[] = [];
    for (let i = 0; i < 14; i++) { stripes.push({p: [-3.7 + i * 0.57, 2.25, -3.06], s: [0.07, 2.2, 0.02], c: '#E8C98A'}); }
    for (let i = 0; i < 12; i++) { stripes.push({p: [-3.9, 2.25, -2.9 + i * 0.75], s: [0.02, 2.2, 0.07], c: '#E8C98A'}); stripes.push({p: [3.9, 2.25, -2.9 + i * 0.75], s: [0.02, 2.2, 0.07], c: '#E8C98A'}); }
    for (let i = 0; i < 7; i++) beams.push({p: [0, 3.28, -2.6 + i * 1.25], s: [8, 0.2, 0.28], c: '#8A5A3A'});
    for (let i = 0; i < 3; i++) cab.push({p: [3.7, 0.55, 1.2 + i * 1.15], s: [0.5, 1.1, 1.0], c: i % 2 ? '#6E8FA8' : '#7C9AAF'});
    return {stripes, beams, cab};
  }, []);
  return (
    <group>
      <BoxField items={items.stripes} cast={false} /> <BoxField items={items.beams} cast={false} /> <BoxField items={items.cab} />
      <B p={[-3.88, 1.1, 0.4]} s={[0.1, 2.2, 1.0]} c="#6B3F22" cast={false} ink={0.01} /><B p={[-3.84, 1.05, 0.65]} s={[0.05, 0.08, 0.08]} c={C.gold} basic cast={false} />
      {[[-3.9, 2.0, 2.0], [-3.9, 1.8, 3.4], [3.9, 2.0, 0.6], [3.9, 1.9, 2.4], [3.9, 2.1, 4.0]].map(([x, y, z], i) => <group key={i}><B p={[x, y, z]} s={[0.06, 0.7, 0.9]} c="#7A4A2A" cast={false} ink={0.008} /><B p={[x + (x < 0 ? 0.04 : -0.04), y, z]} s={[0.02, 0.58, 0.78]} c={['#F2D9A0', '#9CC7B5', '#E8A27A', '#B8C7E8', '#D9663F'][i]} basic cast={false} /></group>)}
      <Cy p={[-3.4, 0.4, 3.0]} r={0.25} h={0.8} c={C.terra} ink={0.012} /><Sp p={[-3.4, 1.2, 3.0]} s={[0.45, 0.5, 0.45]} c="#4FA24A" ink={0.012} /><Cy p={[3.4, 0.4, -2.5]} r={0.25} h={0.8} c={C.terra} ink={0.012} /><Sp p={[3.4, 1.2, -2.5]} s={[0.45, 0.5, 0.45]} c="#5DB65A" ink={0.012} />
      {[-1.6, 1.6].map((x) => <group key={x}><Cy p={[x, 3.0, 0.6]} r={0.008} h={0.8} c="#3E3A36" cast={false} /><Sp p={[x, 2.55, 0.6]} s={[0.16, 0.2, 0.16]} c="#FFE6A8" basic cast={false} /></group>)}
    </group>
  );
};
export const Desk: React.FC = () => (
  <group position={[0, 0, -1.2]}>
    <B p={[0, 0.76, 0]} s={[2.3, 0.08, 1.0]} c={C.wood} ink={0.014} /> <B p={[0, 0.8, 0]} s={[1.9, 0.01, 0.75]} c="#2F5F4A" cast={false} /> {/* blotter */}
    {[-1, 1].map((sg) => (<group key={sg}><B p={[sg * 0.85, 0.36, 0]} s={[0.6, 0.72, 0.9]} c="#9A5532" ink={0.012} />{[0.2, 0.4, 0.6].map((y) => <React.Fragment key={y}><B p={[sg * 0.85, y, 0.46]} s={[0.46, 0.17, 0.02]} c="#B0643A" cast={false} /><B p={[sg * 0.85, y, 0.48]} s={[0.12, 0.025, 0.02]} c={C.gold} basic cast={false} /></React.Fragment>)}</group>))}
    <B p={[0, 0.4, 0.4]} s={[1.1, 0.7, 0.06]} c="#8A4A2A" ink={0.01} /> {/* kneehole panel */}
    <Cy p={[-0.8, 0.9, -0.2]} r={0.07} h={0.04} c="#2F5F4A" ink={0.006} /><Cy p={[-0.8, 1.05, -0.2]} r={0.012} h={0.26} c={C.gold} basic /><Sp p={[-0.8, 1.2, -0.2]} s={[0.15, 0.08, 0.1]} c="#2F7A56" ink={0.008} /> {/* banker lamp */}
    <B p={[0.55, 0.82, -0.1]} s={[0.4, 0.04, 0.3]} c="#F6E9C8" ink={0.006} /><B p={[0.57, 0.86, -0.08]} s={[0.4, 0.04, 0.3]} c="#EFE0B8" /> {/* papers */}
    <Cy p={[-0.35, 0.86, 0.05]} r={0.04} h={0.08} c="#231A28" /> {/* inkwell */}
  </group>
);

// ---------------------------------------------------------------- GARAGE
/** DESIGNED garage floor (flat texture only): poured concrete with expansion joints, hairline cracks, oil stains, tyre marks, a worn darker path toward the door, soft edge shading.
 *  Canvas: x fraction = (x + 4.5) / 9, y fraction = (z + 7.5) / 11 (top = back wall, bottom = the door side). */
const paintConcrete = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  void 0; g.addColorStop(0, '#BFAE92'); g.addColorStop(0.55, '#CDB89A'); g.addColorStop(1, '#C2AD8E'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(143,100,60,${0.03 + hash(i, 1) * 0.05})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 20 + hash(i, 4) * 90, 14 + hash(i, 5) * 50, hash(i, 6) * 3, 0, 7); c.fill(); } // soft mottling
  const path = c.createLinearGradient(w * 0.2, 0, w * 0.8, 0); path.addColorStop(0, 'rgba(90,60,35,0)'); path.addColorStop(0.5, 'rgba(90,60,35,0.22)'); path.addColorStop(1, 'rgba(90,60,35,0)'); c.fillStyle = path; c.fillRect(0, h * 0.35, w, h * 0.65); // worn darker path toward the door
  for (const fx of [0.395, 0.605]) { c.strokeStyle = 'rgba(40,30,25,0.30)'; c.lineWidth = w * 0.014; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * fx, h * 0.28); c.bezierCurveTo(w * (fx + 0.015), h * 0.5, w * (fx - 0.01), h * 0.7, w * fx, h * 0.9); c.stroke(); } // tyre marks
  for (const [fx, fy, r] of [[0.46, 0.62, 0.06], [0.7, 0.4, 0.045], [0.3, 0.8, 0.035]]) { const og = c.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, w * r); og.addColorStop(0, 'rgba(25,20,20,0.5)'); og.addColorStop(1, 'rgba(25,20,20,0)'); c.fillStyle = og; c.fillRect(0, 0, w, h); } // oil stains
  for (let i = 1; i < 4; i++) { const x = (w * i) / 4; c.fillStyle = 'rgba(45,35,28,0.5)'; c.fillRect(x - 2, 0, 4, h); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 2, 0, 2, h); } // expansion joints (columns)
  for (let i = 1; i < 5; i++) { const y = (h * i) / 5; c.fillStyle = 'rgba(45,35,28,0.5)'; c.fillRect(0, y - 2, w, 4); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, y + 2, w, 2); } // expansion joints (rows)
  c.strokeStyle = 'rgba(40,30,25,0.55)'; c.lineWidth = 2; c.lineJoin = 'round'; for (let i = 0; i < 4; i++) { let x = hash(i, 11) * w, y = hash(i, 12) * h * 0.8; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (hash(i, 20 + q) - 0.5) * 70; y += 25 + hash(i, 30 + q) * 45; c.lineTo(x, y); } c.stroke(); } // hairline cracks
  for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${hash(i, 73) > 0.5 ? '255,255,255' : '60,45,30'},${0.08 + hash(i, 74) * 0.14})`; c.fillRect(hash(i, 75) * w, hash(i, 76) * h, 1.5 + hash(i, 77) * 2.5, 1.5 + hash(i, 78) * 2.5); } // aggregate speckle
  c.lineWidth = 3; for (let i = 0; i < 30; i++) { c.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '70,50,30'},0.1)`; c.beginPath(); c.arc(hash(i, 79) * w, hash(i, 80) * h, 40 + hash(i, 81) * 120, hash(i, 82) * 6, hash(i, 82) * 6 + 1.6); c.stroke(); } // trowel sweeps
  const sh = c.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(60,40,25,0.28)'); sh.addColorStop(0.12, 'rgba(60,40,25,0)'); sh.addColorStop(0.88, 'rgba(60,40,25,0)'); sh.addColorStop(1, 'rgba(60,40,25,0.28)'); c.fillStyle = sh; c.fillRect(0, 0, w, h); // soft painted edge shadow
};
/** DESIGNED apron in front of the garage (flat): concrete slabs with joints, a flush paver strip at the threshold, tyre marks and a worn path from the door, oil, cracks, blending into the road. Canvas y = (z - 2) / 7, x = (x + 5) / 10. */
const paintApron = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#C9B692'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { c.fillStyle = `rgba(${hash(r * 4 + q, 71) > 0.5 ? '255,245,225' : '90,65,40'},${0.06 + hash(r * 4 + q, 72) * 0.1})`; c.fillRect((q * w) / 4, h * 0.14 + (r * h * 0.86) / 4, w / 4, (h * 0.86) / 4); } // every slab has its own tone
  for (let i = 0; i < 3500; i++) { c.fillStyle = `rgba(${hash(i, 73) > 0.5 ? '255,255,255' : '60,45,30'},${0.08 + hash(i, 74) * 0.14})`; c.fillRect(hash(i, 75) * w, hash(i, 76) * h, 1.5 + hash(i, 77) * 2.5, 1.5 + hash(i, 78) * 2.5); } // aggregate speckle
  c.lineWidth = 3; for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '70,50,30'},0.12)`; c.beginPath(); c.arc(hash(i, 79) * w, hash(i, 80) * h, 40 + hash(i, 81) * 110, hash(i, 82) * 6, hash(i, 82) * 6 + 1.6); c.stroke(); } // trowel sweeps
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(143,100,60,${0.03 + hash(i, 1) * 0.05})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 20 + hash(i, 4) * 90, 14 + hash(i, 5) * 50, hash(i, 6) * 3, 0, 7); c.fill(); }
  const wp = c.createLinearGradient(w * 0.25, 0, w * 0.75, 0); wp.addColorStop(0, 'rgba(90,60,35,0)'); wp.addColorStop(0.5, 'rgba(90,60,35,0.25)'); wp.addColorStop(1, 'rgba(90,60,35,0)'); c.fillStyle = wp; c.fillRect(0, 0, w, h * 0.8); // worn path from the door
  for (const fx of [0.4, 0.6]) { c.strokeStyle = 'rgba(40,30,25,0.32)'; c.lineWidth = w * 0.012; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * fx, 0); c.bezierCurveTo(w * (fx - 0.02), h * 0.3, w * (fx + 0.03), h * 0.5, w * (fx + 0.06), h * 0.78); c.stroke(); }
  for (const [fx, fy, r] of [[0.47, 0.35, 0.06], [0.72, 0.55, 0.04]]) { const og = c.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, w * r); og.addColorStop(0, 'rgba(25,20,20,0.5)'); og.addColorStop(1, 'rgba(25,20,20,0)'); c.fillStyle = og; c.fillRect(0, 0, w, h); }
  for (let i = 1; i < 4; i++) { const x = (w * i) / 4; c.fillStyle = 'rgba(45,35,28,0.5)'; c.fillRect(x - 2, 0, 4, h); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 2, 0, 2, h); }
  for (let i = 1; i < 4; i++) { const y = h * 0.14 + ((h * 0.86) * i) / 4; c.fillStyle = 'rgba(45,35,28,0.5)'; c.fillRect(0, y - 2, w, 4); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, y + 2, w, 2); }
  const ph = h * 0.1; for (let r = 0; r < 3; r++) for (let q = 0; q < 26; q++) { const x = ((q + (r % 2) * 0.5) * w) / 24, y = (r * ph) / 3; c.fillStyle = ['#A89576', '#B7A483', '#9C8A6C', '#BEAC8C'][(q + r * 2) % 4]; c.fillRect(x + 1.5, y + 1.5, w / 24 - 3, ph / 3 - 3); } // paver strip, set flush at the threshold
  c.fillStyle = 'rgba(40,30,25,0.6)'; c.fillRect(0, ph - 3, w, 4);
  c.strokeStyle = 'rgba(40,30,25,0.55)'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { let x = hash(i, 41) * w, y = ph + hash(i, 42) * h * 0.5; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (hash(i, 50 + q) - 0.5) * 60; y += 20 + hash(i, 60 + q) * 40; c.lineTo(x, y); } c.stroke(); }
  const fade = c.createLinearGradient(0, h * 0.78, 0, h); fade.addColorStop(0, 'rgba(201,162,126,0)'); fade.addColorStop(1, 'rgba(201,162,126,1)'); c.fillStyle = fade; c.fillRect(0, h * 0.78, w, h * 0.22); // blends into the road
};
/** Shelf unit: posts + n levels (planks), width w. Boxes are added by the caller through BoxField. */
const Shelf: React.FC<{p: V3; w: number; levels?: number; ry?: number}> = ({p, w, levels = 3, ry = 0}) => (
  <group position={p} rotation={[0, ry, 0]}>
    {[-1, 1].map((sg) => <B key={sg} p={[sg * (w / 2 - 0.04), 1.1, 0]} s={[0.08, 2.2, 0.5]} c="#6E8FA8" cast={false} ink={0.008} />)}
    {Array.from({length: levels}, (_, i) => <B key={i} p={[0, 0.25 + i * 0.75, 0]} s={[w, 0.06, 0.5]} c="#B0643A" cast={false} ink={0.008} />)}
  </group>
);
const paintDoor = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#86A6BC'); g.addColorStop(1, '#5C7A92'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) { const y = (r * h) / 4; c.fillStyle = 'rgba(20,30,45,0.55)'; c.fillRect(0, y, w, 5); c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(0, y + 6, w, 3); for (let q = 0; q < 9; q++) { c.fillStyle = 'rgba(20,30,45,0.35)'; c.beginPath(); c.arc(((q + 0.5) * w) / 9, y + h / 8, 4, 0, 7); c.fill(); } }
  for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(${hash(i, 1) > 0.5 ? '90,60,40' : '255,255,255'},${0.06 + hash(i, 2) * 0.1})`; c.lineWidth = 2 + hash(i, 3) * 5; c.beginPath(); const x = hash(i, 4) * w; c.moveTo(x, hash(i, 5) * h * 0.6); c.lineTo(x + (hash(i, 6) - 0.5) * 20, hash(i, 5) * h * 0.6 + 40 + hash(i, 7) * 120); c.stroke(); } // scuff and rust streaks
  for (let i = 0; i < 14; i++) { const gg = c.createRadialGradient(hash(i, 8) * w, hash(i, 9) * h, 0, hash(i, 8) * w, hash(i, 9) * h, 20 + hash(i, 10) * 40); gg.addColorStop(0, 'rgba(30,40,60,0.22)'); gg.addColorStop(1, 'rgba(30,40,60,0)'); c.fillStyle = gg; c.fillRect(0, 0, w, h); } // dents
  for (let q = 1; q < 4; q++) { c.fillStyle = 'rgba(20,30,45,0.5)'; c.fillRect((q * w) / 4 - 3, 0, 6, h); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect((q * w) / 4 + 3, 0, 3, h); } // vertical seams
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { c.fillStyle = (r + q) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; c.fillRect((q * w) / 4 + 12, (r * h) / 4 + 14, w / 4 - 24, h / 4 - 28); } // checker of panel plates
  for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${hash(i, 11) > 0.5 ? '255,255,255' : '10,20,30'},${0.05 + hash(i, 12) * 0.12})`; c.fillRect(hash(i, 13) * w, hash(i, 14) * h, 2 + hash(i, 15) * 10, 2 + hash(i, 16) * 5); } // grain
  for (let i = 0; i < 24; i++) { c.fillStyle = i % 2 ? '#F2C418' : '#231A28'; c.save(); c.translate((i * w) / 24, h * 0.93); c.transform(1, 0, -0.6, 1, 0, 0); c.fillRect(0, 0, w / 24, h * 0.04); c.restore(); } // hazard stripe along the bottom
  for (let i = 0; i < 40; i++) { const y = (i * h) / 40 + hash(i, 21) * 6; c.fillStyle = 'rgba(15,25,40,0.28)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y + 3, w, 2); } // fine corrugation
  for (let i = 0; i < 160; i++) { const x = hash(i, 22) * w, y = hash(i, 23) * h; c.fillStyle = 'rgba(25,30,40,0.5)'; c.beginPath(); c.arc(x, y, 3 + hash(i, 24) * 3, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 1, y - 1, 1.5, 0, 7); c.fill(); } // bolts and rivets
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(140,70,30,${0.25 + hash(i, 25) * 0.25})`; const x = hash(i, 26) * w, y = hash(i, 27) * h * 0.8; c.beginPath(); c.ellipse(x, y, 6 + hash(i, 28) * 14, 14 + hash(i, 29) * 40, 0, 0, 7); c.fill(); } // rust blooms
  const dirt = c.createLinearGradient(0, h * 0.82, 0, h); dirt.addColorStop(0, 'rgba(120,80,40,0)'); dirt.addColorStop(1, 'rgba(120,80,40,0.45)'); c.fillStyle = dirt; c.fillRect(0, h * 0.82, w, h * 0.18);
};
const GarageFar: React.FC = () => {
  const it = useMemo(() => {
    const beams: BoxInst[] = [], boxes: BoxInst[] = [], stripes: BoxInst[] = [], tools: BoxInst[] = [], cols = ['#C99A5B', '#D6A96A', '#B88548'];
    for (let i = 0; i < 6; i++) beams.push({p: [0, 3.22, -5.5 + i * 1.4], s: [8, 0.16, 0.22], c: '#8A5A3A'});
    for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) boxes.push({p: [3.75, 0.28 + l * 0.75 + 0.2, -4.4 + i * 0.7], s: [0.4, 0.34 + hash(l, i) * 0.12, 0.5], c: cols[(i + l) % 3]});
    for (let i = 0; i < 10; i++) { stripes.push({p: [-3.98, 1.7, -5.5 + i * 0.75], s: [0.02, 0.8, 0.06], c: '#D2AE78'}); stripes.push({p: [3.98, 2.6, -5.5 + i * 0.75], s: [0.02, 0.5, 0.06], c: '#D2AE78'}); }
    for (let i = 0; i < 8; i++) tools.push({p: [-3.95, 1.9 + (i % 2) * 0.35, -1.0 + i * 0.35], s: [0.04, 0.3, 0.06], c: i % 3 ? '#8A9AA8' : '#B0643A'});
    return {beams, boxes, stripes, tools};
  }, []);
  return (
    <group>
      <BoxField items={it.beams} cast={false} /> <BoxField items={it.boxes} /> <BoxField items={it.stripes} cast={false} /> <BoxField items={it.tools} cast={false} />
      <Shelf p={[3.75, 0, -3.2]} w={3.2} ry={-Math.PI / 2} />
      <B p={[-3.96, 2.1, -3.8]} s={[0.06, 1.0, 1.4]} c={CREAM} cast={false} ink={0.01} /><B p={[-3.93, 2.1, -3.8]} s={[0.02, 0.84, 1.24]} c="#BFEAF5" basic cast={false} />
      <B p={[-3.94, 1.3, -0.4]} s={[0.1, 2.6, 0.12]} c="#6E8FA8" cast={false} />
      <Cy p={[-3.4, 0.5, 0.6]} r={0.28} h={1.0} c="#D9663F" ink={0.012} /><Cy p={[-3.4, 0.5, 1.15]} r={0.28} h={1.0} c="#3E8E7E" ink={0.012} />
    </group>
  );
};
export interface GarageProps {open?: number; boxes?: boolean}
/** `open` 0..1 raises the big door (1 = fully up, hidden behind the lintel). The door leaf is one rigid slab here, split in 4 panels for Phase 2. */
export const Garage: React.FC<GarageProps> = ({open = 0, boxes = true}) => {
  const floor = useMemo(() => makeTex(1024, 1024, paintConcrete), []), apronT = useMemo(() => makeTex(1024, 704, paintApron), []);
  const roadG = useMemo(() => makeTex(256, 256, paintRoad), []), doorT = useMemo(() => makeTex(1024, 768, paintDoor), []), wallT = useMemo(() => makeTex(256, 256, wallTex), []);
  const shelfBoxes = useMemo<BoxInst[]>(() => {
    const out: BoxInst[] = [], cols = ['#C99A5B', '#D6A96A', '#B88548'];
    for (const [sx, sz, w, ry] of [[-1.7, -5.7, 3.0, 0], [1.7, -5.7, 3.0, 0], [-3.75, -3.2, 3.0, Math.PI / 2], [3.75, -3.2, 3.0, -Math.PI / 2]] as [number, number, number, number][]) for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * 0.7, bw = 0.5 + hash(i + l, sx * 3) * 0.14; const cos = Math.cos(ry), sin = Math.sin(ry);
      out.push({p: [sx + lx * cos, 0.28 + l * 0.75 + 0.2, sz - lx * sin], s: [bw, 0.34 + hash(l, i) * 0.12, 0.4], c: cols[(i + l) % cols.length], ry});
    }
    return out;
  }, []);
  const tape = useMemo<BoxInst[]>(() => shelfBoxes.map((b) => ({p: [b.p[0], b.p[1] + b.s[1] / 2 + 0.002, b.p[2]], s: [b.ry ? 0.42 : 0.07, 0.006, b.ry ? 0.07 : 0.42], c: '#F4EFE0'})), [shelfBoxes]);
  const lift = open * 2.55;
  return (
    <group>
      <Sky top={C.skyTop} bottom={C.skyBot} r={160} /><Clouds />
      <Pl p={[0, 0, -2]} w={9} h={11} map={floor} c="#fff" rot={[-Math.PI / 2, 0, 0]} /><Pl p={[0, 0.006, 5.5]} w={10} h={7} map={apronT} c="#fff" rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[0, 3.3, -2]} w={9} h={11} c="#F1DDB8" rot={[Math.PI / 2, 0, 0]} recv={false} />
      <B p={[0, 1.65, -6.1]} s={[9, 3.3, 0.2]} c={C.garWall} cast={false} /> <B p={[-4.1, 1.65, -2]} s={[0.2, 3.3, 11]} c={C.garWall} cast={false} /> <B p={[4.1, 1.65, -2]} s={[0.2, 3.3, 11]} c={C.garWall} cast={false} />
      <B p={[0, 0.6, -6.0]} s={[8.2, 1.2, 0.08]} c="#C9A06C" cast={false} /> <B p={[-4.0, 0.6, -2]} s={[0.08, 1.2, 10.2]} c="#C9A06C" cast={false} /> <B p={[4.0, 0.6, -2]} s={[0.08, 1.2, 10.2]} c="#C9A06C" cast={false} />
      {/* front wall (door wall) with the big opening x -1.9..1.9, y 0..2.7; outside face at z = 2.0 */}
      <B p={[-3.0, 1.65, 1.85]} s={[2.2, 3.3, 0.3]} c={C.garWall} ink={0.012} /> <B p={[3.0, 1.65, 1.85]} s={[2.2, 3.3, 0.3]} c={C.garWall} ink={0.012} /> <B p={[0, 3.0, 1.85]} s={[3.8, 0.6, 0.3]} c={C.garWall} ink={0.012} />
      <Pl p={[-3.0, 1.65, 2.012]} w={2.2} h={3.3} map={wallT} c="#fff" recv={false} /><Pl p={[3.0, 1.65, 2.012]} w={2.2} h={3.3} map={wallT} c="#fff" recv={false} /><Pl p={[0, 3.0, 2.012]} w={3.8} h={0.6} map={wallT} c="#fff" recv={false} />
      <B p={[-1.95, 1.4, 2.0]} s={[0.12, 2.8, 0.14]} c="#F4EFE0" ink={0.01} /> <B p={[1.95, 1.4, 2.0]} s={[0.12, 2.8, 0.14]} c="#F4EFE0" ink={0.01} /> <B p={[0, 2.76, 2.0]} s={[4.0, 0.12, 0.14]} c="#F4EFE0" ink={0.01} />
      <B p={[0, 3.45, 2.6]} s={[9.6, 0.2, 1.6]} c={C.terra} ink={0.012} /> {/* roof overhang */}
      <B p={[0, 0.05, 1.4]} s={[3.8, 0.1, 0.15]} c="#8A7A68" cast={false} /> {/* sill */}
      {[-1.99, 1.99].map((x) => <group key={x}><B p={[x, 1.35, 1.9]} s={[0.1, 2.7, 0.16]} c="#3E4A52" ink={0.008} />{[0.35, 1.35, 2.35].map((y) => <B key={y} p={[x * 0.97, y, 1.98]} s={[0.12, 0.2, 0.06]} c="#2B3640" />)}</group>)}
      <B p={[-3.4, 0.28, 5.0]} s={[0.7, 0.56, 0.7]} c="#B9824A" ink={0.012} /><B p={[-3.45, 0.84, 5.05]} s={[0.55, 0.5, 0.55]} c="#C99A5B" ink={0.012} rot={[0, 0.2, 0]} /><B p={[3.2, 0.25, 4.6]} s={[0.6, 0.5, 0.6]} c="#C99A5B" ink={0.012} /><Cy p={[2.6, 0.3, 3.4]} r={0.24} h={0.6} c={C.terra} ink={0.012} /><Sp p={[2.6, 0.85, 3.4]} s={[0.4, 0.45, 0.4]} c="#4FA24A" ink={0.012} />
      {/* dark gap behind the leaf (seen when the door is a little open) */}
      {open < 0.4 && <><B p={[0, 1.3, 1.5]} s={[3.8, 2.7, 0.04]} c="#FFC878" basic cast={false} /><B p={[0, 0.12, 1.55]} s={[3.8, 0.2, 0.02]} c="#FFF0C0" basic cast={false} /></>} {/* warm light through the gap under the door */}
      {/* the door leaf: 4 panels, ribbed, a window row on the top panel, handle */}
      <group position={[0, lift, 1.62]}>
        {[0, 1, 2, 3].map((i) => <B key={i} p={[0, 0.34 + i * 0.67, 0]} s={[3.8, 0.64, 0.08]} c={C.garDoor} ink={0.01} />)}
        <Pl p={[0, 1.34, 0.0415]} w={3.78} h={2.68} map={doorT} c="#fff" basic recv={false} /> {/* unlit: the door sits under the roof shadow, a lit texture went flat */}
        {[0, 1, 2, 3].map((i) => <B key={`r${i}`} p={[0, 0.34 + i * 0.67, 0.045]} s={[3.5, 0.5, 0.012]} c="#7FA0B8" cast={false} />)}
        {[-1.2, -0.4, 0.4, 1.2].map((x) => <B key={x} p={[x, 2.34, 0.05]} s={[0.6, 0.32, 0.02]} c="#BFEAF5" basic cast={false} />)}
        {[0, 1, 2, 3].map((i) => <React.Fragment key={`bv${i}`}><B p={[0, 0.34 + i * 0.67 + 0.3, 0.05]} s={[3.74, 0.035, 0.03]} c="#B5CCDC" cast={false} /><B p={[0, 0.34 + i * 0.67 - 0.3, 0.05]} s={[3.74, 0.035, 0.03]} c="#3F566A" cast={false} /></React.Fragment>)}
        <BoxField items={Array.from({length: 40}, (_, i) => ({p: [-1.75 + (i % 10) * 0.39, 0.12 + Math.floor(i / 10) * 0.67 + 0.12, 0.058] as V3, s: [0.045, 0.045, 0.03] as V3, c: '#2F3F4E'}))} cast={false} />
        <B p={[1.4, 0.95, 0.07]} s={[0.22, 0.05, 0.05]} c="#3E4A52" cast={false} /><B p={[1.4, 0.95, 0.062]} s={[0.34, 0.12, 0.02]} c="#2B3640" cast={false} />
      </group>
      {/* side wall door (small, open to the dark outside), pegboard + bench + hanging lights */}
      <B p={[3.99, 1.1, -3.4]} s={[0.1, 2.2, 1.0]} c="#1B1420" basic cast={false} /><B p={[3.93, 2.25, -3.4]} s={[0.14, 0.1, 1.2]} c="#F4EFE0" cast={false} /><B p={[3.93, 1.1, -2.85]} s={[0.14, 2.2, 0.1]} c="#F4EFE0" cast={false} /><B p={[3.93, 1.1, -3.95]} s={[0.14, 2.2, 0.1]} c="#F4EFE0" cast={false} />
      <Shelf p={[-1.7, 0, -5.7]} w={3.2} /> <Shelf p={[1.7, 0, -5.7]} w={3.2} /> <Shelf p={[-3.75, 0, -3.2]} w={3.2} ry={Math.PI / 2} />
      {boxes && <><BoxField items={shelfBoxes} /><BoxField items={tape} cast={false} /></>}
      {[-1.8, 1.8].map((x) => <group key={x}><B p={[x, 3.18, -2.2]} s={[0.2, 0.08, 2.4]} c="#3E4A52" cast={false} /><B p={[x, 3.12, -2.2]} s={[0.12, 0.04, 2.3]} c="#FFF6D0" basic cast={false} /></group>)}
      {/* far field: ceiling beams, right wall shelves + boxes, left wall window, paint stripes, tools on every wall */}
      <GarageFar />
      {/* tools on a pegboard, stacked crates and boxes, a hanging bulb */}
      <B p={[0, 1.75, -5.95]} s={[2.4, 1.1, 0.05]} c="#C9A06C" cast={false} ink={0.008} />
      {[-0.8, -0.3, 0.25, 0.75].map((x, i) => <group key={i} position={[x, 1.75, -5.9]}><B p={[0, 0, 0]} s={[0.06, 0.5, 0.03]} c="#6B4A32" cast={false} /><B p={[0, 0.26, 0]} s={[i % 2 ? 0.3 : 0.22, 0.1, 0.04]} c="#8A9AA8" cast={false} ink={0.004} /></group>)}
      <BoxField items={[{p: [3.2, 0.25, -0.6], s: [0.7, 0.5, 0.6], c: '#B9824A'}, {p: [3.25, 0.7, -0.62], s: [0.6, 0.4, 0.55], c: '#C99A5B', ry: 0.2}, {p: [-3.3, 0.25, -1.0], s: [0.7, 0.5, 0.6], c: '#C99A5B', ry: 0.1}]} />
      <B p={[0.6, 2.9, -1.2]} s={[0.012, 0.8, 0.012]} c="#3E3A36" cast={false} /><Sp p={[0.6, 2.45, -1.2]} s={[0.1, 0.12, 0.1]} c="#FFF2B8" basic cast={false} />
      {/* outside: street in front of the garage, neighbours */}
      <Pl p={[0, 0.003, 10]} w={40} h={14} c="#fff" map={roadG} rot={[-Math.PI / 2, 0, 0]} /><Far /> <Pl p={[0, -0.01, 30]} w={140} h={60} c="#B98E65" rot={[-Math.PI / 2, 0, 0]} />
      <B p={[-9, 2.2, 2]} s={[8, 4.4, 4]} c="#E8B27A" /> <B p={[-9, 4.5, 2]} s={[8.3, 0.24, 4.3]} c={C.terra} /> <B p={[9, 2.5, 2]} s={[8, 5, 4]} c="#F0C48E" /> <B p={[9, 5.1, 2]} s={[8.3, 0.24, 4.3]} c={C.terra} />
      <B p={[-6.4, 1.6, 4.05]} s={[1.1, 1.1, 0.1]} c={CREAM} cast={false} /><B p={[-6.4, 1.6, 4.1]} s={[0.9, 0.9, 0.06]} c={GLASS} basic cast={false} />
      <B p={[-3.2, 2.2, 2.02]} s={[1.2, 1.0, 0.06]} c="#BFEAF5" basic cast={false} /> {/* small window on the front wall */}
    </group>
  );
};
void THREE;
