// SHOPPING_CART hero props. All real 3D (wire baskets from thin 3D bars, wheels with hubs and forks, wooden chair with slats, brass register with a key bank).
// PALETTE of this video (written up front, STYLE_NOTES "no fixed palette"):
//   teal #2FA7A0 / mint #BFEBDD (floor, wainscot), cream #F6E8C8 (walls), honey wood #B9824A / #8A5A3A (shelves, counter, chair),
//   warm sun #FFE2B0, brass #D9A84A (register, lamp caps), steel #C3CED6 (wire), HOT ACCENT RED #E0302A (cart handle, bow tie), mustard #E8B23A (accent 2).
// Render stability: geometry through shared() (never per instance), merged wire geometry built once per key, nothing allocated per frame.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {V3, hash, makeTex, shared} from '../kit/kit';
import {B, Cy, Sp, tm} from '../cobra/common';

export const RED = '#E0302A', STEEL = '#C3CED6', WOOD = '#B9824A', WOOD_D = '#8A5A3A', BRASS = '#D9A84A';

// ---------------------------------------------------------------- wire building blocks
const UP = new THREE.Vector3(0, 1, 0);
function barGeo(a: V3, b: V3, r: number): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length(), g = new THREE.CylinderGeometry(r, r, len, 5, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), m = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); return g;
}
/** Tapered wire basket, open top: bottom rectangle (w * 0.8, d * 0.8) at y = 0, top rectangle (w, d) at y = h. Thin vertical bars on 4 sides, top rim, mid rail, base grid. */
export function wireBasket(key: string, w: number, d: number, h: number, r = 0.007, nx = 9, nz = 13): THREE.BufferGeometry {
  return shared(`wb-${key}`, () => {
    const gs: THREE.BufferGeometry[] = [], bw = w * 0.8, bd = d * 0.8, P = (u: number, x: number, z: number): V3 => [x * (bw + (w - bw) * u), h * u, z * (bd + (d - bd) * u)];
    const rect = (u: number, rr: number) => { const c: V3[] = [P(u, -0.5, -0.5), P(u, 0.5, -0.5), P(u, 0.5, 0.5), P(u, -0.5, 0.5)]; for (let i = 0; i < 4; i++) gs.push(barGeo(c[i], c[(i + 1) % 4], rr)); };
    rect(1, r * 1.7); rect(0.5, r); rect(0, r * 1.2);
    for (let i = 0; i <= nx; i++) { const x = -0.5 + i / nx; gs.push(barGeo(P(0, x, -0.5), P(1, x, -0.5), r), barGeo(P(0, x, 0.5), P(1, x, 0.5), r), barGeo(P(0, x, -0.5), P(0, x, 0.5), r)); }
    for (let i = 0; i <= nz; i++) { const z = -0.5 + i / nz; gs.push(barGeo(P(0, -0.5, z), P(1, -0.5, z), r), barGeo(P(0, 0.5, z), P(1, 0.5, z), r), barGeo(P(0, -0.5, z), P(0, 0.5, z), r)); }
    const m = mergeGeometries(gs, false)!; gs.forEach((g) => g.dispose()); return m;
  });
}
const barsGeo = (key: string, bars: [V3, V3, number][]) => shared(`bars-${key}`, () => { const gs = bars.map(([a, b, r]) => barGeo(a, b, r)), m = mergeGeometries(gs, false)!; gs.forEach((g) => g.dispose()); return m; });
const WireMesh: React.FC<{geo: THREE.BufferGeometry; p?: V3; rot?: V3; c?: string}> = ({geo, p, rot, c}) => <mesh geometry={geo} material={tm(c ?? STEEL)} position={p} rotation={rot} castShadow receiveShadow />;

