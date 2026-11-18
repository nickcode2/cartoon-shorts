// SHOPPING_CART sets. SUPERMARKET = new reusable kit set (1930s grocery, bright). WORKSHOP = the existing GARAGE set plus a workbench with tools.
// Coordinates: metres, x right, y up, cameras look toward -z. Hall x -5.2..5.2, z -9 (entrance wall, glass door, street outside) .. +16 (back wall), ceiling 3.8.
//   floor      teal / mint checker (0.5 m checks), painted gradient inside each check, cream inlay lines along the lane, soft AO bands at the shelf bases, worn centre path
//   walls      cream plaster, mint beadboard wainscot, thin teal frieze; left wall has clerestory windows (sun comes through them: light patches + shafts + dust in ShopFx)
//   shelves    two gondola rows (x = -2.7, +2.7) broken by gaps with pillars; wall shelves; ~4000 instanced cans / boxes with painted labels (no words)
//   register   counter on the right (x 3.55..4.45, z -5.6..-2.0) with a brass register, candy jars, a scale; shelves behind it
//   entrance   glass double door, tall windows, awning; the street outside (road, opposite shop fronts, cars, lamp posts, sky and clouds)
// Everything is built once per mount (useMemo), unit geometry + scale, repeats are instanced (BoxField / InstancedMesh). No per-frame allocation.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex, Sky, shared} from '../kit/kit';
import {B, BoxField, BoxInst, Cy, Line3, Pl, Sp, bm, onString, tm} from '../cobra/common';
import {Clouds, Garage} from '../cobra/sets';
import {BRASS, Bills, RED, WOOD, WOOD_D, Apple, Crate, Register} from './props';

export const HALL = {x0: -5.2, x1: 5.2, z0: -9, z1: 16, h: 3.8};
const TEAL = '#2FA7A0', MINT = '#BFEBDD', CREAM = '#F6E8C8', MUST = '#E8B23A';
const PALETTE = ['#E0302A', '#E8B23A', '#2FA7A0', '#F6E8C8', '#3FA7C9', '#8E6BBF', '#E8742A', '#9CCB4A', '#D8342A', '#F2C25A'];

// ---------------------------------------------------------------- lights
export const ShopLights: React.FC<{ss?: number}> = ({ss = 2048}) => (
  <>
    <hemisphereLight args={['#FFF3D6', '#8A6A50', 2.2]} />
    <directionalLight color="#FFE2B0" intensity={1.7} position={[-6, 9, 5]} castShadow shadow-mapSize={[ss, ss]} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={11} shadow-camera-bottom={-11} shadow-camera-near={1} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.02} />
  </>
);

