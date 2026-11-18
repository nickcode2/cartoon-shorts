// ZUMBIS_PARTE_10 sets (channel FocoProibido, dusk / night). Coordinates: metres, x right, y up, the avenue runs along z, the TOWER stands at (0, 0, TOWER_Z) at its far (-z) end.
//   CITY (one built-out world; zones for the camera QA: avenue z +60..-45, crossing z -45..-75, tower z -75..-135 + the rooftop terrace):
//     avenue 16 m wide with cracked asphalt, sidewalks, ruined facades (broken-glass windows with shards, a few lit gold / orange windows), wrecked cars, lamp posts (a third of them lit),
//     a wide cross street (crosswalk, dead traffic lights, a crashed bus), the plaza with golden inlay rings, the podium (r 17.5, 22 m high, arched lit windows, entrance arch + door),
//     the golden TOWER (real 3D, glowing) rising out of the podium, the roof terrace ring (parapet, benches, planters, string lights), 12 giant sprinklers + the rain curtain (`rain` 0..1),
//     a far city ring with lit windows out to the horizon, night sky with moon, purple haze (scene fog), floating dust.
//   HALL: interior shelter at x = HALL_X (far from the city): colonnade, vaulted beams, lamps, door at the -z end, blankets, supplies, instanced sleeping crowd cards.
// Everything is built once per mount (useMemo), unit geometry + scale, repeats instanced. No per-frame allocation.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RAMP, V3, hash, makeTex, shared} from '../kit/kit';
import {B, BoxField, BoxInst, Cy, Pl, Sp, bm, tm} from '../cobra/common';
import {C, SceneFog, useFarPlane} from './common';
import {Door, Motes, RainCurtain, Sprinklers, Tower} from './props';

export const TOWER_Z = -150, PODIUM_R = 17.5, ROOF_Y = 22, DOOR_Z = TOWER_Z + PODIUM_R, CROSS_Z = -60, AVE_W = 8, HALL_X = 600;
const hdrM = (k: string, c: THREE.Color) => shared('foco-hdrs-' + k, () => new THREE.MeshBasicMaterial({color: c, toneMapped: false, fog: false}));
const GOLD_HDR = new THREE.Color(1.3, 0.98, 0.34), ORANGE_HDR = new THREE.Color(1.25, 0.58, 0.18), GOLD_BLOOM = new THREE.Color(2.5, 1.9, 0.7);
const rampTex = () => RAMP;

// ---------------------------------------------------------------- generic instanced mesh with colour + rotation per instance
export interface Inst {p: V3; s: V3; c: string; r?: V3}
export const InstMesh: React.FC<{items: Inst[]; geo: () => THREE.BufferGeometry; geoKey: string; basic?: boolean; hdr?: THREE.Color; cast?: boolean; side?: THREE.Side; recv?: boolean}> = ({items, geo, geoKey, basic, hdr, cast = false, side, recv = true}) => {
  const mesh = useMemo(() => {
    const mat = hdr ? hdrM(geoKey + hdr.getHexString(), hdr) : basic ? bm('#ffffff') : (() => { const m = new THREE.MeshToonMaterial({gradientMap: RAMP, side: side ?? THREE.FrontSide}); m.defines = {PAINTED_SHADOWS: ''}; return m; })();
    const m = new THREE.InstancedMesh(shared(geoKey, geo), mat as THREE.Material, Math.max(1, items.length)), o = new THREE.Object3D(), col = new THREE.Color();
    items.forEach((it, i) => { o.position.set(...it.p); o.scale.set(...it.s); o.rotation.set(...(it.r ?? [0, 0, 0])); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (!hdr) m.setColorAt(i, col.set(it.c)); });
    m.count = items.length; m.castShadow = cast; m.receiveShadow = recv; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; return m;
  }, [items, geoKey, basic, hdr, cast, side, recv]); // eslint-disable-line react-hooks/exhaustive-deps
  return <primitive object={mesh} />;
};
// QA sheets mount 25 copies of a shot at once: they set window.__sheet and the big textures are then shared (cached) instead of painted 25 times
const TC = new Map<string, THREE.Texture>();
const mt = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.Texture => { if (typeof window !== 'undefined' && (window as unknown as {__sheet?: boolean}).__sheet) { let t = TC.get(key); if (!t) { t = makeTex(w, h, draw, repeat); TC.set(key, t); } return t; } return makeTex(w, h, draw, repeat); };
const boxGeo = () => new THREE.BoxGeometry(1, 1, 1);
const coneGeo = () => new THREE.ConeGeometry(0.5, 1, 4);
const cylGeo = () => new THREE.CylinderGeometry(1, 1, 1, 10);

// ---------------------------------------------------------------- lights
export const FocoLights: React.FC<{ss?: number; at?: V3; ext?: number; inner?: boolean}> = ({ss = 2048, at = [0, 0, 0], ext = 24, inner = false}) => (
  <>
    <hemisphereLight args={[inner ? '#7A58C8' : '#6C42B8', inner ? '#2B2368' : '#7A4030', inner ? 1.35 : 1.2]} />
    <directionalLight color="#F28A3C" intensity={inner ? 1.1 : 3.0} position={[at[0] - 14, at[1] + 9, at[2] + 8]} castShadow shadow-mapSize={[ss, ss]} shadow-camera-left={-ext} shadow-camera-right={ext} shadow-camera-top={ext} shadow-camera-bottom={-ext} shadow-camera-near={1} shadow-camera-far={80} shadow-bias={-0.0004} shadow-normalBias={0.03} target-position={at} />
    <directionalLight color="#6C42B8" intensity={0.7} position={[at[0] + 12, at[1] + 6, at[2] - 6]} />
  </>
);