// ---------------------------------------------------------------- goods (what is in the baskets)
const GOODS: {kind: 'box' | 'can' | 'apple'; c: string; s: number}[] = [
  {kind: 'box', c: '#E8B23A', s: 1}, {kind: 'apple', c: '#D8342A', s: 1}, {kind: 'can', c: '#2FA7A0', s: 1}, {kind: 'box', c: '#F6E8C8', s: 0.9}, {kind: 'apple', c: '#9CCB4A', s: 1}, {kind: 'can', c: '#E0302A', s: 1},
  {kind: 'box', c: '#8E6BBF', s: 1.1}, {kind: 'can', c: '#E8B23A', s: 1}, {kind: 'apple', c: '#D8342A', s: 1}, {kind: 'box', c: '#3FA7C9', s: 1}, {kind: 'can', c: '#F6E8C8', s: 1}, {kind: 'apple', c: '#E8742A', s: 1}, {kind: 'box', c: '#E0302A', s: 0.9}, {kind: 'can', c: '#3FA7C9', s: 1},
];
export const Apple: React.FC<{p: V3; r?: number; c?: string; rot?: V3}> = ({p, r = 0.045, c = '#D8342A', rot}) => (
  <group position={p} rotation={rot}>
    <Sp p={[0, 0, 0]} s={[r, r * 0.92, r]} c={c} ink={0.004} />
    <Cy p={[0, r * 0.95, 0]} r={r * 0.09} h={r * 0.5} c="#5A3A22" cast={false} />
    <Sp p={[r * 0.35, r * 1.0, 0]} s={[r * 0.42, r * 0.12, r * 0.22]} c="#4FA24A" rot={[0, 0, 0.5]} cast={false} />
  </group>
);
/** n items piled in a basket centred at c (top-down radius rx, rz, base y). Deterministic, mound shaped. */
export const Goods: React.FC<{c: V3; rx: number; rz: number; n: number; seed?: number; scale?: number}> = ({c, rx, rz, n, seed = 0, scale = 1}) => (
  <group userData={{noClutter: true}}>
    {Array.from({length: Math.min(n, 40)}, (_, i) => {
      const g = GOODS[(i + seed) % GOODS.length], a = i * 2.399963 + seed, rr = Math.sqrt(((i % 14) + 0.5) / 14), h = Math.floor(i / 14), k = 0.1 * scale * g.s;
      const p: V3 = [c[0] + Math.cos(a) * rx * rr, c[1] + h * k * 0.9 + (1 - rr) * k * 0.7, c[2] + Math.sin(a) * rz * rr], ry = hash(i, seed) * 3;
      if (g.kind === 'apple') return <Apple key={i} p={[p[0], p[1] + k * 0.4, p[2]]} r={k * 0.55} c={g.c} />;
      if (g.kind === 'can') return <Cy key={i} p={[p[0], p[1] + k * 0.5, p[2]]} r={k * 0.4} h={k} c={g.c} ink={0.003} />;
      return <B key={i} p={[p[0], p[1] + k * 0.55, p[2]]} s={[k * 0.9, k * 1.1, k * 0.6]} c={g.c} rot={[0, ry, 0]} ink={0.003} />;
    })}
  </group>
);

// ---------------------------------------------------------------- SHOPPING CART (wire basket, 4 wheels, red handle). Local: front = -z, handle at +z, y up, origin on the floor under the middle.
const WHEEL_R = 0.07;
const Wheel: React.FC<{p: V3; spin: number}> = ({p, spin}) => (
  <group position={p} userData={{noClutter: true}}>
    <group rotation={[spin, 0, 0]}>
      <Cy p={[0, 0, 0]} r={WHEEL_R} h={0.04} c="#2B2630" rot={[0, 0, Math.PI / 2]} ink={0.004} />
      <Cy p={[0, 0, 0]} r={WHEEL_R * 0.45} h={0.05} c="#C3CED6" rot={[0, 0, Math.PI / 2]} cast={false} />
      <B p={[0.026, 0, 0]} s={[0.004, WHEEL_R * 1.4, 0.012]} c="#6A7A86" cast={false} />
    </group>
    <B p={[0.032, 0.05, 0]} s={[0.008, 0.1, 0.03]} c="#8A98A4" cast={false} /><B p={[-0.032, 0.05, 0]} s={[0.008, 0.1, 0.03]} c="#8A98A4" cast={false} />
  </group>
);
const FRAME = (() => {
  const w = 0.25, L: [V3, V3, number][] = [];
  for (const sx of [-1, 1]) {
    L.push([[sx * w, WHEEL_R + 0.1, -0.42], [sx * 0.3, 0.34, -0.42], 0.011], [[sx * w, WHEEL_R + 0.1, 0.4], [sx * 0.3, 0.34, 0.42], 0.011], [[sx * w, 0.17, -0.42], [sx * w, 0.17, 0.4], 0.011]);
    L.push([[sx * 0.3, 0.34, 0.42], [sx * 0.27, 0.99, 0.6], 0.012], [[sx * 0.29, 0.6, 0.46], [sx * 0.27, 0.99, 0.6], 0.009]);
  }
  L.push([[-0.25, 0.17, -0.42], [0.25, 0.17, -0.42], 0.009], [[-0.25, 0.17, 0.4], [0.25, 0.17, 0.4], 0.009]);
  for (let i = 0; i <= 10; i++) L.push([[-0.24 + i * 0.048, 0.17, -0.41], [-0.24 + i * 0.048, 0.17, 0.39], 0.004]); // lower rack grid
  for (let i = 0; i <= 8; i++) L.push([[-0.24, 0.17, -0.41 + i * 0.1], [0.24, 0.17, -0.41 + i * 0.1], 0.004]);
  return barsGeo('cart-frame', L);
})();
export const Cart: React.FC<{p: V3; ry?: number; spin?: number; load?: number; seed?: number}> = ({p, ry = 0, spin = 0, load = 0, seed = 0}) => (
  <group position={p} rotation={[0, ry, 0]} userData={{qaBox: {name: 'cart', c: [0, 0.45, 0], h: [0.3, 0.3, 0.48]}}}>
    <WireMesh geo={wireBasket('cart', 0.58, 0.92, 0.4)} p={[0, 0.34, 0]} />
    <WireMesh geo={FRAME} />
    {[[-0.25, -0.42], [0.25, -0.42], [-0.25, 0.4], [0.25, 0.4]].map(([x, z], i) => <Wheel key={i} p={[x, WHEEL_R, z]} spin={spin} />)}
    <Cy p={[0, 0.99, 0.6]} r={0.022} h={0.62} c={RED} rot={[0, 0, Math.PI / 2]} ink={0.004} />
    <Sp p={[-0.31, 0.99, 0.6]} s={[0.024, 0.024, 0.024]} c={RED} cast={false} /><Sp p={[0.31, 0.99, 0.6]} s={[0.024, 0.024, 0.024]} c={RED} cast={false} />
    <B p={[0, 0.5, -0.46]} s={[0.12, 0.06, 0.012]} c={RED} cast={false} />
    {load > 0 && <Goods c={[0, 0.42, 0]} rx={0.2} rz={0.34} n={Math.round(load * 26)} seed={seed} />}
  </group>
);