// ---------------------------------------------------------------- textures (painted once per mount)
const paintFloor = (c: CanvasRenderingContext2D, w: number, h: number) => { // 2 x 2 checks = 1 m; each check has its own painted gradient, soft worn edge and a hairline grout
  const n = 2, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dark = (i + j) % 2 === 0, x = i * s, y = j * s, g = c.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, dark ? '#38B5AC' : '#D2F3E6'); g.addColorStop(1, dark ? '#278F8A' : '#A9E0CE'); c.fillStyle = g; c.fillRect(x, y, s, s);
    const r = c.createRadialGradient(x + s * 0.38, y + s * 0.34, 0, x + s * 0.5, y + s * 0.5, s * 0.75); r.addColorStop(0, 'rgba(255,255,255,0.16)'); r.addColorStop(1, 'rgba(0,40,40,0.10)'); c.fillStyle = r; c.fillRect(x, y, s, s);
    for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(${dark ? '10,70,70' : '255,255,255'},${0.05 + hash(k + i * 7 + j * 13, 3) * 0.07})`; c.beginPath(); c.arc(x + hash(k, 5 + i * 3 + j) * s, y + hash(k, 9 + j * 5 + i) * s, 2 + hash(k, 2) * 4, 0, 7); c.fill(); }
  }
  c.strokeStyle = 'rgba(20,80,78,0.55)'; c.lineWidth = 3; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke(); c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
};
const paintFloorShade = (c: CanvasRenderingContext2D, w: number, h: number) => { // overlay for the WHOLE floor (canvas x 0..w = x -5.5..5.5, y 0..h = z -9..16): shelf-base AO, inlay lines, worn path, far-end fade
  const X = (x: number) => ((x + 5.5) / 11) * w, Z = (z: number) => ((z + 9) / 25) * h;
  c.clearRect(0, 0, w, h);
  for (const sx of [-1, 1]) { // dark AO bands along both gondola rows and both walls
    for (const [a, b, al] of [[2.3, 1.85, 0.0], [2.3, 2.6, 0.34], [3.1, 3.4, 0.34], [3.1, 2.85, 0.0], [4.6, 5.0, 0.30], [4.45, 4.6, 0.0]] as [number, number, number][]) { const g = c.createLinearGradient(X(sx * a), 0, X(sx * b), 0); g.addColorStop(0, `rgba(10,45,50,${al})`); g.addColorStop(1, `rgba(10,45,50,${al ? 0 : 0.34})`); c.fillStyle = g; c.fillRect(Math.min(X(sx * a), X(sx * b)), 0, Math.abs(X(sx * a) - X(sx * b)), h); }
    c.fillStyle = 'rgba(246,232,200,0.92)'; c.fillRect(X(sx * 2.05) - 5, 0, 10, h); // cream inlay line along the lane
    c.fillStyle = 'rgba(224,48,42,0.9)'; c.fillRect(X(sx * 1.92) - 2.5, 0, 5, h); // thin red inner line
  }
  const g = c.createLinearGradient(X(-1.5), 0, X(1.5), 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,248,220,0.17)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(X(-1.5), 0, X(1.5) - X(-1.5), h); // worn centre path
  const f = c.createLinearGradient(0, Z(-9), 0, Z(16)); f.addColorStop(0, 'rgba(255,240,200,0.0)'); f.addColorStop(0.6, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(10,50,60,0.38)'); c.fillStyle = f; c.fillRect(0, 0, w, h);
};
const paintWall = (c: CanvasRenderingContext2D, w: number, h: number) => { // 2 m x 3.8 m
  const y = (m: number) => h - (m / 3.8) * h;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FBEFD2'); g.addColorStop(0.5, CREAM); g.addColorStop(1, '#EAD6AE'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(150,110,60,${0.03 + hash(i, 1) * 0.04})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * y(1.2), 8 + hash(i, 4) * 20, 3 + hash(i, 5) * 6, hash(i, 6), 0, 7); c.fill(); } // plaster mottling
  const wg = c.createLinearGradient(0, y(1.1), 0, h); wg.addColorStop(0, '#A9E3D1'); wg.addColorStop(1, '#7FCBB8'); c.fillStyle = wg; c.fillRect(0, y(1.1), w, h - y(1.1)); // mint wainscot
  c.strokeStyle = 'rgba(30,110,100,0.35)'; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo((i / 8) * w, y(1.1)); c.lineTo((i / 8) * w, h); c.stroke(); } // beadboard grooves
  c.fillStyle = '#F8F1DC'; c.fillRect(0, y(1.17), w, (0.07 / 3.8) * h); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y(1.1) - 2, w, 3); // rail + shadow
  c.fillStyle = '#6B3F22'; c.fillRect(0, y(0.1), w, (0.1 / 3.8) * h); // base moulding
  c.fillStyle = TEAL; c.fillRect(0, y(3.35), w, (0.1 / 3.8) * h); c.fillStyle = MUST; c.fillRect(0, y(3.42), w, (0.04 / 3.8) * h); // frieze: teal band + thin mustard line
};
const paintCan = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#C9C9C9'; c.fillRect(0, 0, w, h * 0.14); c.fillRect(0, h * 0.86, w, h * 0.14); c.fillStyle = '#8A8A8A'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.24, 0, 7); c.fill(); c.fillStyle = '#E8E8E8'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.14, 0, 7); c.fill(); c.fillStyle = '#6A6A6A'; c.beginPath(); c.ellipse(w / 2 + 6, h / 2 - h * 0.2, 8, 4, 0.6, 0, 7); c.fill(); c.fillRect(w * 0.1, h * 0.2, w * 0.8, 3); };
const paintBox = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#B5B5B5'; c.fillRect(0, h * 0.78, w, h * 0.22); c.fillStyle = '#8A8A8A'; c.beginPath(); c.ellipse(w / 2, h * 0.42, w * 0.28, h * 0.22, 0, 0, 7); c.fill(); c.fillStyle = '#E4E4E4'; c.beginPath(); c.ellipse(w / 2 - 6, h * 0.38, w * 0.12, h * 0.1, 0.4, 0, 7); c.fill(); c.fillStyle = '#6A6A6A'; c.fillRect(w * 0.12, h * 0.1, w * 0.76, 4); c.fillRect(w * 0.12, h * 0.18, w * 0.5, 3); };
const paintIcon = (kind: number) => (c: CanvasRenderingContext2D, w: number, h: number) => { // hanging category boards: a painted picture, no words
  c.fillStyle = ['#2FA7A0', '#E8742A', '#3FA7C9', '#8E6BBF'][kind]; c.fillRect(0, 0, w, h); c.strokeStyle = '#F6E8C8'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = '#F6E8C8'; c.strokeStyle = '#231A28'; c.lineWidth = 5; const cx = w / 2, cy = h / 2;
  if (kind === 0) { c.fillStyle = '#E0302A'; c.beginPath(); c.arc(cx, cy + 6, h * 0.28, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#4FA24A'; c.beginPath(); c.ellipse(cx + 14, cy - h * 0.26, 16, 7, -0.5, 0, 7); c.fill(); c.stroke(); } // apple
  else if (kind === 1) { c.fillStyle = '#D9A24A'; c.beginPath(); c.ellipse(cx, cy, w * 0.3, h * 0.2, 0, 0, 7); c.fill(); c.stroke(); for (const d of [-0.12, 0, 0.12]) { c.beginPath(); c.moveTo(cx + d * w - 8, cy - 14); c.lineTo(cx + d * w + 8, cy + 14); c.stroke(); } } // loaf
  else if (kind === 2) { c.fillStyle = '#BFEBDD'; c.beginPath(); c.ellipse(cx - 6, cy, w * 0.27, h * 0.17, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(cx + w * 0.2, cy); c.lineTo(cx + w * 0.34, cy - 18); c.lineTo(cx + w * 0.34, cy + 18); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#231A28'; c.beginPath(); c.arc(cx - w * 0.2, cy - 4, 4, 0, 7); c.fill(); } // fish
  else { c.fillStyle = '#F6E8C8'; c.beginPath(); c.moveTo(cx - 14, cy + h * 0.3); c.lineTo(cx - 14, cy - 4); c.lineTo(cx - 6, cy - h * 0.2); c.lineTo(cx - 6, cy - h * 0.32); c.lineTo(cx + 6, cy - h * 0.32); c.lineTo(cx + 6, cy - h * 0.2); c.lineTo(cx + 14, cy - 4); c.lineTo(cx + 14, cy + h * 0.3); c.closePath(); c.fill(); c.stroke(); } // bottle
};

// ---------------------------------------------------------------- stock: instanced cans and boxes with painted labels on every shelf
interface Slot {x: number; y: number; z: number; face: 1 | -1}
function shelfSlots(): {cans: BoxInst[]; boxes: BoxInst[]; boards: BoxInst[]; frames: BoxInst[]} {
  const o = {cans: [] as BoxInst[], boxes: [] as BoxInst[], boards: [] as BoxInst[], frames: [] as BoxInst[]};
  let n = 0;
  const run = (x: number, z0: number, z1: number, depth: number, hh: number, faces: (1 | -1)[], wallBack: boolean) => {
    const levels = Math.round(hh / 0.42), len = z1 - z0, cz = (z0 + z1) / 2;
    o.frames.push({p: [x, hh / 2, cz], s: [depth, hh, len], c: WOOD_D}); // core (kick + back)
    o.frames.push({p: [x, 0.07, cz], s: [depth + 0.04, 0.14, len + 0.04], c: '#5A3A22'});
    o.frames.push({p: [x, hh + 0.03, cz], s: [depth + 0.06, 0.06, len + 0.06], c: WOOD});
    for (const fc of faces) for (let l = 0; l < levels; l++) {
      const y = 0.2 + l * 0.42, fx = x + fc * (depth / 2 + (wallBack ? 0 : 0.0));
      o.boards.push({p: [x + fc * (depth / 2 + 0.11), y - 0.02, cz], s: [0.28, 0.035, len], c: WOOD}); // shelf board sticking out of the core
      o.boards.push({p: [x + fc * (depth / 2 + 0.24), y + 0.02, cz], s: [0.02, 0.1, len], c: '#F6E8C8'}); // price strip (blank)
      void fx;
      for (let z = z0 + 0.12; z < z1 - 0.1; ) {
        const k = n++, t = hash(k, 4), col = PALETTE[Math.floor(hash(k, 7) * PALETTE.length)], px = x + fc * (depth / 2 + 0.1), w = 0.1 + hash(k, 8) * 0.04;
        if (t < 0.55) { o.cans.push({p: [px, y + 0.075, z + w / 2], s: [0.09, 0.13 + hash(k, 5) * 0.03, 0.09], c: col}); z += 0.1; }
        else { o.boxes.push({p: [px, y + 0.09, z + w / 2], s: [0.1, 0.17 + hash(k, 5) * 0.05, w], c: col, ry: fc > 0 ? 0 : 0}); z += w + 0.012; }
        if (hash(k, 11) < 0.04) z += 0.08;
      }
    }
  };
  const segsL: [number, number][] = [[-6.2, -1.2], [0.2, 5.2], [6.6, 11.6], [13, 15.6]], segsR: [number, number][] = [[0.2, 5.2], [6.6, 11.6], [13, 15.6]];
  for (const [a, b] of segsL) run(-2.7, a, b, 0.5, 1.68, [1, -1], false);
  for (const [a, b] of segsR) run(2.7, a, b, 0.5, 1.68, [1, -1], false);
  run(-4.95, -8.4, 15.6, 0.3, 2.1, [1], true); run(4.95, -8.4, -5.8, 0.3, 2.1, [-1], true); run(4.95, -1.8, 15.6, 0.3, 2.1, [-1], true);
  run(4.95, -5.8, -1.8, 0.3, 2.1, [-1], true); // behind the counter
  return o;
}
const StockField: React.FC<{items: BoxInst[]; geo: 'can' | 'box'}> = ({items, geo}) => {
  const tex = useMemo(() => makeTex(128, 128, geo === 'can' ? paintCan : paintBox), [geo]);
  const mesh = useMemo(() => {
    const g = geo === 'can' ? shared('shop-can', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14)) : shared('shop-box', () => new THREE.BoxGeometry(1, 1, 1));
    const mat = new THREE.MeshToonMaterial({map: tex, gradientMap: (tm('#fff') as THREE.MeshToonMaterial).gradientMap}); mat.defines = {PAINTED_SHADOWS: ''};
    const m = new THREE.InstancedMesh(g, mat, Math.max(1, items.length)), o = new THREE.Object3D(), col = new THREE.Color();
    items.forEach((it, i) => { o.position.set(...it.p); o.scale.set(...it.s); o.rotation.set(0, geo === 'can' ? hash(i, 3) * 6 : (it.p[0] > 0 ? Math.PI / 2 : -Math.PI / 2), 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.set(it.c)); });
    m.count = items.length; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; return m;
  }, [items, geo, tex]);
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------- the street outside (seen through the glass wall and the door)
const Outside: React.FC = () => {
  const bodies = useMemo<BoxInst[]>(() => {
    const o: BoxInst[] = [], cols = ['#E8B27A', '#F0C48E', '#DDA066', '#E9A678', '#F2D3A0', '#C9D8A8', '#E8C9A0'];
    for (let i = 0; i < 18; i++) { const w = 4 + hash(i, 1) * 3, h = 4 + hash(i, 2) * 4, x = -48 + i * 5.6 + hash(i, 3); o.push({p: [x, h / 2, -30], s: [w, h, 6], c: cols[i % cols.length]}); o.push({p: [x, h + 0.15, -30], s: [w + 0.3, 0.3, 6.3], c: '#C65A3A'}); for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) o.push({p: [x - w * 0.22 + q * w * 0.44, 1.7 + r * 1.9, -26.95], s: [0.9, 1.1, 0.1], c: '#CFE6EE'}); o.push({p: [x, 0.9, -26.95], s: [1.1, 1.8, 0.1], c: ['#2FA7A0', '#8A5A3A', '#E0302A'][i % 3]}); }
    for (let i = 0; i < 26; i++) { const h = 8 + hash(i, 9) * 22; o.push({p: [-120 + i * 9.5, h / 2, -80 - hash(i, 4) * 40], s: [8, h, 8], c: '#C9D6D8'}); }
    return o;
  }, []);
  const road = useMemo(() => makeTex(256, 256, (c, w, h) => { c.fillStyle = '#B9A58E'; c.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(110,80,60,${0.05 + hash(i, 1) * 0.08})`; c.beginPath(); c.ellipse(hash(i, 2) * w, hash(i, 3) * h, 4 + hash(i, 4) * 10, 2 + hash(i, 5) * 5, hash(i, 6) * 3, 0, 7); c.fill(); } c.fillStyle = '#F6E8C8'; for (let i = 0; i < 4; i++) c.fillRect(i * 64 + 6, h / 2 - 3, 36, 6); }, [8, 8]), []);
  const car = (x: number, z: number, c: string, ry = 0) => (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <B p={[0, 0.55, 0]} s={[1.7, 0.6, 3.6]} c={c} ink={0.02} /><B p={[0, 1.08, -0.1]} s={[1.5, 0.5, 1.8]} c={c} ink={0.02} /><B p={[0, 1.1, -0.1]} s={[1.52, 0.34, 1.6]} c="#CFE6EE" basic cast={false} />
      {[[-0.85, -1.2], [0.85, -1.2], [-0.85, 1.2], [0.85, 1.2]].map(([a, b], i) => <Cy key={i} p={[a, 0.3, b]} r={0.32} h={0.22} c="#2B2630" rot={[0, 0, Math.PI / 2]} ink={0.01} />)}
      <Sp p={[-0.5, 0.65, -1.82]} s={[0.15, 0.15, 0.08]} c="#FFF3C8" basic cast={false} /><Sp p={[0.5, 0.65, -1.82]} s={[0.15, 0.15, 0.08]} c="#FFF3C8" basic cast={false} />
    </group>
  );
  return (
    <group>
      <Sky top="#4FB4E0" bottom="#CDEFF5" r={200} /><Clouds />
      <Pl p={[0, -0.01, -60]} w={400} h={120} c="#B98E65" rot={[-Math.PI / 2, 0, 0]} recv={false} />
      <Pl p={[0, 0.0, -10.6]} w={400} h={3.2} c="#E6D3B0" rot={[-Math.PI / 2, 0, 0]} /> {/* pavement */}
      <Pl p={[0, 0.002, -17.2]} w={400} h={10} c="#fff" map={road} rot={[-Math.PI / 2, 0, 0]} />
      <Pl p={[0, 0.0, -24.3]} w={400} h={3.6} c="#E6D3B0" rot={[-Math.PI / 2, 0, 0]} />
      <BoxField items={bodies} cast={false} />
      {car(-3.5, -15.2, '#E0302A')}{car(5, -19, '#2F7FD0', Math.PI)}{car(-14, -19, '#E8B23A', Math.PI)}
      {[-7, 6, 18].map((x) => <group key={x} position={[x, 0, -11.8]}><Cy p={[0, 1.7, 0]} r={0.06} h={3.4} c="#3E4A52" ink={0.012} /><Sp p={[0, 3.5, 0]} s={[0.22, 0.22, 0.22]} c="#FFF3C8" basic cast={false} /></group>)}
      <group position={[-9, 0, -11]}><Cy p={[0, 1.2, 0]} r={0.22} h={2.4} c="#7A4A2A" ink={0.02} /><Sp p={[0, 3.2, 0]} s={[1.6, 1.3, 1.6]} c="#4FA24A" ink={0.03} /><Sp p={[0.9, 2.8, 0.3]} s={[1.0, 0.8, 1.0]} c="#5DB65A" ink={0.03} /></group>
    </group>
  );
};