// ---------------------------------------------------------------- textures (painted once)
const paintAsphalt = (c: CanvasRenderingContext2D, w: number, h: number) => { // 1 tile = 8 x 8 m: slabs, hairline + wide cracks (ink), patches, oil stains, tyre marks, worn lane paint (orange centre dashes, lavender edge lines), manhole
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2A2366'); g.addColorStop(0.5, '#221C58'); g.addColorStop(1, '#2C2568'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(${hash(i, 9) > 0.5 ? '84,64,160' : '8,6,34'},${0.06 + hash(i, 1) * 0.12})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 6 + hash(i, 4) * 30, 3 + hash(i, 5) * 14, hash(i, 6) * 3, 0, 7); c.fill(); }
  for (let i = 0; i < 6; i++) { const x = hash(i, 51) * w, y = hash(i, 52) * h, r = 18 + hash(i, 53) * 40, gg = c.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(110,80,200,0.30)'); gg.addColorStop(1, 'rgba(110,80,200,0)'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } // oil stains
  c.strokeStyle = 'rgba(8,6,32,0.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke(); c.beginPath(); c.moveTo(w * 0.5, 0); c.lineTo(w * 0.5, h); c.stroke(); // slab joints
  c.strokeStyle = 'rgba(8,6,32,0.35)'; c.lineWidth = 9; for (const [x0, k] of [[0.3, 1], [0.7, -1]] as [number, number][]) { c.beginPath(); c.moveTo(w * x0, 0); c.bezierCurveTo(w * (x0 + 0.04 * k), h * 0.3, w * (x0 - 0.05 * k), h * 0.6, w * (x0 + 0.02 * k), h); c.stroke(); } // tyre marks
  for (let k = 0; k < 9; k++) { let x = hash(k, 21) * w, y = hash(k, 22) * h, a = hash(k, 23) * 6.28; c.strokeStyle = '#0B092A'; c.lineWidth = 2 + hash(k, 24) * 3; c.beginPath(); c.moveTo(x, y); for (let s2 = 0; s2 < 14; s2++) { a += (hash(k * 31 + s2, 25) - 0.5) * 1.1; x += Math.cos(a) * (14 + hash(k + s2, 26) * 22); y += Math.sin(a) * (14 + hash(k + s2, 27) * 22); c.lineTo(x, y); if (hash(k * 7 + s2, 28) < 0.18) { c.moveTo(x, y); c.lineTo(x + Math.cos(a + 1.1) * 40, y + Math.sin(a + 1.1) * 40); c.moveTo(x, y); } } c.stroke(); }
  c.fillStyle = 'rgba(52,40,120,0.8)'; c.fillRect(w * 0.12, h * 0.62, w * 0.22, h * 0.18); c.strokeStyle = 'rgba(10,8,40,0.6)'; c.lineWidth = 2; c.strokeRect(w * 0.12, h * 0.62, w * 0.22, h * 0.18); c.fillStyle = 'rgba(52,40,120,0.8)'; c.fillRect(w * 0.62, h * 0.14, w * 0.2, h * 0.12); c.strokeRect(w * 0.62, h * 0.14, w * 0.2, h * 0.12); // repair patches
  c.fillStyle = 'rgba(242,138,60,0.55)'; for (let i = 0; i < 4; i++) c.fillRect(w * 0.5 - 4, i * (h / 4) + h * 0.04, 8, h * 0.13); // dashed centre line (orange, worn)
  c.fillStyle = 'rgba(201,196,238,0.28)'; c.fillRect(w * 0.04, 0, 5, h); c.fillRect(w * 0.96 - 5, 0, 5, h); // lane edge lines
  for (let i = 0; i < 22000; i++) { c.fillStyle = hash(i, 61) > 0.5 ? `rgba(140,112,230,${0.14 + hash(i, 62) * 0.2})` : `rgba(6,4,28,${0.25 + hash(i, 63) * 0.25})`; c.fillRect(hash(i, 64) * w, hash(i, 65) * h, 1 + hash(i, 66) * 2, 1 + hash(i, 67) * 2); } // grit, so close-ups of the ground are never flat
  c.strokeStyle = 'rgba(8,6,32,0.7)'; c.lineWidth = 4; c.beginPath(); c.arc(w * 0.82, h * 0.78, 22, 0, 7); c.stroke(); c.fillStyle = 'rgba(8,6,32,0.4)'; c.fill(); // manhole
};
const paintSlab = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#A06A24'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const g = c.createLinearGradient(i * w / 2, j * h / 2, (i + 1) * w / 2, (j + 1) * h / 2); g.addColorStop(0, (i + j) % 2 ? '#B67A2A' : '#9A6422'); g.addColorStop(1, '#7A4C1E'); c.fillStyle = g; c.fillRect(i * w / 2 + 2, j * h / 2 + 2, w / 2 - 4, h / 2 - 4); } c.strokeStyle = 'rgba(30,14,40,0.7)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); }; // sidewalk slabs: warm dusk-lit paving (orange family)
const paintPlaza = (c: CanvasRenderingContext2D, w: number, h: number) => { // radial plaza: dark violet slabs with golden inlay rings and radial spokes lit by the tower (additive glow is a separate disc)
  c.fillStyle = '#241D5E'; c.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2;
  for (const [r, a] of [[0.12, 0.9], [0.3, 0.55], [0.5, 0.4], [0.72, 0.3], [0.94, 0.5]] as [number, number][]) { c.strokeStyle = `rgba(247,198,90,${a})`; c.lineWidth = 5 + r * 4; c.beginPath(); c.arc(cx, cy, r * w / 2, 0, 7); c.stroke(); }
  c.strokeStyle = 'rgba(247,198,90,0.22)'; c.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; c.beginPath(); c.moveTo(cx + Math.cos(a) * w * 0.12, cy + Math.sin(a) * w * 0.12); c.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.5); c.stroke(); }
  for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(10,8,40,${0.05 + hash(i, 1) * 0.1})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 4 + hash(i, 4) * 16, 2 + hash(i, 5) * 8, hash(i, 6) * 3, 0, 7); c.fill(); }
  for (let i = 0; i < 30000; i++) { c.fillStyle = hash(i, 71) > 0.5 ? `rgba(150,120,235,${0.12 + hash(i, 72) * 0.16})` : `rgba(8,6,34,${0.2 + hash(i, 73) * 0.22})`; c.fillRect(hash(i, 74) * w, hash(i, 75) * h, 1 + hash(i, 76) * 2, 1 + hash(i, 77) * 2); } // grit
};
const paintFarWin = (seed: number) => (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#1D1750'; c.fillRect(0, 0, w, h); const cols = 8, rows = 16; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const u = hash(j * 13 + i, seed); c.fillStyle = u < 0.07 ? '#F7C65A' : u < 0.1 ? '#F28A3C' : u < 0.5 ? '#2B2368' : '#14123A'; c.fillRect(i * (w / cols) + 4, j * (h / rows) + 3, w / cols - 8, h / rows - 7); } c.fillStyle = '#4A2B8F'; c.fillRect(0, 0, w, 6); };
const paintCloud = (c: CanvasRenderingContext2D, w: number, h: number) => { for (let i = 0; i < 26; i++) { const x = hash(i, 1) * w, y = h * (0.35 + hash(i, 2) * 0.3), r = 30 + hash(i, 3) * 70; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(201,196,238,0.5)'); g.addColorStop(1, 'rgba(201,196,238,0)'); c.fillStyle = g; c.save(); c.translate(x, y); c.scale(2.4, 0.5); c.translate(-x, -y); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore(); } };

// ---------------------------------------------------------------- sky: gradient dome (indigo -> purple -> orange horizon -> violet below), stars, moon, cloud bands. Fog off (it must stay visible).
export const NightSky: React.FC = () => {
  const {sky, stars, moon, glow, cloud} = useMemo(() => {
    const sky = mt('sky', 1024, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0F0D2E'); g.addColorStop(0.3, '#1E1A52'); g.addColorStop(0.42, '#4A2B8F'); g.addColorStop(0.455, '#9A3F7A'); g.addColorStop(0.478, '#E0662F'); g.addColorStop(0.5, '#F28A3C'); g.addColorStop(0.512, '#F2A24C'); g.addColorStop(0.528, '#8A3F7A'); g.addColorStop(0.58, '#2B2368'); g.addColorStop(1, '#1E1A52'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const y = h * (0.12 + hash(i, 1) * 0.4), x = hash(i, 2) * w, len = 90 + hash(i, 3) * 260, near = 1 - Math.abs(y / h - 0.48) * 3; const gg = c.createLinearGradient(x, y, x + len, y); const col = y / h > 0.4 ? '242,138,60' : '108,66,184'; gg.addColorStop(0, `rgba(${col},0)`); gg.addColorStop(0.5, `rgba(${col},${Math.max(0.05, 0.28 * near)})`); gg.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gg; c.fillRect(x, y, len, 3 + hash(i, 4) * 9); } });
    const stars = mt('stars', 1024, 512, (c, w, h) => { for (let i = 0; i < 520; i++) { c.fillStyle = `rgba(255,241,214,${0.25 + hash(i, 3) * 0.6})`; c.beginPath(); c.arc(hash(i, 1) * w, hash(i, 2) * h * 0.4, 0.8 + hash(i, 4) * 1.4, 0, 7); c.fill(); } });
    const moon = mt('moon', 128, 128, (c, w, h) => { c.fillStyle = '#C9C4EE'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.3, 0, 7); c.fill(); c.fillStyle = 'rgba(120,100,180,0.45)'; for (const [x, y, r] of [[0.42, 0.42, 0.07], [0.6, 0.55, 0.05], [0.5, 0.65, 0.06]]) { c.beginPath(); c.arc(w * x, h * y, w * r, 0, 7); c.fill(); } });
    const glow = mt('glow', 128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    return {sky, stars, moon, glow, cloud: mt('cloud', 512, 128, paintCloud)};
  }, []);
  return (
    <group position={[0, 0, -60]}>
      <mesh><sphereGeometry args={[430, 24, 16]} /><meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} depthWrite={false} fog={false} /></mesh>
      <mesh><sphereGeometry args={[425, 24, 16]} /><meshBasicMaterial map={stars} side={THREE.BackSide} toneMapped={false} transparent depthWrite={false} fog={false} /></mesh>
      <sprite position={[-150, 190, -250]} scale={[46, 46, 1]}><spriteMaterial map={moon} toneMapped={false} fog={false} /></sprite>
      <sprite position={[-150, 190, -250]} scale={[150, 150, 1]}><spriteMaterial map={glow} color={C.lav} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></sprite>
      {Array.from({length: 8}, (_, i) => { const a = (i / 8) * Math.PI * 2; return <sprite key={i} position={[Math.sin(a) * 330, 26, -150 + Math.cos(a) * 330]} scale={[330, 70, 1]}><spriteMaterial map={glow} color={C.orange} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></sprite>; })}
      <sprite position={[0, 40, -340]} scale={[420, 110, 1]}><spriteMaterial map={glow} color={C.orange} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></sprite>
      {[[-120, 70, -300, 300], [90, 90, -280, 260], [-20, 55, 280, 320], [200, 80, 40, 280]].map(([x, y, z, s], i) => <mesh key={i} position={[x, y, z]} rotation={[0, Math.atan2(x, z) + Math.PI, 0]}><planeGeometry args={[s, s * 0.25]} /><meshBasicMaterial map={cloud} transparent opacity={0.5} depthWrite={false} toneMapped={false} fog={false} /></mesh>)}
    </group>
  );
};

// ---------------------------------------------------------------- the avenue buildings (ruined facades). side -1 = left (x < 0), +1 = right
interface Fac {bodies: Inst[]; trims: Inst[]; frames: Inst[]; hollow: Inst[]; glass: Inst[]; glowG: Inst[]; glowO: Inst[]; shards: Inst[]; awn: Inst[]; shop: Inst[]}
function facades(): Fac {
  const o: Fac = {bodies: [], trims: [], frames: [], hollow: [], glass: [], glowG: [], glowO: [], shards: [], awn: [], shop: []}, wall = [C.wall1, C.wall2, C.wall3, '#2A2366'];
  let n = 0;
  for (const side of [-1, 1]) {
    let z = 62; // blocks from +62 down to the plaza; a gap for the cross street and a small alley now and then
    while (z > -118) {
      const len = 10 + Math.floor(hash(n, 3) * 8), z1 = z - len, mid = (z + z1) / 2;
      if (z1 < CROSS_Z + 10 && z > CROSS_Z - 10) { z = CROSS_Z - 10; continue; } // cross street: z -70..-50
      const floors = 6 + Math.floor(hash(n, 4) * 7), H = 3.6 * floors + 1.2, depth = 15 + Math.floor(hash(n, 5) * 6), cx = side * (12 + depth / 2), col = wall[n % wall.length];
      o.bodies.push({p: [cx, H / 2, mid], s: [depth, H, len - 0.8], c: col});
      o.trims.push({p: [side * 11.96, H - 0.4, mid], s: [0.5, 0.8, len - 0.8], c: n % 3 === 0 ? C.orangeD : C.trim}, {p: [side * 11.9, 2.1, mid], s: [0.4, 0.4, len - 0.8], c: n % 2 ? C.orangeD : C.trim}); // cornice + plinth band
      if (hash(n, 9) < 0.55) o.trims.push({p: [side * 11.94, H + 0.9, mid], s: [0.6, 1.6, len - 0.8], c: C.wall3}); // parapet
      const cols = Math.max(2, Math.floor((len - 1.6) / 3.1)), zs = (len - 0.8) / cols;
      for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
        const zc = z - 0.4 - zs * (k + 0.5), y = f === 0 ? 2.6 : 3.2 + f * 3.6, hh = f === 0 ? 2.4 : 2.0, ww = Math.min(1.9, zs * 0.62), u = hash(n * 97 + f * 13 + k, 11);
        o.frames.push({p: [side * 11.9, y, zc], s: [0.34, hh + 0.28, ww + 0.28], c: C.trim});
        if (u < 0.42) { o.hollow.push({p: [side * 11.82, y, zc], s: [0.2, hh, ww], c: C.deep}); for (let q = 0; q < 4; q++) { const sx = (hash(n * 53 + f * 7 + k * 3 + q, 12) - 0.5) * ww; o.shards.push({p: [side * 11.7, y - hh / 2 + 0.05, zc + sx], s: [0.07 + 0.05 * hash(q + n, 14), 0.16 + 0.2 * hash(q + n + 1, 15), 0.07], c: '#8F89BE', r: [0, 0, side * (0.2 + hash(q, 16) * 0.4) * -1]}); if (q < 2) o.shards.push({p: [side * 11.7, y + hh / 2 - 0.05, zc + sx * 0.7], s: [0.07, 0.14 + 0.16 * hash(q + n + 5, 17), 0.07], c: '#8F89BE', r: [0, 0, side * Math.PI + side * 0.25]}); } }
        else if (u < 0.7) o.glass.push({p: [side * 11.82, y, zc], s: [0.2, hh, ww], c: hash(n + f + k, 18) < 0.5 ? C.trim : '#3A2480'});
        else if (u < 0.88) o.hollow.push({p: [side * 11.82, y, zc], s: [0.2, hh, ww], c: C.night});
        else if (u < 0.94) o.glowG.push({p: [side * 11.8, y, zc], s: [0.2, hh * 0.9, ww * 0.9], c: C.gold}); else o.glowO.push({p: [side * 11.8, y, zc], s: [0.2, hh * 0.9, ww * 0.9], c: C.orange});
      }
      if (hash(n, 20) < 0.75) o.awn.push({p: [side * 10.7, 3.9, mid], s: [2.6, 0.1, len * 0.8], c: n % 2 ? C.orangeD : C.orange, r: [0, 0, side * -0.34]}); // torn shop awning
      if (hash(n, 21) < 0.6) o.shop.push({p: [side * 11.93, 1.3, mid], s: [0.05, 2.0, (len - 1.4) * (0.5 + 0.4 * hash(n, 22))], c: C.orange}); // a lit shop front at street level (warm light source)
      n++; z = z1 - (hash(n, 30) < 0.25 ? 3.5 : 0.2);
    }
  }
  return o;
}
const Facades: React.FC = () => {
  const F = useMemo(facades, []);
  return (
    <group>
      <InstMesh items={F.bodies} geo={boxGeo} geoKey="foco-box" cast /><InstMesh items={F.trims} geo={boxGeo} geoKey="foco-box" /><InstMesh items={F.frames} geo={boxGeo} geoKey="foco-box" />
      <InstMesh items={F.hollow} geo={boxGeo} geoKey="foco-box" recv={false} /><InstMesh items={F.glass} geo={boxGeo} geoKey="foco-box" recv={false} />
      <InstMesh items={F.glowG} geo={boxGeo} geoKey="foco-box" hdr={GOLD_HDR} /><InstMesh items={F.glowO} geo={boxGeo} geoKey="foco-box" hdr={ORANGE_HDR} />
      <InstMesh items={F.shop} geo={boxGeo} geoKey="foco-box" hdr={new THREE.Color(1.0, 0.44, 0.14)} /><InstMesh items={F.shards} geo={coneGeo} geoKey="foco-cone4" recv={false} /><InstMesh items={F.awn} geo={boxGeo} geoKey="foco-box" />
    </group>
  );
};

// ---------------------------------------------------------------- far city ring: instanced towers with painted lit windows, out to the horizon (leaves the avenue corridor and the plaza open)
const FarCity: React.FC = () => {
  const groups = useMemo(() => {
    const g: Inst[][] = [[], [], []]; let n = 0;
    for (let i = 0; i < 640; i++) {
      const a = hash(i, 1) * Math.PI * 2, r = 46 + Math.pow(hash(i, 2), 0.7) * 300, x = Math.cos(a) * r, z = TOWER_Z + 90 + Math.sin(a) * r * 1.05; // centred between the tower and the avenue so the city fills all around
      if (Math.abs(x) < 30 && z > TOWER_Z + 28 && z < 80) continue; // keep the avenue open
      if (Math.hypot(x, z - TOWER_Z) < 44) continue; // keep the plaza open
      if (Math.abs(x) < 34 && z > 40) continue;
      const w = 12 + hash(i, 3) * 26, d = 12 + hash(i, 4) * 26, h = 18 + Math.pow(hash(i, 5), 2) * 90 * (0.6 + r / 300), k = n++ % 3;
      g[k].push({p: [x, h / 2, z], s: [w, h, d], c: [C.wall1, C.wall2, C.wall3][k], r: [0, Math.floor(hash(i, 6) * 4) * 0.4, 0]});
    }
    return g;
  }, []);
  const tex = useMemo(() => [0, 1, 2].map((k) => mt('farwin' + k, 128, 256, paintFarWin(30 + k))), []);
  return (
    <group>{groups.map((items, k) => <FarBox key={k} items={items} map={tex[k]} k={k} />)}</group>
  );
};
const FarBox: React.FC<{items: Inst[]; map: THREE.Texture; k: number}> = ({items, map, k}) => {
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(shared('foco-box', boxGeo), (() => { const mm = new THREE.MeshToonMaterial({gradientMap: RAMP, map}); return mm; })(), Math.max(1, items.length)), o = new THREE.Object3D(); items.forEach((it, i) => { o.position.set(...it.p); o.scale.set(...it.s); o.rotation.set(...(it.r ?? [0, 0, 0])); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.count = items.length; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; return m; }, [items, map]);
  void k;
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------- street furniture
const Wreck: React.FC<{p: V3; ry: number; c: string; tilt?: number; lit?: boolean}> = ({p, ry, c, tilt = 0, lit}) => (
  <group position={p} rotation={[0, ry, tilt]}>
    <B p={[0, 0.55, 0]} s={[1.8, 0.62, 4.2]} c={c} ink={0.02} /><B p={[0, 1.08, -0.2]} s={[1.6, 0.52, 2.2]} c={c} ink={0.02} /><B p={[0, 1.1, -0.2]} s={[1.64, 0.36, 2.0]} c={C.night} cast={false} />
    {[[-0.9, -1.35], [0.9, -1.35], [-0.9, 1.35], [0.9, 1.35]].map(([a, b], i) => <Cy key={i} p={[a, 0.34, b]} r={0.36} h={0.26} c={C.deep} rot={[0, 0, Math.PI / 2]} ink={0.01} />)}
    <Sp p={[-0.55, 0.7, 2.12]} s={[0.17, 0.17, 0.08]} c={lit ? C.gold : C.violet} basic={lit} cast={false} /><Sp p={[0.55, 0.7, 2.12]} s={[0.17, 0.17, 0.08]} c={C.violet} cast={false} />
    {[0, 1, 2].map((i) => <B key={i} p={[-0.6 + i * 0.6, 1.4, 0.6 + i * 0.1]} s={[0.1, 0.34, 0.06]} c={C.lav} rot={[0.3, 0, 0.5 * (i - 1)]} cast={false} />)}
  </group>
);
const poolMat = () => shared('foco-pool-m', () => new THREE.MeshBasicMaterial({map: makeTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), color: C.gold, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false}));
const Lamp: React.FC<{p: V3; lit: boolean; side: number}> = ({p, lit, side}) => (
  <group position={p} rotation={[0, side < 0 ? 0 : Math.PI, 0]}>
    <Cy p={[0, 3.2, 0]} r={0.1} h={6.4} c={C.violet} ink={0.012} /><B p={[1.0, 6.35, 0]} s={[2.1, 0.12, 0.12]} c={C.violet} cast={false} />
    {lit ? <mesh position={[1.9, 6.15, 0]} material={hdrM('lamp', GOLD_BLOOM)}><sphereGeometry args={[0.3, 10, 8]} /></mesh> : <Sp p={[1.9, 6.15, 0]} s={[0.3, 0.3, 0.3]} c={C.violet} cast={false} />}
    {lit && <mesh position={[1.9, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={shared('foco-plane', () => new THREE.PlaneGeometry(1, 1))} material={poolMat()} scale={[11, 11, 1]} />}
    {lit && <pointLight position={[1.9, 5.8, 0]} color="#F7C65A" intensity={60} distance={16} decay={2} />}
  </group>
);
const TrafficLight: React.FC<{p: V3; ry: number}> = ({p, ry}) => (
  <group position={p} rotation={[0, ry, 0]}><Cy p={[0, 2.2, 0]} r={0.08} h={4.4} c={C.violet} ink={0.01} /><B p={[0, 4.2, 0.2]} s={[0.4, 1.1, 0.3]} c={C.deep} ink={0.01} />{[3.9, 4.2, 4.5].map((y, i) => <Sp key={y} p={[0, y, 0.38]} s={[0.1, 0.1, 0.05]} c={i === 0 ? C.red : C.violet} cast={false} />)}</group>
);

// ---------------------------------------------------------------- the CITY
export const City: React.FC<{f: number; t: number; rain?: number; at?: V3; ss?: number; fog?: boolean}> = ({f, t, rain = 0, at = [0, 0, -30], ss = 2048, fog = true}) => {
  const asph = useMemo(() => mt('asph', 512, 512, paintAsphalt, [2, 24]), []), asphX = useMemo(() => mt('asphX', 512, 512, paintAsphalt, [60, 2]), []), slab = useMemo(() => mt('slab', 128, 128, paintSlab, [2, 90]), []), slabX = useMemo(() => mt('slabX', 128, 128, paintSlab, [100, 2]), []), plaza = useMemo(() => mt('plaza', 1024, 1024, paintPlaza), []);
  const ground = useMemo(() => mt('ground', 64, 64, (c, w, h) => { c.fillStyle = '#1A1548'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,30,100,0.35)'; c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 6, 4); } }, [60, 60]), []);
  const stripes = useMemo<Inst[]>(() => { const o: Inst[] = []; for (const zc of [CROSS_Z + 12.5, CROSS_Z - 12.5]) for (let i = 0; i < 9; i++) o.push({p: [-AVE_W + 0.9 + i * 1.8, 0.03, zc], s: [0.9, 0.02, 3.2], c: '#8F89BE'}); return o; }, []);
  const ring = useMemo<Inst[]>(() => Array.from({length: 24}, (_, i) => { const a = (i / 24) * Math.PI * 2; return {p: [Math.cos(a) * 17.7, 11, TOWER_Z + Math.sin(a) * 17.7], s: [1.0, 22, 1.4], c: C.trim, r: [0, -a, 0]}; }), []);
  const arch = useMemo(() => { const o: Inst[] = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.2) continue; const k = hash(i, 5); o.push({p: [Math.cos(a) * 17.6, k < 0.5 ? 6 : 13, TOWER_Z + Math.sin(a) * 17.6], s: [0.5, 3.6, 2.0], c: k < 0.33 ? C.gold : C.deep, r: [0, -a, 0]}); } return o; }, []);
  const lampsL = [58, 44, 30, 16, 2, -12, -26, -40, -78, -92, -106], wrecks: {p: V3; ry: number; c: string; tilt: number; lit?: boolean}[] = [{p: [-5.6, 0, 22], ry: 0.2, c: C.orangeD, tilt: 0}, {p: [5.2, 0, 8], ry: Math.PI - 0.25, c: C.purpleL, tilt: 0.12}, {p: [-4.4, 0, -22], ry: -0.5, c: C.trim, tilt: 0}, {p: [6.0, 0, -34], ry: 0.15, c: C.coral, tilt: 0}, {p: [-6.3, 0, -88], ry: 3.0, c: C.purpleL, tilt: 0.2}, {p: [4.8, 0, -100], ry: 0.4, c: C.orangeD, tilt: 0}];
  useFarPlane(900);
  return (
    <group>
      {fog && <SceneFog />}
      <NightSky /><FocoLights ss={ss} at={at} />
      {/* ground, avenue, sidewalks, cross street, crosswalks, plaza */}
      <Pl p={[0, -0.04, -60]} w={800} h={800} c="#fff" map={ground} rot={[-Math.PI / 2, 0, 0]} recv={false} />
      <Pl p={[0, 0, -34]} w={AVE_W * 2} h={190} c="#fff" map={asph} rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[-AVE_W - 2, 0.02, -34]} w={4} h={190} c="#fff" map={slab} rot={[-Math.PI / 2, 0, 0]} /><Pl p={[AVE_W + 2, 0.02, -34]} w={4} h={190} c="#fff" map={slab} rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[0, 0.005, CROSS_Z]} w={400} h={18} c="#fff" map={asphX} rot={[-Math.PI / 2, 0, 0]} /><Pl p={[0, 0.02, CROSS_Z + 11]} w={400} h={4} c="#fff" map={slabX} rot={[-Math.PI / 2, 0, 0]} recv={false} /><Pl p={[0, 0.02, CROSS_Z - 11]} w={400} h={4} c="#fff" map={slabX} rot={[-Math.PI / 2, 0, 0]} recv={false} />
      <InstMesh items={stripes} geo={boxGeo} geoKey="foco-box" recv={false} />
      <InstMesh items={[-1, 1].map((sd) => ({p: [sd * (AVE_W + 0.15), 0.1, -34] as V3, s: [0.3, 0.2, 190] as V3, c: C.orangeD}))} geo={boxGeo} geoKey="foco-box" />
      <InstMesh items={[-1, 1].flatMap((sd) => Array.from({length: 24}, (_, i) => ({p: [sd * (AVE_W + 3.9), 0.045, 60 - i * 7.6] as V3, s: [3.4, 0.02, 0.18] as V3, c: C.gold})))} geo={boxGeo} geoKey="foco-box" recv={false} />
      <mesh position={[0, 0.012, TOWER_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[31, 64]} /><primitive object={(() => { const m = shared('foco-plaza-m-' + plaza.uuid, () => { const mm = new THREE.MeshToonMaterial({map: plaza, gradientMap: RAMP}); mm.defines = {PAINTED_SHADOWS: ''}; return mm; }); return m; })()} attach="material" /></mesh>
      <mesh position={[0, 0.05, TOWER_Z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[30, 48]} /><meshBasicMaterial color={C.gold} transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></mesh>
      <Facades /><FarCity />
      {wrecks.map((w, i) => <Wreck key={i} p={w.p} ry={w.ry} c={w.c} tilt={w.tilt} lit={i === 3} />)}
      {/* crashed bus at the cross street (left corner), dead traffic lights, lamps (every third lit) */}
      <group position={[-9.5, 0, CROSS_Z + 7.5]} rotation={[0, 0.5, 0.05]}><B p={[0, 1.5, 0]} s={[2.6, 2.6, 10.5]} c={C.purpleL} ink={0.02} /><B p={[0, 2.0, 0]} s={[2.66, 0.9, 9.6]} c={C.night} cast={false} /><B p={[0, 0.2, 0]} s={[2.7, 0.4, 10.6]} c={C.deep} cast={false} />{[-3.5, 3.5].map((z) => [-1.3, 1.3].map((x) => <Cy key={`${x}${z}`} p={[x, 0.5, z]} r={0.5} h={0.34} c={C.deep} rot={[0, 0, Math.PI / 2]} ink={0.01} />))}</group>
      {[[-AVE_W - 0.5, CROSS_Z + 9, 0], [AVE_W + 0.5, CROSS_Z - 9, Math.PI]].map(([x, z, r], i) => <TrafficLight key={i} p={[x, 0, z]} ry={r} />)}
      {lampsL.flatMap((z, i) => [-1, 1].map((s) => <Lamp key={`${s}${z}`} p={[s * (AVE_W + 3.6), 0, z + (s > 0 ? 7 : 0)]} lit={(i + (s > 0 ? 1 : 0)) % 3 === 0} side={s} />))}
      {/* the PODIUM of the shelter tower: drum with pilasters, lit arched windows, entrance arch, roof deck with parapet, then the golden TOWER and the sprinklers */}
      <group position={[0, 0, TOWER_Z]}>
        <Cy p={[0, 11, 0]} r={PODIUM_R - 0.2} h={22} c={C.wall2} ink={0.03} /><Cy p={[0, 1.0, 0]} r={PODIUM_R + 0.5} h={2} c={C.trim} cast={false} /><Cy p={[0, 21.2, 0]} r={18.7} h={1.6} c={C.trim} ink={0.03} />
        <mesh position={[0, 22.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[18.7, 48]} /><primitive object={tm(C.orangeD)} attach="material" /></mesh>
        <mesh position={[0, 22.5, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[18.0, 18.7, 48]} /><primitive object={bm(C.wall3, THREE.DoubleSide)} attach="material" /></mesh>
        <mesh position={[0, 22.55, 0]}><cylinderGeometry args={[18.65, 18.65, 1.1, 48, 1, true]} /><primitive object={tm(C.orangeD, THREE.DoubleSide)} attach="material" /></mesh>
        <mesh position={[0, 23.1, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[18.65, 0.14, 6, 48]} /><primitive object={tm(C.lav)} attach="material" /></mesh>
        <Tower y0={22} />
      </group>
      <group position={[0, 0, 0]}><InstMesh items={ring.map((q) => ({...q, p: [q.p[0], q.p[1], q.p[2]] as V3}))} geo={boxGeo} geoKey="foco-box" /><InstMesh items={arch} geo={boxGeo} geoKey="foco-box" hdr={GOLD_HDR} /></group>
      {/* entrance arch + the door (open leaf) facing the avenue */}
      <group position={[0, 0, DOOR_Z]}><B p={[0, 4.2, -0.3]} s={[7.6, 8.4, 1.4]} c={C.trim} ink={0.02} /><B p={[0, 3.6, 0.45]} s={[5.4, 7.2, 0.3]} c={C.orange} basic cast={false} /><B p={[0, 3.6, 0.52]} s={[4.6, 6.4, 0.3]} c={C.deep} basic cast={false} /><Door p={[0, 0, 0.62]} ry={0} ang={1.0} scale={1.55} /></group>
      <group position={[0, 0, TOWER_Z]}><Sprinklers y0={0} spin={t * 0.7} /></group><RainCurtain t={t} on={rain} cx={0} cz={TOWER_Z} />
      {/* the roof terrace: benches, planters, string lights (gold), a roof hut: only used by the last shots but part of the world */}
      <group position={[0, 22.02, TOWER_Z]}>
        {[0.25, 1.1, 2.0, 2.9].map((a, i) => <group key={i} position={[Math.cos(a + 1.2) * 12.5, 0, Math.sin(a + 1.2) * 12.5]} rotation={[0, -(a + 1.2) - Math.PI / 2, 0]}><B p={[0, 0.45, 0]} s={[2.0, 0.1, 0.5]} c={C.orangeD} ink={0.006} /><B p={[0, 0.2, 0]} s={[1.8, 0.4, 0.4]} c={C.violet} cast={false} /><B p={[0, 0.78, -0.25]} s={[2.0, 0.5, 0.08]} c={C.orangeD} cast={false} /></group>)}
        {Array.from({length: 7}, (_, i) => { const a = (i < 4 ? 2.3 : 3.9) + (i % 4) * 0.45; return <group key={i} position={[Math.cos(a) * 15.8, 0, Math.sin(a) * 15.8]}><Cy p={[0, 0.35, 0]} r={0.5} h={0.7} c={C.trim} ink={0.01} /><Sp p={[0, 0.95, 0]} s={[0.55, 0.45, 0.55]} c={C.purpleL} ink={0.01} /></group>; })}
        {Array.from({length: 22}, (_, i) => { const a = (i / 22) * Math.PI * 2, r = 17.2; return <mesh key={i} position={[Math.cos(a) * r, 2.7 + 0.25 * Math.sin(i * 1.7), Math.sin(a) * r]} material={hdrM('bulb', GOLD_BLOOM)}><sphereGeometry args={[0.1, 6, 5]} /></mesh>; })}
      </group>
      <Motes c={[at[0], 5, at[2]]} f={f} />
    </group>
  );
};

// ================================================================= the HALL (shelter interior)
const paintHallFloor = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#2B2368'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const g = c.createLinearGradient(i * w / 4, j * h / 4, (i + 1) * w / 4, (j + 1) * h / 4); g.addColorStop(0, (i + j) % 2 ? '#34297A' : '#2E256F'); g.addColorStop(1, '#251E5E'); c.fillStyle = g; c.fillRect(i * w / 4 + 2, j * h / 4 + 2, w / 4 - 4, h / 4 - 4); } c.strokeStyle = 'rgba(242,138,60,0.55)'; c.lineWidth = 4; c.strokeRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5); c.strokeStyle = 'rgba(10,8,40,0.6)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } };
const paintBlanket = (a: string, b: string) => (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; for (let i = 0; i < 5; i++) c.fillRect(0, i * h / 5 + 4, w, h / 12); c.strokeStyle = 'rgba(10,8,40,0.35)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); };
export const HALL = {x0: HALL_X - 9, x1: HALL_X + 9, z0: -14, z1: 14, h: 9};
/** SPOTS = where the 16 real (card) sleepers lie: head end at the -x side of the mattress (3 children in a row, 13 adults). Offsets from HALL_X. */
export const SPOTS: {p: V3; ry: number; kid: boolean}[] = [[-3.0, -6.2, 1], [-3.0, -5.4, 1], [-3.0, -4.6, 1], [-6.2, -8.2, 0], [-6.2, -5.2, 0], [-6.2, -2.2, 0], [0, -8.4, 0], [0, -5.4, 0], [0, -2.4, 0], [3.2, -8.2, 0], [3.2, -5.2, 0], [3.2, -2.2, 0], [6.4, -7.0, 0], [6.4, -4.0, 0], [-3.0, -2.6, 0], [3.2, 0.8, 0]].map(([x, z, k]) => ({p: [HALL_X + x, 0, z] as V3, ry: Math.PI / 2, kid: !!k}));
/** Further blankets (grid rows, seeded jitter) that carry the instanced sleeper cards. */
export const BLANKETS: {p: V3; ry: number; k: number; kid: boolean}[] = (() => { const o: {p: V3; ry: number; k: number; kid: boolean}[] = []; let n = 0; for (let row = 0; row < 10; row++) for (let col = 0; col < 9; col++) { n++; if (col === 4) continue; const x = HALL_X - 7.6 + col * 1.9 + (hash(n, 41) - 0.5) * 0.25, z = -11.2 + row * 2.4 + (hash(n, 42) - 0.5) * 0.25; if (SPOTS.some((q) => Math.hypot(q.p[0] - x, q.p[2] - z) < 1.9)) continue; o.push({p: [x, 0, z], ry: Math.PI / 2 + (hash(n, 43) - 0.5) * 0.2, k: n % 5, kid: hash(n, 44) < 0.25}); } return o; })();
const paintCard = (v: number) => (c: CanvasRenderingContext2D, w: number, h: number) => { // a person wrapped in a blanket, head and shoulders, closed eyes (white card, ink outline; palette blanket)
  const cols = [C.purpleL, C.orange, C.coral, C.trim, C.lav, C.orangeD], hair = ['#2A1B3A', '#5A3A32', '#C9C4EE', '#6A3A2A', '#1A1230', '#7A5A44'], hx = w * (0.5 + 0.06 * Math.sin(v * 2.1)), hy = h * 0.34, r = w * 0.2;
  c.lineJoin = 'round'; c.strokeStyle = '#120A14'; c.lineWidth = 5; c.fillStyle = cols[v % cols.length]; c.beginPath(); c.moveTo(w * 0.1, h); c.quadraticCurveTo(w * 0.1, h * 0.58, w * 0.38, h * 0.55); c.lineTo(w * 0.62, h * 0.55); c.quadraticCurveTo(w * 0.9, h * 0.58, w * 0.9, h); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = cols[(v + 2) % cols.length]; c.fillRect(w * 0.12, h * 0.74, w * 0.76, h * 0.08);
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(hx, hy, r * 0.95, r * 1.1, 0.12 * Math.sin(v), 0, 7); c.fill(); c.stroke();
  c.fillStyle = hair[v % hair.length]; c.beginPath(); c.ellipse(hx, hy - r * 0.55, r * 1.0, r * 0.62, 0, Math.PI, 0); c.fill(); c.stroke(); if (v % 3 === 1) { c.beginPath(); c.arc(hx + r * 0.2, hy - r * 1.35, r * 0.34, 0, 7); c.fill(); c.stroke(); }
  c.lineWidth = 4; c.beginPath(); c.arc(hx - r * 0.42, hy + r * 0.05, r * 0.2, 0.15, Math.PI - 0.15); c.stroke(); c.beginPath(); c.arc(hx + r * 0.42, hy + r * 0.05, r * 0.2, 0.15, Math.PI - 0.15); c.stroke(); c.beginPath(); c.moveTo(hx - r * 0.18, hy + r * 0.55); c.lineTo(hx + r * 0.18, hy + r * 0.55); c.stroke();
};
/** Instanced sleeper / sitter cards (white heads, closed eyes): 6 variants, each one InstancedMesh, turned toward the camera every frame (matrices rewritten in place). */
export interface CardSpot {p: V3; w: number; h: number; v: number}
export const CROWD_CARDS: CardSpot[] = (() => { const o: CardSpot[] = []; BLANKETS.forEach((b, i) => { const k = b.kid ? 0.7 : 1; o.push({p: [b.p[0] - 0.9 * k, 0.45 * k, b.p[2]], w: 0.95 * k, h: 1.1 * k, v: i}); if (!b.kid && i % 2 === 0) o.push({p: [b.p[0] + 0.85, 0.42, b.p[2] + 0.5], w: 0.8, h: 0.95, v: i + 3}); }); for (let i = 0; i < 18; i++) for (const sd of [-1, 1]) o.push({p: [HALL_X + sd * (8.15 - (i % 2) * 0.5), 0.62, -11 + i * 1.3 + (hash(i * 2 + sd, 45) - 0.5) * 0.3], w: 0.9, h: 1.1, v: i + (sd > 0 ? 2 : 0)}); for (let i = 0; i < 22; i++) o.push({p: [HALL_X - 8 + i * 0.74, 5.35, 11.9], w: 0.85, h: 1.0, v: i}); return o; })();
const BLANKET_COL = [C.purpleL, C.orange, C.coral, C.trim, C.lav];
/** All mattresses in 3 instanced meshes (body, accent stripe, pillow): 16 real sleeper spots + the grid that carries the instanced cards. */
const BlanketField: React.FC = () => {
  const {body, stripe, pillow} = useMemo(() => { const body: Inst[] = [], stripe: Inst[] = [], pillow: Inst[] = []; [...SPOTS.map((q, i) => ({p: q.p, ry: q.ry, k: i, kid: q.kid})), ...BLANKETS].forEach((b, i) => { const k = b.kid ? 0.7 : 1, c = Math.cos(b.ry), sn = Math.sin(b.ry), at = (lx: number, lz: number): V3 => [b.p[0] + lx * c + lz * sn, 0, b.p[2] - lx * sn + lz * c]; body.push({p: [...at(0, 0.1 * k).slice(0, 1), 0.1, at(0, 0.1 * k)[2]] as V3, s: [0.8 * k, 0.18, 1.7 * k], c: BLANKET_COL[(b.k + i) % 5], r: [0, b.ry, 0]}); for (const o of [-0.35, 0.15, 0.55]) { const q = at(0, o * k); stripe.push({p: [q[0], 0.195, q[2]], s: [0.82 * k, 0.025, 0.12 * k], c: BLANKET_COL[(b.k + i + 2) % 5] === C.lav ? C.cream : C.violet, r: [0, b.ry, 0]}); } const q = at(0, -0.82 * k); pillow.push({p: [q[0], 0.18, q[2]], s: [0.26 * k, 0.1, 0.2 * k], c: C.cream, r: [0, b.ry, 0]}); }); return {body, stripe, pillow}; }, []);
  return <group><InstMesh items={body} geo={boxGeo} geoKey="foco-box" cast /><InstMesh items={stripe} geo={boxGeo} geoKey="foco-box" /><InstMesh items={pillow} geo={() => new THREE.SphereGeometry(1, 10, 8)} geoKey="foco-sph10" /></group>;
};
const CardCrowd: React.FC<{cam: V3}> = ({cam}) => {
  const R_ = useMemo(() => { const tex = Array.from({length: 6}, (_, v) => mt('card' + v, 128, 160, paintCard(v))), groups: CardSpot[][] = [[], [], [], [], [], []]; CROWD_CARDS.forEach((c) => groups[c.v % 6].push(c)); const geo = shared('foco-plane', () => new THREE.PlaneGeometry(1, 1)); const meshes = groups.map((g, v) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({map: tex[v], transparent: true, alphaTest: 0.2, toneMapped: false, side: THREE.DoubleSide}), Math.max(1, g.length)); m.frustumCulled = false; m.count = g.length; return m; }); return {groups, meshes, o: new THREE.Object3D()}; }, []);
  R_.groups.forEach((g, v) => { g.forEach((c, i) => { const yaw = Math.atan2(cam[0] - c.p[0], cam[2] - c.p[2]); R_.o.position.set(c.p[0], c.p[1] + 0.0, c.p[2]); R_.o.rotation.set(0, yaw, 0); R_.o.scale.set(c.w, c.h, 1); R_.o.updateMatrix(); R_.meshes[v].setMatrixAt(i, R_.o.matrix); }); R_.meshes[v].instanceMatrix.needsUpdate = true; });
  return <group>{R_.meshes.map((m, i) => <primitive key={i} object={m} />)}</group>;
};
export const Hall: React.FC<{f: number; t: number; at?: V3; ss?: number; doorAng?: number; cam?: V3}> = ({f, t, at = [HALL_X, 0, 0], ss = 2048, doorAng = 1.0, cam = [HALL_X, 3, 8]}) => {
  const floor = useMemo(() => mt('hallfloor', 512, 512, paintHallFloor, [4, 7]), []), bl = useMemo(() => [[C.purpleL, C.cream], [C.orange, C.violet], [C.coral, C.lav], [C.trim, C.gold], [C.lav, C.purple]].map(([a, b], i) => mt('blanket' + i, 64, 64, paintBlanket(a, b))), []);
  const cols = useMemo<Inst[]>(() => [-1, 1].flatMap((s) => Array.from({length: 7}, (_, i) => ({p: [HALL_X + s * 6.2, 3.6, -11 + i * 4] as V3, s: [0.95, 7.2, 0.95] as V3, c: C.trim}))), []);
  const caps = useMemo<Inst[]>(() => [-1, 1].flatMap((s) => Array.from({length: 7}, (_, i) => ({p: [HALL_X + s * 6.2, 7.4, -11 + i * 4] as V3, s: [1.3, 0.5, 1.3] as V3, c: C.wall3}))), []);
  const beams = useMemo<Inst[]>(() => Array.from({length: 8}, (_, i) => ({p: [HALL_X, 8.4, -12 + i * 3.4] as V3, s: [18.2, 0.5, 0.6] as V3, c: C.trim})), []);
  const wins = useMemo<Inst[]>(() => [-1, 1].flatMap((s) => Array.from({length: 6}, (_, i) => ({p: [HALL_X + s * 8.9, 6.0, -10 + i * 4] as V3, s: [0.2, 2.6, 1.6] as V3, c: C.purple}))), []);
  const jars = useMemo<Inst[]>(() => Array.from({length: 26}, (_, i) => ({p: [HALL_X + 7.9, 1.3 + (i % 3) * 0.55, 3 + Math.floor(i / 3) * 0.55] as V3, s: [0.16, 0.26, 0.16] as V3, c: [C.cream, C.orange, C.gold, C.lav][i % 4]})), []);
  return (
    <group>
      <SceneFog near={30} far={90} />
      <FocoLights ss={ss} at={at} ext={16} inner />
      <Pl p={[HALL_X, 0, 0]} w={18} h={28} map={floor} c="#fff" rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[HALL_X, 9, 0]} w={18} h={28} c={C.wall2} rot={[Math.PI / 2, 0, 0]} recv={false} />
      <Pl p={[HALL_X - 9, 4.5, 0]} w={28} h={9} c={C.wall1} rot={[0, Math.PI / 2, 0]} recv={false} /><Pl p={[HALL_X + 9, 4.5, 0]} w={28} h={9} c={C.wall1} rot={[0, -Math.PI / 2, 0]} recv={false} />
      <Pl p={[HALL_X, 4.5, 14]} w={18} h={9} c={C.wall1} rot={[0, Math.PI, 0]} recv={false} /><Pl p={[HALL_X, 4.5, -14]} w={18} h={9} c={C.wall1} rot={[0, 0, 0]} recv={false} />
      <InstMesh items={cols} geo={cylGeo} geoKey="foco-cyl10" cast /><InstMesh items={caps} geo={boxGeo} geoKey="foco-box" /><InstMesh items={beams} geo={boxGeo} geoKey="foco-box" />
      <InstMesh items={wins} geo={boxGeo} geoKey="foco-box" hdr={new THREE.Color(0.7, 0.45, 1.5)} />
      <B p={[HALL_X - 8.8, 1.1, 6]} s={[0.6, 2.2, 8]} c={C.wall3} ink={0.01} /><InstMesh items={jars} geo={cylGeo} geoKey="foco-cyl10" />
      {/* long supply tables with bread and bowls (designed props) */}
      {[-3.6, 3.6].map((x) => <group key={x} position={[HALL_X + x, 0, 9.5]}><B p={[0, 0.8, 0]} s={[2.2, 0.1, 5.4]} c={C.orangeD} ink={0.01} />{[-2.4, 2.4].map((z) => [-0.9, 0.9].map((q) => <B key={`${z}${q}`} p={[q, 0.4, z]} s={[0.12, 0.8, 0.12]} c={C.violet} cast={false} />))}{Array.from({length: 6}, (_, i) => <Sp key={i} p={[(i % 2 - 0.5) * 0.8, 0.95, -2.0 + i * 0.8]} s={[0.22, 0.12, 0.3]} c={i % 3 ? C.gold : C.cream} ink={0.006} />)}</group>)}
      {/* hanging lamps with warm HDR glow and cords */}
      {[-9, -3, 3, 9].flatMap((z) => [-3.5, 3.5].map((x) => <group key={`${x}${z}`} position={[HALL_X + x, 0, z]}><Cy p={[0, 8.0, 0]} r={0.015} h={1.9} c={C.deep} cast={false} /><mesh position={[0, 6.9, 0]} material={hdrM('hall-lamp', new THREE.Color(2.6, 1.7, 0.7))}><sphereGeometry args={[0.38, 10, 8]} /></mesh><pointLight position={[0, 6.6, 0]} color="#F7C65A" intensity={42} distance={13} decay={2} /></group>))}
      <BlanketField />
      <CardCrowd cam={cam} />
      {/* the heavy door at the -z end (seen from inside), with its wall opening */}
      {[[-3.55, 3.9], [3.55, 3.9]].map(([x, w]) => <B key={x} p={[HALL_X + x, 4.5, -13.8]} s={[w, 9, 0.4]} c={C.wall3} ink={0.01} />)}<B p={[HALL_X, 7.0, -13.8]} s={[3.5, 4.0, 0.4]} c={C.wall3} ink={0.01} /><mesh position={[HALL_X, 2.5, -14.1]}><planeGeometry args={[3.4, 5]} /><meshBasicMaterial color={C.orange} toneMapped={false} /></mesh><mesh position={[HALL_X, 2.5, -14.0]}><planeGeometry args={[3.4, 5]} /><meshBasicMaterial color={C.indigo} transparent opacity={0.55} toneMapped={false} /></mesh><Door p={[HALL_X, 0, -13.5]} ry={0} ang={doorAng} scale={1.5} />
      <Motes c={[at[0], 4, at[2]]} ext={[16, 6, 24]} f={f} /><mesh position={[HALL_X, 4.5, 13.9]} rotation={[0, Math.PI, 0]}><planeGeometry args={[7, 4]} /><meshBasicMaterial color={C.wall1} /></mesh>
    </group>
  );
};