/** GRIP ANCHORS of the cart: left and right grip on the red handle bar, shoulder-width apart (world positions). The hands are pinned here by IK every frame. */
export const cartGrips = (ctr: V3, ry: number): [V3, V3] => [-0.2, 0.2].map((x): V3 => [ctr[0] + x * Math.cos(ry) + 0.6 * Math.sin(ry), 0.99, ctr[2] - x * Math.sin(ry) + 0.6 * Math.cos(ry)]) as [V3, V3];
/** Grip anchor of a hand basket: the top of the handle arch (the basket hangs below the hand). */
export const basketGrip = (p: V3): V3 => [p[0], p[1] + 0.37, p[2]];
// ---------------------------------------------------------------- HAND BASKET: wire bowl, wooden rim, arched handle. Origin = bottom centre.
const hbHandle = () => shared('hb-handle', () => { const gs: THREE.BufferGeometry[] = []; for (let i = 0; i < 14; i++) { const a0 = (i / 14) * Math.PI, a1 = ((i + 1) / 14) * Math.PI; gs.push(barGeo([Math.cos(a0) * 0.17, Math.sin(a0) * 0.17, 0], [Math.cos(a1) * 0.17, Math.sin(a1) * 0.17, 0], 0.011)); } const m = mergeGeometries(gs, false)!; gs.forEach((g) => g.dispose()); return m; }); // arch of short bars (a TubeGeometry along a planar arc produced NaN frames)
export const HandBasket: React.FC<{p: V3; ry?: number; load?: number; seed?: number; handleTilt?: number}> = ({p, ry = 0, load = 0.6, seed = 0, handleTilt = 0}) => (
  <group position={p} rotation={[0, ry, 0]} userData={{noClutter: true, qaBox: {name: 'basket', c: [0, 0.11, 0], h: [0.21, 0.11, 0.15]}}}>
    <WireMesh geo={wireBasket('hand', 0.4, 0.28, 0.2, 0.0065, 8, 6)} p={[0, 0, 0]} />
    <B p={[0, 0.2, 0.14]} s={[0.4, 0.022, 0.02]} c={WOOD} cast={false} /><B p={[0, 0.2, -0.14]} s={[0.4, 0.022, 0.02]} c={WOOD} cast={false} />
    <B p={[0.2, 0.2, 0]} s={[0.02, 0.022, 0.28]} c={WOOD} cast={false} /><B p={[-0.2, 0.2, 0]} s={[0.02, 0.022, 0.28]} c={WOOD} cast={false} />
    <mesh geometry={hbHandle()} material={tm(WOOD_D)} position={[0, 0.2, 0]} rotation={[handleTilt, 0, 0]} castShadow />
    {load > 0 && <Goods c={[0, 0.07, 0]} rx={0.13} rz={0.08} n={Math.round(load * 16)} seed={seed} scale={0.85} />}
  </group>
);