// ---------------------------------------------------------------- the SUPERMARKET
export const Supermarket: React.FC<{regDrawer?: number; regCrank?: number}> = ({regDrawer = 0, regCrank = 0}) => {
  const floor = useMemo(() => makeTex(512, 512, paintFloor, [11, 25]), []), shade = useMemo(() => makeTex(512, 2048, paintFloorShade), []);
  const wall = useMemo(() => makeTex(256, 486, paintWall, [13, 1]), []), wallE = useMemo(() => makeTex(256, 486, paintWall, [6, 1]), []), icons = useMemo(() => [0, 1, 2, 3].map((k) => makeTex(128, 96, paintIcon(k))), []);
  const stock = useMemo(shelfSlots, []);
  const lampZ = useMemo(() => Array.from({length: 9}, (_, i) => -7 + i * 2.9), []);
  const pennants = useMemo<BoxInst[]>(() => {
    const out: BoxInst[] = [], cols = ['#E0302A', '#E8B23A', '#2FA7A0', '#F6E8C8', '#3FA7C9'], rows: [number, number, number][] = [[-6.2, 3.35, 0.55], [3.6, 3.3, 0.55], [11, 3.35, 0.55]];
    for (const [z, y, sag] of rows) for (let i = 0; i < 17; i++) { const t = (i + 0.5) / 17, q = onString([-5.1, y, z], [5.1, y, z], sag, t); out.push({p: [q[0], q[1] - 0.15, q[2]], s: [0.26, 0.3, 0.02], c: cols[i % cols.length], rz: Math.PI / 4 + (t - 0.5) * -0.3}); }
    return out;
  }, []);
  const wins = useMemo<BoxInst[]>(() => { const o: BoxInst[] = []; for (let i = 0; i < 8; i++) { const z = -6.2 + i * 3.1; o.push({p: [-5.18, 2.85, z], s: [0.08, 1.15, 2.2], c: '#F6E8C8'}, {p: [-5.12, 2.85, z], s: [0.04, 0.95, 2.0], c: '#E3F4FF'}, {p: [-5.1, 2.85, z], s: [0.05, 0.95, 0.06], c: '#F6E8C8'}, {p: [-5.1, 2.85, z - 0.5], s: [0.05, 0.95, 0.05], c: '#F6E8C8'}, {p: [-5.1, 2.85, z + 0.5], s: [0.05, 0.95, 0.05], c: '#F6E8C8'}, {p: [-5.1, 2.85, z], s: [0.05, 0.05, 2.0], c: '#F6E8C8'}); } return o; }, []);
  const jars = useMemo<BoxInst[]>(() => Array.from({length: 7}, (_, i) => ({p: [3.15, 1.14, -5.35 + i * 0.22] as V3, s: [0.14, 0.2, 0.14] as V3, c: PALETTE[(i * 3) % PALETTE.length]})), []);
  return (
    <group>
      <Outside />
      {/* floor + overlay, ceiling */}
      <Pl p={[0, 0, 3.5]} w={11} h={25} map={floor} c="#fff" rot={[-Math.PI / 2, 0, 0]} />
      <mesh position={[0, 0.004, 3.5]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}><planeGeometry args={[11, 25]} /><meshBasicMaterial map={shade} transparent depthWrite={false} toneMapped={false} /></mesh>
      <Pl p={[0, 3.8, 3.5]} w={11} h={25} c="#FFF1D2" rot={[Math.PI / 2, 0, 0]} recv={false} />
      {Array.from({length: 9}, (_, i) => <B key={i} p={[0, 3.66, -7.5 + i * 2.9]} s={[10.6, 0.28, 0.34]} c="#E9D2A4" cast={false} ink={0.008} />)}
      {Array.from({length: 9}, (_, i) => <B key={`t${i}`} p={[0, 3.5, -7.5 + i * 2.9]} s={[10.6, 0.06, 0.38]} c={TEAL} cast={false} />)}
      {/* walls */}
      <Pl p={[-5.2, 1.9, 3.5]} w={25} h={3.8} map={wall} c="#fff" rot={[0, Math.PI / 2, 0]} recv={false} /><Pl p={[5.2, 1.9, 3.5]} w={25} h={3.8} map={wall} c="#fff" rot={[0, -Math.PI / 2, 0]} recv={false} />
      <Pl p={[0, 1.9, 16]} w={11} h={3.8} map={wallE} c="#fff" rot={[0, Math.PI, 0]} recv={false} />
      <BoxField items={wins} cast={false} />
      {/* entrance wall: wainscot + transom + piers, big windows left / right, glass double door in the middle */}
      {[[-3.55, 3.3], [3.55, 3.3]].map(([x, w], i) => <group key={i}><B p={[x, 0.45, -8.95]} s={[w, 0.9, 0.3]} c="#8FD6C2" cast={false} ink={0.008} /><B p={[x, 3.4, -8.95]} s={[w, 0.8, 0.3]} c={CREAM} cast={false} /><B p={[x, 1.95, -8.84]} s={[w - 0.2, 0.08, 0.1]} c="#F6E8C8" cast={false} />{[-1.0, 0, 1.0].map((q) => <B key={q} p={[x + q, 1.95, -8.84]} s={[0.07, 2.2, 0.1]} c="#F6E8C8" cast={false} />)}<B p={[x, 0.95, -8.84]} s={[w, 0.07, 0.12]} c={TEAL} cast={false} /><B p={[x, 3.0, -8.84]} s={[w, 0.07, 0.12]} c={TEAL} cast={false} /></group>)}
      <B p={[-5.1, 1.9, -8.95]} s={[0.2, 3.8, 0.3]} c={CREAM} cast={false} /><B p={[5.1, 1.9, -8.95]} s={[0.2, 3.8, 0.3]} c={CREAM} cast={false} /><B p={[0, 3.2, -8.95]} s={[2.4, 1.2, 0.3]} c={CREAM} cast={false} ink={0.008} />
      {[-1.2, 1.2].map((x) => <B key={x} p={[x, 1.35, -8.9]} s={[0.14, 2.7, 0.3]} c={TEAL} ink={0.01} cast={false} />)}
      {[-1, 1].map((s) => <group key={s} position={[s * 0.55, 1.3, -8.88]}><B p={[0, 0, 0]} s={[1.0, 0.07, 0.06]} c={TEAL} cast={false} /><B p={[0, 1.2, 0]} s={[1.0, 0.07, 0.06]} c={TEAL} cast={false} /><B p={[-0.5 * s, 0.6, 0]} s={[0.07, 2.5, 0.06]} c={TEAL} cast={false} /><B p={[0.5 * s, 0.6, 0]} s={[0.07, 2.5, 0.06]} c={TEAL} cast={false} /><B p={[0, 0.6, 0]} s={[1.0, 0.06, 0.06]} c={TEAL} cast={false} /><Cy p={[-0.4 * s, 0.9, 0.06]} r={0.02} h={0.5} c={BRASS} cast={false} /></group>)}
      <B p={[0, 0.02, -8.2]} s={[2.4, 0.04, 1.3]} c="#8A6A4A" cast={false} /><B p={[0, 0.045, -8.2]} s={[2.1, 0.01, 1.0]} c="#A98A64" cast={false} /> {/* coir mat with a border */}
      {/* awning outside the door */}
      {Array.from({length: 8}, (_, i) => <B key={i} p={[-1.75 + i * 0.5, 3.1, -9.5]} s={[0.5, 0.05, 1.2]} c={i % 2 ? CREAM : RED} rot={[0.35, 0, 0]} ink={0.008} />)}
      {/* ceiling lamps: milk-glass globes with brass caps, HDR glow (bloom), cords */}
      {lampZ.map((z) => <group key={z} position={[0, 0, z]}><Cy p={[0, 3.45, 0]} r={0.012} h={0.7} c="#3E3A36" cast={false} /><Cy p={[0, 3.02, 0]} r={0.09} h={0.08} c={BRASS} ink={0.004} cast={false} /><mesh position={[0, 2.88, 0]} scale={[0.17, 0.2, 0.17]} geometry={shared('shop-globe', () => new THREE.SphereGeometry(1, 16, 12))} material={shared('shop-glow', () => new THREE.MeshBasicMaterial({color: new THREE.Color(3.3, 3.0, 2.3), toneMapped: false}))} /></group>)}
      {[-3.9, 3.9].flatMap((x) => [-6, -1.5, 3, 7.5, 12].map((z) => <group key={`${x}${z}`} position={[x, 0, z]}><Cy p={[0, 3.55, 0]} r={0.01} h={0.5} c="#3E3A36" cast={false} /><mesh position={[0, 3.25, 0]} scale={[0.12, 0.14, 0.12]} geometry={shared('shop-globe', () => new THREE.SphereGeometry(1, 16, 12))} material={shared('shop-glow', () => new THREE.MeshBasicMaterial({color: new THREE.Color(3.3, 3.0, 2.3), toneMapped: false}))} /></group>))}
      <BoxField items={pennants} cast={false} />{[-6.2, 3.6, 11].map((z, i) => <Line3 key={i} a={[-5.1, i === 1 ? 3.3 : 3.35, z]} b={[5.1, i === 1 ? 3.3 : 3.35, z]} sag={0.55} />)}
      {/* shelves and stock */}
      <BoxField items={stock.frames} /><BoxField items={stock.boards} cast={false} /><StockField items={stock.cans} geo="can" /><StockField items={stock.boxes} geo="box" />
      {/* pillars in the gondola gaps (cream shaft, teal base band, brass cap) */}
      {[-0.5, 5.9, 12.3].flatMap((z) => [-2.7, 2.7].map((x) => (z < 0 && x > 0 ? null : <group key={`${x}${z}`} position={[x, 0, z]}><B p={[0, 1.9, 0]} s={[0.5, 3.8, 0.5]} c={CREAM} ink={0.01} /><B p={[0, 0.4, 0]} s={[0.56, 0.8, 0.56]} c="#8FD6C2" ink={0.01} /><B p={[0, 0.82, 0]} s={[0.6, 0.06, 0.6]} c={BRASS} cast={false} /><B p={[0, 3.45, 0]} s={[0.62, 0.3, 0.62]} c={BRASS} ink={0.01} cast={false} /></group>)))}
      {/* hanging category boards at the gondola ends (painted pictures) */}
      {[[-2.7, -6.6, 0], [-2.7, 0.6, 1], [-2.7, 6.0, 2], [2.7, 0.6, 3], [2.7, 6.0, 0], [-2.7, 12.3, 1]].map(([x, z, k], i) => <group key={i} position={[x, 2.45, z]}><B p={[0, 0.5, 0]} s={[0.012, 0.9, 0.012]} c="#3E3A36" cast={false} /><Pl p={[0, 0, 0.0]} w={1.0} h={0.75} map={icons[k]} basic recv={false} /><Pl p={[0, 0, -0.012]} w={1.0} h={0.75} map={icons[k]} basic recv={false} rot={[0, Math.PI, 0]} /></group>)}
      {/* register counter on the right */}
      <B p={[3.4, 0.5, -3.8]} s={[0.9, 1.0, 3.6]} c={WOOD} ink={0.01} /><B p={[2.95, 0.5, -3.8]} s={[0.04, 0.82, 3.4]} c="#D6A96A" cast={false} />
      {Array.from({length: 8}, (_, i) => <B key={i} p={[2.93, 0.5, -5.4 + i * 0.45]} s={[0.02, 0.7, 0.3]} c={i % 2 ? '#C99A5B' : '#B9824A'} cast={false} />)}
      <B p={[3.4, 1.03, -3.8]} s={[1.0, 0.06, 3.7]} c="#6B3F22" ink={0.01} />
      <B p={[3.4, 1.2, -5.1]} s={[0.8, 0.34, 1.1]} c="#CFE6EE" basic cast={false} /><B p={[3.4, 1.04, -5.1]} s={[0.84, 0.04, 1.14]} c={BRASS} cast={false} /> {/* glass candy case */}
      <BoxField items={jars} cast={false} />
      <Bills p={[3.18, 1.07, -2.5]} n={3} /><Register p={[3.4, 1.06, -3.3]} ry={-Math.PI / 2} drawer={regDrawer} crank={regCrank} /><Cy p={[3.2, 1.1, -4.3]} r={0.12} h={0.14} c={BRASS} ink={0.004} /><Cy p={[3.2, 1.2, -4.3]} r={0.08} h={0.02} c="#F6E8C8" basic cast={false} /> {/* brass scale */}
      <Crate p={[-4.1, 0, -7.9]} ry={0.2} fruit /><Crate p={[-3.5, 0, -8.3]} ry={-0.1} fruit s={[0.6, 0.3, 0.4]} /><Crate p={[3.9, 0, -8.2]} ry={0.1} fruit /><Apple p={[3.9, 0.36, -8.2]} r={0.06} />
      {/* clock on the back wall of the store, round, no digits */}
      <Cy p={[0, 3.0, 15.9]} r={0.4} h={0.06} c="#F6E8C8" rot={[Math.PI / 2, 0, 0]} ink={0.01} cast={false} /><Cy p={[0, 3.0, 15.86]} r={0.46} h={0.04} c={BRASS} rot={[Math.PI / 2, 0, 0]} cast={false} /><B p={[0, 3.1, 15.82]} s={[0.025, 0.28, 0.012]} c="#231A28" basic cast={false} /><B p={[0.1, 3.0, 15.82]} s={[0.2, 0.025, 0.012]} c="#231A28" basic cast={false} />
      <B p={[0, 1.2, 15.9]} s={[2.2, 2.4, 0.2]} c="#6B4A32" cast={false} ink={0.01} /><B p={[0, 1.2, 15.78]} s={[1.9, 2.2, 0.1]} c="#2B2630" basic cast={false} /> {/* arch to the storeroom: more of the shop beyond */}
    </group>
  );
};