// ---------------------------------------------------------------- FOLDING CHAIR WITH WHEELS AND TWO BASKETS (Goldman's first cart). Local: front = -z, back of the chair at +z, red grip on top of the back.
const CHAIR_BARS = (() => {
  const L: [V3, V3, number][] = [];
  for (const sx of [-1, 1]) { // X-folding legs: two crossing bars per side + cross stretchers
    L.push([[sx * 0.22, 0.46, -0.2], [sx * 0.22, WHEEL_R + 0.02, 0.2], 0.014], [[sx * 0.22, 0.46, 0.2], [sx * 0.22, WHEEL_R + 0.02, -0.2], 0.014]);
    L.push([[sx * 0.22, 0.46, 0.2], [sx * 0.22, 1.0, 0.24], 0.016]); // back posts
  }
  L.push([[-0.22, 0.26, 0], [0.22, 0.26, 0], 0.012], [[-0.22, 0.46, -0.2], [0.22, 0.46, -0.2], 0.012], [[-0.22, 0.46, 0.2], [0.22, 0.46, 0.2], 0.012]);
  return barsGeo('chair-frame', L);
})();
export const ChairCart: React.FC<{p: V3; ry?: number; spin?: number; baskets?: number; wheels?: number}> = ({p, ry = 0, spin = 0, baskets = 2, wheels = 4}) => (
  <group position={p} rotation={[0, ry, 0]}>
    <WireMesh geo={CHAIR_BARS} c={WOOD_D} />
    <B p={[0, 0.49, 0]} s={[0.5, 0.04, 0.46]} c={WOOD} ink={0.006} /> {/* seat */}
    {[0, 1, 2, 3].map((i) => <B key={i} p={[0, 0.58 + i * 0.1, 0.24]} s={[0.46, 0.07, 0.025]} c={i % 2 ? WOOD : '#C99A5B'} ink={0.004} />)} {/* back slats */}
    <Cy p={[0, 1.0, 0.24]} r={0.024} h={0.5} c={RED} rot={[0, 0, Math.PI / 2]} ink={0.004} /> {/* red grip */}
    {[[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]].slice(0, wheels).map(([x, z], i) => <Wheel key={i} p={[x, WHEEL_R, z]} spin={spin} />)}
    {baskets >= 1 && <><WireMesh geo={wireBasket('chair', 0.44, 0.38, 0.2, 0.0065, 7, 6)} p={[0, 0.51, -0.02]} /><Goods c={[0, 0.56, -0.02]} rx={0.14} rz={0.1} n={7} seed={3} scale={0.8} /></>}
    {baskets >= 2 && <><B p={[0, 0.78, -0.02]} s={[0.46, 0.02, 0.4]} c={WOOD_D} ink={0.003} /><WireMesh geo={wireBasket('chair', 0.44, 0.38, 0.2, 0.0065, 7, 6)} p={[0, 0.79, -0.02]} /><Goods c={[0, 0.84, -0.02]} rx={0.14} rz={0.1} n={6} seed={8} scale={0.8} /></>}
  </group>
);