// ---------------------------------------------------------------- window light, lamp glows, dust (additive, cheap; modelled on kit LightFx)
const shaftTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0.1)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = v; c.fillRect(0, 0, w, h); };
const radialTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(0.35, 'rgba(255,230,170,0.5)'); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
const winPatchTex = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = 'rgba(255,236,190,1)'; c.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84); c.clearRect(w * 0.48, 0, w * 0.04, h); c.clearRect(0, h * 0.48, w, h * 0.04); c.filter = 'blur(5px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none'; };
const dotTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(1, 'rgba(255,248,225,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
const PLANE = () => shared('shopfx-plane', () => new THREE.PlaneGeometry(1, 1));
const addMat = (map: THREE.Texture, op: number, color = '#ffe6b0') => new THREE.MeshBasicMaterial({map, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide});
const DUST = 110;
export const ShopFx: React.FC<{f: number}> = ({f}) => {
  const {mats, dust, base, lampZ} = useMemo(() => {
    const shaft = makeTex(64, 256, shaftTex), radial = makeTex(128, 128, radialTex), win = makeTex(256, 256, winPatchTex), dot = makeTex(32, 32, dotTex);
    const mats = {beam: addMat(shaft, 0.12), glow: addMat(radial, 0.55), win: addMat(win, 0.3), pool: addMat(radial, 0.22, '#ffd890')};
    const base = new Float32Array(DUST * 3), pos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) { base[i * 3] = -3 + hash(i, 1) * 6; base[i * 3 + 1] = 0.3 + hash(i, 2) * 2.8; base[i * 3 + 2] = -8 + hash(i, 3) * 20; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({map: dot, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#fff2cc'}));
    pts.frustumCulled = false; pts.renderOrder = 21;
    return {mats, dust: pts, base, lampZ: Array.from({length: 9}, (_, i) => -7 + i * 2.9)};
  }, []);
  const arr = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < DUST; i++) { arr.array[i * 3] = base[i * 3] + 0.25 * Math.sin(f * 0.018 + i); arr.array[i * 3 + 1] = base[i * 3 + 1] + 0.18 * Math.sin(f * 0.013 + i * 1.7) + ((0.0015 * f) % 0.4); arr.array[i * 3 + 2] = base[i * 3 + 2] + 0.2 * Math.cos(f * 0.011 + i * 0.6); }
  arr.needsUpdate = true; mats.beam.opacity = 0.12 * (0.88 + 0.12 * Math.sin(f * 0.04));
  const shafts = [-5.7, -2.6, 0.5, 3.6, 6.7, 9.8];
  return (
    <group>
      {shafts.map((z, i) => { // a beam from each clerestory window down to its floor patch
        const a = new THREE.Vector3(-5.1, 3.2, z), b = new THREE.Vector3(-1.2, 0, z + 0.9), d = b.clone().sub(a), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
        return <mesh key={i} geometry={PLANE()} material={mats.beam} position={[(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]} quaternion={q} scale={[1.5, len, 1]} renderOrder={20} />;
      })}
      {shafts.map((z, i) => <mesh key={`p${i}`} geometry={PLANE()} material={mats.win} position={[-1.0, 0.012, z + 0.9]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[1.7, 2.0, 1]} renderOrder={19} />)}
      {lampZ.map((z, i) => <React.Fragment key={i}><mesh geometry={PLANE()} material={mats.glow} position={[0, 2.88, z]} scale={[0.7, 0.7, 1]} renderOrder={22} /><mesh geometry={PLANE()} material={mats.pool} position={[0, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[3.2, 3.2, 1]} renderOrder={19} /></React.Fragment>)}
      <primitive object={dust} />
    </group>
  );
};

// ---------------------------------------------------------------- WORKSHOP = the GARAGE set + a workbench with real tools (owner builds the chair cart here)
export const Workshop: React.FC<{benchZ?: number}> = ({benchZ = -4.7}) => (
  <group>
    <Garage />
    <group position={[0, 0, benchZ]}>
      <B p={[0, 0.88, 0]} s={[3.2, 0.08, 0.9]} c={WOOD} ink={0.01} />{[-1.45, 1.45].map((x) => [-0.35, 0.35].map((z) => <B key={`${x}${z}`} p={[x, 0.42, z]} s={[0.1, 0.84, 0.1]} c={WOOD_D} />))}
      <B p={[0, 0.3, 0]} s={[3.0, 0.05, 0.8]} c={WOOD_D} cast={false} /><B p={[0, 0.55, 0.38]} s={[3.0, 0.5, 0.04]} c="#6B4A32" cast={false} />
      <B p={[1.2, 1.0, -0.1]} s={[0.22, 0.16, 0.18]} c="#3E4A52" ink={0.006} /><B p={[1.2, 1.1, -0.1]} s={[0.1, 0.04, 0.3]} c="#8A98A4" cast={false} /> {/* vise */}
      <group position={[-1.0, 0.93, 0.1]}><B p={[0, 0, 0]} s={[0.5, 0.03, 0.12]} c="#C3CED6" ink={0.003} /><B p={[-0.3, 0.02, 0]} s={[0.12, 0.05, 0.06]} c={WOOD_D} cast={false} /></group> {/* saw */}
      <group position={[-0.3, 0.93, 0.15]} rotation={[0, 0.5, 0]}><Cy p={[0, 0.0, 0]} r={0.018} h={0.3} c={RED} rot={[0, 0, Math.PI / 2]} ink={0.003} /><B p={[0.16, 0.04, 0]} s={[0.06, 0.09, 0.05]} c="#6A7A86" ink={0.003} /></group> {/* hammer with a red handle */}
      <Cy p={[-1.3, 1.0, 0.2]} r={0.09} h={0.16} c="#C3CED6" ink={0.004} cast={false} /> {/* wire spool */}
      <Sp p={[-0.6, 1.4, 0.35]} s={[0.14, 0.14, 0.14]} c="#FFF2B8" basic cast={false} /><Cy p={[-0.6, 1.1, 0.35]} r={0.012} h={0.5} c="#3E3A36" cast={false} /> {/* bench lamp */}
    </group>
  </group>
);
export const shopBloom = bm;