// ---------------------------------------------------------------- CASH REGISTER (1930s brass). Local: faces +z (the customer), y up, origin on the counter top.
const keyGeo = () => shared('reg-key', () => new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10));
export const Register: React.FC<{p: V3; ry?: number; drawer?: number; crank?: number}> = ({p, ry = 0, drawer = 0, crank = 0}) => {
  const keys = useMemo(() => { const m = new THREE.InstancedMesh(keyGeo(), tm('#FFFFFF'), 40), o = new THREE.Object3D(), c = new THREE.Color(); let i = 0; for (let r = 0; r < 5; r++) for (let q = 0; q < 8; q++, i++) { o.position.set((q - 3.5) * 0.04, 0.2 + r * 0.045 + 0.01, 0.105 - r * 0.012 + 0.02); o.rotation.set(Math.PI / 2 + 0.25, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(r === 4 ? '#E0302A' : (q + r) % 2 ? '#F6E8C8' : '#2B2630')); } m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.castShadow = true; return m; }, []);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <B p={[0, 0.09, 0]} s={[0.46, 0.18, 0.38]} c="#7A4A20" ink={0.006} />
      <B p={[0, 0.09, 0.02 + drawer * 0.2]} s={[0.4, 0.1, 0.34]} c="#B07A3C" cast={drawer > 0.02} />
      {drawer > 0.05 && <B p={[0, 0.15, 0.02 + drawer * 0.2]} s={[0.36, 0.02, 0.3]} c="#E9E1C8" cast={false} />}
      <B p={[0, 0.27, 0]} s={[0.46, 0.2, 0.34]} c={BRASS} ink={0.006} />
      <B p={[0, 0.37, -0.02]} s={[0.44, 0.04, 0.3]} c="#F2C25A" cast={false} />
      <B p={[0, 0.215, 0.1]} s={[0.42, 0.2, 0.18]} c="#C8923A" rot={[-0.35, 0, 0]} ink={0.004} />
      <primitive object={keys} />
      <B p={[0, 0.47, -0.1]} s={[0.4, 0.2, 0.06]} c="#E8B23A" ink={0.005} />
      <Cy p={[0, 0.48, -0.065]} r={0.075} h={0.012} c="#F6E8C8" rot={[Math.PI / 2, 0, 0]} basic cast={false} />
      <B p={[0.012, 0.5, -0.056]} s={[0.012, 0.06, 0.006]} c={RED} rot={[0, 0, 0.5]} basic cast={false} />
      <Sp p={[0, 0.585, -0.1]} s={[0.05, 0.03, 0.05]} c="#F2C25A" ink={0.003} />
      <group position={[0.25, 0.3, 0.02]} rotation={[crank, 0, 0]}><Cy p={[0.02, 0, 0]} r={0.012} h={0.05} c="#5A3A22" rot={[0, 0, Math.PI / 2]} cast={false} /><Cy p={[0.04, 0.08, 0]} r={0.008} h={0.16} c="#5A3A22" cast={false} /><Sp p={[0.04, 0.17, 0]} s={[0.02, 0.02, 0.02]} c={RED} cast={false} /></group>
    </group>
  );
};

// ---------------------------------------------------------------- cash
export const Bills: React.FC<{p: V3; n?: number; rot?: V3}> = ({p, n = 3, rot}) => (
  <group position={p} rotation={rot} userData={{noClutter: true}}>{Array.from({length: n}, (_, i) => <group key={i} position={[0, i * 0.004, 0]} rotation={[0, (i - 1) * 0.08, 0]}><B p={[0, 0, 0]} s={[0.17, 0.003, 0.075]} c="#7FBF7A" cast={false} /><B p={[0, 0.002, 0]} s={[0.07, 0.002, 0.04]} c="#CFE8B8" cast={false} basic /></group>)}</group>
);

// ---------------------------------------------------------------- wooden crate (set dressing near the entrance)
export const Crate: React.FC<{p: V3; ry?: number; s?: V3; fruit?: boolean}> = ({p, ry = 0, s = [0.6, 0.3, 0.4], fruit = false}) => (
  <group position={p} rotation={[0, ry, 0]}>
    <B p={[0, s[1] / 2, 0]} s={[s[0], s[1], s[2]]} c={WOOD} ink={0.006} />
    {[0.25, 0.7].map((q) => <B key={q} p={[0, s[1] * q, s[2] / 2 + 0.004]} s={[s[0] * 1.01, s[1] * 0.12, 0.008]} c={WOOD_D} cast={false} />)}
    {fruit && Array.from({length: 9}, (_, i) => <Apple key={i} p={[((i % 3) - 1) * s[0] * 0.28, s[1] + 0.02 + (i > 5 ? 0.06 : 0), (Math.floor((i % 6) / 3) - 0.5) * s[2] * 0.4]} r={0.05} c={i % 3 === 0 ? '#9CCB4A' : '#D8342A'} />)}
  </group>
);

// ---------------------------------------------------------------- glint: a 4-point star flash on shiny things (additive sprite, one texture per mount)
export const Glint: React.FC<{p: V3; size: number; k: number}> = ({p, size, k}) => {
  const tex = useMemo(() => makeTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,250,220,0.8)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; c.fillStyle = '#000'; c.beginPath(); c.moveTo(w / 2, 0); c.quadraticCurveTo(w * 0.55, h * 0.45, w, h / 2); c.quadraticCurveTo(w * 0.55, h * 0.55, w / 2, h); c.quadraticCurveTo(w * 0.45, h * 0.55, 0, h / 2); c.quadraticCurveTo(w * 0.45, h * 0.45, w / 2, 0); c.fill(); }), []);
  const col = useMemo(() => new THREE.Color(2.2, 2.0, 1.6), []);
  if (k <= 0.01) return null;
  return <sprite position={p} scale={[size * k, size * k, 1]} renderOrder={30}><spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} color={col} /></sprite>;
};
