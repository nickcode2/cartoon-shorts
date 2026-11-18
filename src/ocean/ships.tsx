// OVERBOARD_SURVIVOR hero vehicles (real 3D): the CRUISE SHIP (rounded hull, 5 decks, ~320 lit windows, 2 funnels, lifeboats, promenade deck with rail + lamps + loungers, wake), the CARGO SHIP
// (hull, colourful container stacks, stern bridge, rail) and the COAST GUARD HELICOPTER (fuselage, glass, tail boom + rotor, spinning main rotor, skids, winch arm, rope with hook).
// Everything is built from shared geometry (B / Cy / Sp of the cobra kit = shared toon boxes / cylinders / spheres) or merged instanced meshes; nothing is allocated per frame.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex, shared} from '../kit/kit';
import {B, Cy, Sp, BoxField, BoxInst} from '../cobra/common';
import {Glow} from '../kit/finish';
import {LAMP_HDR} from './ocean';

const tone = (c: string) => shared(`os-t${c}`, () => new THREE.MeshToonMaterial({color: c}));
// ------------------------------------------------------------------ lit windows: ONE instanced mesh, HDR warm colour (bloom picks them up), a few dark / dim for variety
export const Windows: React.FC<{items: {p: V3; w: number; h: number; ry?: number; dim?: number}[]; hdr?: THREE.Color}> = ({items, hdr = LAMP_HDR}) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(shared('os-wplane', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({color: hdr, toneMapped: false, side: THREE.DoubleSide}), Math.max(1, items.length));
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    items.forEach((it, i) => { e.set(0, it.ry ?? 0, 0); q.setFromEuler(e); mat.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(it.w, it.h, 1)); m.setMatrixAt(i, mat); const d = it.dim ?? (hash(i, 7) < 0.14 ? 0.18 : hash(i, 8) < 0.3 ? 0.62 : 1); m.setColorAt(i, c.setRGB(d, d, d)); });
    m.count = items.length; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; return m;
  }, [items, hdr]);
  return <primitive object={mesh} />;
};
const windowRow = (x0: number, x1: number, y: number, z: number, step = 2.1, ry = 0): {p: V3; w: number; h: number; ry: number}[] => { const o = []; for (let x = x0; x <= x1; x += step) o.push({p: [x, y, z] as V3, w: 1.0, h: 1.2, ry}); return o; };

// ------------------------------------------------------------------ CRUISE SHIP: local frame: +x = bow, +z = the side the camera sees, y = 0 at the waterline, promenade deck floor at y = 9.2
export const SHIP_L = 92, RAIL_Z = 7.7, DECK_Y = 9.2;
const hullGeo = () => shared('cruise-hull', () => {
  const s = new THREE.Shape(); s.moveTo(-46, 8.1); s.lineTo(-47.5, 3); s.quadraticCurveTo(-46, -1.6, -40, -1.8); s.lineTo(34, -1.8); s.quadraticCurveTo(46, -0.5, 50, 5.5); s.lineTo(52, 8.1); s.lineTo(-46, 8.1);
  const g = new THREE.ExtrudeGeometry(s, {depth: 14.6, bevelEnabled: true, bevelSize: 0.9, bevelThickness: 0.9, bevelSegments: 3, curveSegments: 12}); g.translate(0, 0, -7.3); return g;
});
const deckTex = () => makeTex(256, 256, (c, w, h) => { c.fillStyle = '#B07A44'; c.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { c.fillStyle = `rgba(${i % 2 ? '255,230,190' : '60,30,10'},${i % 2 ? 0.1 : 0.12})`; c.fillRect(0, i * (h / 16), w, h / 16 - 2); c.fillStyle = 'rgba(40,20,5,0.35)'; c.fillRect(0, i * (h / 16) - 1, w, 2); } for (let k = 0; k < 10; k++) { c.fillStyle = 'rgba(40,20,5,0.3)'; c.fillRect((k * 97) % w, (Math.floor(k * 3.7) % 16) * (h / 16), 3, h / 16); } }, [14, 1]);
export const Rail: React.FC<{x0: number; x1: number; z: number; y: number; h?: number}> = ({x0, x1, z, y, h = 1.1}) => {
  const posts: BoxInst[] = []; for (let x = x0; x <= x1 + 0.01; x += 1.5) posts.push({p: [x, y + h / 2, z], s: [0.08, h, 0.08], c: '#F4F4EC'});
  return (<>
    <BoxField items={posts} cast={false} />
    <B p={[(x0 + x1) / 2, y + h, z]} s={[x1 - x0, 0.1, 0.16]} c="#F4F4EC" cast={false} /><B p={[(x0 + x1) / 2, y + h * 0.55, z]} s={[x1 - x0, 0.05, 0.05]} c="#E9E9E1" cast={false} /><B p={[(x0 + x1) / 2, y + h * 0.2, z]} s={[x1 - x0, 0.05, 0.05]} c="#E9E9E1" cast={false} />
  </>);
};
export const Lounger: React.FC<{p: V3; ry?: number; c?: string}> = ({p, ry = 0, c = '#2FA7A0'}) => (
  <group position={p} rotation={[0, ry, 0]}>
    <B p={[0, 0.22, 0]} s={[0.62, 0.08, 1.9]} c="#F4F4EC" cast={false} /><B p={[0, 0.3, 0]} s={[0.58, 0.1, 1.8]} c={c} cast={false} />
    <B p={[0, 0.58, -0.78]} s={[0.58, 0.1, 0.7]} c={c} rot={[0.9, 0, 0]} cast={false} />
    {[[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.85], [0.28, 0.85]].map(([x, z], i) => <Cy key={i} p={[x, 0.1, z]} r={0.03} h={0.2} c="#CFCFC6" cast={false} />)}
  </group>
);
export const DeckLamp: React.FC<{p: V3; glow?: number}> = ({p, glow = 1}) => (
  <group position={p}>
    <Cy p={[0, 1.2, 0]} r={0.05} h={2.4} c="#2B3A44" cast={false} /><Sp p={[0, 2.5, 0]} s={[0.22, 0.2, 0.22]} c="#FFE2A0" basic cast={false} />
    <mesh position={[0, 2.5, 0]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color={LAMP_HDR} toneMapped={false} /></mesh>
    <Glow p={[0, 2.5, 0]} size={3.4 * glow} color="#FFC878" intensity={0.9} />
  </group>
);
/** The ship. `t` only drives tiny details (none here); the hull is lit by the world lights, windows / lamps are emissive. */
export const CruiseShip: React.FC<{p: V3; yaw?: number; deck?: boolean; scale?: number}> = ({p, yaw = 0, deck = true, scale = 1}) => {
  const win = useMemo(() => {
    const o: {p: V3; w: number; h: number; ry?: number}[] = [];
    const decks: [number, number, number, number][] = [[-30, 26, 10.9, 3.9], [-27, 23, 14.3, 4.6], [-24, 20, 17.7, 4.1], [-20, 16, 21.1, 3.6]]; // x0, x1, window y, half width + wall
    for (const [x0, x1, y, hw] of decks) { o.push(...windowRow(x0, x1, y, hw + 0.03)); o.push(...windowRow(x0, x1, y, -hw - 0.03, 2.1, Math.PI)); }
    for (let x = -42; x <= 46; x += 3.2) { o.push({p: [x, 6.6, 7.95], w: 0.5, h: 0.5, ry: 0}); o.push({p: [x, 6.6, -7.95], w: 0.5, h: 0.5, ry: Math.PI}); } // hull portholes
    o.push(...windowRow(-14, 8, 24.6, 3.3, 2.0)); o.push(...windowRow(-14, 8, 24.6, -3.3, 2.0, Math.PI));
    return o;
  }, []);
  const dk = useMemo(() => deckTex(), []);
  return (
    <group position={p} rotation={[0, yaw, 0]} scale={scale} userData={{qaShip: true}}>
      <mesh geometry={hullGeo()} castShadow receiveShadow material={tone('#274C7E')} />
      <BoxField items={Array.from({length: 46}, (_, i) => ({p: [-44 + i * 2.1, 4.2, 8.3] as V3, s: [0.12, 7.2, 0.06] as V3, c: '#335F9A'}))} cast={false} />
      <B p={[0, 5.4, 8.25]} s={[94, 0.55, 0.14]} c="#E0302A" cast={false} /><B p={[0, 5.4, -8.25]} s={[94, 0.55, 0.14]} c="#E0302A" cast={false} /><B p={[0, 8.9, 8.2]} s={[94, 0.5, 0.16]} c="#F4F4EC" cast={false} />
      {/* promenade deck floor, superstructure decks */}
      <mesh position={[-2, DECK_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[88, 15.4]} /><meshToonMaterial map={dk} /></mesh>
      <B p={[-2, 10.9, 0]} s={[56, 3.4, 7.8]} c="#F2F2EA" /><B p={[-1.5, 14.3, 0]} s={[50, 3.4, 9.2]} c="#ECEDE6" /><B p={[-1, 17.7, 0]} s={[44, 3.4, 8.2]} c="#F2F2EA" /><B p={[-1, 21.1, 0]} s={[36, 3.4, 7.2]} c="#ECEDE6" />
      <B p={[-3, 24.6, 0]} s={[28, 3.4, 6.6]} c="#F2F2EA" /><B p={[0, 26.7, 0]} s={[30, 0.8, 7.2]} c="#E0302A" /><B p={[18, 23.6, 0]} s={[8, 3.4, 7]} c="#E4E6E0" /><B p={[18, 25.6, 0]} s={[9, 0.5, 7.6]} c="#2F3B57" />
      {[[-12, 28.6, 3.0], [8, 29.2, 3.0]].map(([x, y, r], i) => (<group key={i}><Cy p={[x, y, 0]} r={r} h={5.6} c="#F2F2EA" /><Cy p={[x, y + 1.2, 0]} r={r + 0.06} h={1.5} c="#E0302A" cast={false} /><Cy p={[x, y + 0.6, 0]} r={r + 0.07} h={0.45} c="#2FA7A0" cast={false} /><Cy p={[x, y + 2.9, 0]} r={r + 0.1} h={0.35} c="#2B3A44" cast={false} /></group>))}
      <Cy p={[24, 29.5, 0]} r={0.12} h={6} c="#CFCFC6" cast={false} />
      {[-27, -20, 14, 21].map((x, i) => (<group key={i} position={[x, 10.3, 8.9]}><Sp p={[0, 0, 0]} s={[3.1, 0.75, 0.95]} c="#F08A24" /><B p={[0, 0.5, 0]} s={[2.8, 0.14, 0.7]} c="#F4F4EC" cast={false} /></group>))}
      <Windows items={win} />
      {deck && (<>
        <Rail x0={-36} x1={34} z={RAIL_Z} y={DECK_Y} /><Rail x0={-36} x1={34} z={-RAIL_Z} y={DECK_Y} />
        {[-30, -18, -6, 6, 18, 30].map((x, i) => <DeckLamp key={i} p={[x, DECK_Y, 7.2]} />)}
        {[-27, -21, -11, -4, 3, 12].map((x, i) => <Lounger key={i} p={[x, DECK_Y, 4.9]} ry={Math.PI / 2} c={i % 2 ? '#E8B23A' : '#2FA7A0'} />)}
        <mesh position={[-2, DECK_Y + 0.55, RAIL_Z]} rotation={[0, 0, 0]}><torusGeometry args={[0.28, 0.07, 8, 18]} /><meshToonMaterial color="#E0302A" /></mesh>
      </>)}
      <Glow p={[-12, 31.8, 0]} size={6} color="#FFC878" intensity={0.5} />
    </group>
  );
};

// ------------------------------------------------------------------ wakes
/** Straight wake behind a ship (foam V + centre lane), local frame of the ship. */
export const Wake: React.FC<{p: V3; len?: number; spread?: number}> = ({p, len = 90, spread = 16}) => {
  const geo = useMemo(() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-len, spread); s.lineTo(-len, spread - 3); s.lineTo(-len * 0.2, 0.4); s.lineTo(-len, -spread + 3); s.lineTo(-len, -spread); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); }, [len, spread]);
  return <mesh geometry={geo} position={p} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}><meshBasicMaterial color="#E8FAF6" transparent opacity={0.55} depthWrite={false} toneMapped={false} /></mesh>;
};
/** A curved wake: a ribbon along an arc (centre c, radius r, angles a0 -> a1), fading out along its length, plus the ship at the head. */
export const ArcWake: React.FC<{c: [number, number]; r: number; a0: number; a1: number; w?: number}> = ({c, r, a0, a1, w = 5}) => {
  const geo = useMemo(() => {
    const n = 64, pos: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n, k = i / n, wd = w * (0.2 + 0.8 * (1 - k)) + 0.5, cx = c[0] + Math.cos(a) * r, cz = c[1] + Math.sin(a) * r, nx = Math.cos(a), nz = Math.sin(a); pos.push(cx - nx * wd, 0.32, cz - nz * wd, cx + nx * wd, 0.32, cz + nz * wd); const al = (1 - k) * 0.85; col.push(0.92, 0.98, 0.97, al, 0.92, 0.98, 0.97, al); if (i < n) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
  }, [c[0], c[1], r, a0, a1, w]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} renderOrder={3}><meshBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>;
};

// ------------------------------------------------------------------ CARGO SHIP: local frame: +x bow, +z the side the camera sees, deck floor at y = 7.2
export const CARGO_DECK = 7.2, CARGO_RAIL_Z = 8.5;
const cargoHull = () => shared('cargo-hull', () => {
  const s = new THREE.Shape(); s.moveTo(-58, 6.2); s.lineTo(-59, 1); s.quadraticCurveTo(-57, -2.4, -50, -2.6); s.lineTo(42, -2.6); s.quadraticCurveTo(54, -1.6, 60, 4.5); s.lineTo(62, 6.2); s.lineTo(-58, 6.2);
  const g = new THREE.ExtrudeGeometry(s, {depth: 16.6, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 3, curveSegments: 12}); g.translate(0, 0, -8.3); return g;
});
const BOX_COL = ['#E0302A', '#E8B23A', '#2FA7A0', '#3FA7C9', '#F6E8C8', '#E8742A', '#8E6BBF', '#C9657A', '#35B36B'];
export const CargoShip: React.FC<{p: V3; yaw?: number}> = ({p, yaw = 0}) => {
  const boxes = useMemo(() => { const o: BoxInst[] = []; for (let bay = 0; bay < 15; bay++) for (let row = 0; row < 4; row++) { const hgt = 1 + Math.floor(hash(bay * 5 + row, 2) * 3.4); for (let tier = 0; tier < hgt; tier++) o.push({p: [-52 + bay * 6.4 + 3.2 - 1, CARGO_DECK + 1.3 + tier * 2.6, -5.8 + row * 3.1], s: [6.1, 2.5, 3.0], c: BOX_COL[Math.floor(hash(bay * 31 + row * 7 + tier, 5) * BOX_COL.length)]}); } return o; }, []);
  const win = useMemo(() => { const o: {p: V3; w: number; h: number; ry?: number; dim?: number}[] = []; for (let k = 0; k < 4; k++) o.push(...windowRow(-58, -49, CARGO_DECK + 3.6 + k * 2.4, 4.53, 1.6).map((w) => ({...w, dim: 0.5}))); return o; }, []);
  return (
    <group position={p} rotation={[0, yaw, 0]} userData={{qaShip: true}}>
      <mesh geometry={cargoHull()} castShadow receiveShadow material={tone('#B8332B')} />
      <B p={[2, 1.6, 8.2]} s={[112, 4.2, 0.2]} c="#262B33" cast={false} /><BoxField items={Array.from({length: 40}, (_, i) => ({p: [-56 + i * 3, 4.6, 8.3] as V3, s: [0.14, 5.2, 0.06] as V3, c: '#8E241E'}))} cast={false} /><B p={[2, 4.5, 8.33]} s={[100, 0.5, 0.05]} c="#F4F4EC" cast={false} /><B p={[2, 7.1, 8.2]} s={[120, 0.3, 0.3]} c="#F4F4EC" cast={false} />
      <B p={[0, CARGO_DECK + 0.02, 0]} s={[116, 0.2, 16]} c="#4A5560" cast={false} />
      <BoxField items={boxes} />
      <B p={[-54, CARGO_DECK + 5.4, 0]} s={[8, 10.8, 9.2]} c="#F2F2EA" /><B p={[-54, CARGO_DECK + 11.4, 0]} s={[9, 1.4, 10]} c="#2F3B57" /><B p={[-54, CARGO_DECK + 12.6, 0]} s={[3, 1.4, 3]} c="#E4E6E0" />
      <Cy p={[-57.5, CARGO_DECK + 13, 0]} r={1.2} h={3.4} c="#E0302A" /><Cy p={[-57.5, CARGO_DECK + 14.4, 0]} r={1.25} h={0.5} c="#262B33" cast={false} />
      <Windows items={win} hdr={new THREE.Color(1.6, 1.4, 1.0)} />
      <Rail x0={-48} x1={56} z={CARGO_RAIL_Z} y={CARGO_DECK + 0.1} h={1.2} /><Rail x0={-48} x1={56} z={-CARGO_RAIL_Z} y={CARGO_DECK + 0.1} h={1.2} />
      <Cy p={[40, CARGO_DECK + 8, 0]} r={0.25} h={16} c="#E8B23A" /><B p={[40, CARGO_DECK + 15.8, 0]} s={[0.6, 0.6, 14]} c="#E8B23A" cast={false} />
    </group>
  );
};

// ------------------------------------------------------------------ COAST GUARD HELICOPTER: local frame: +x nose, y up, +z = the camera side. Rotor disc radius 6.2 m. `f` drives the rotor; `cable` = rope length (m) below the winch tip.
export const HELI_HOOK: V3 = [0.4, 1.25, 1.75]; // winch tip in the helicopter frame
/** helicopter local point -> world (yaw about y, no tilt) */
export const heliWorld = (p: V3, yaw: number, l: V3): V3 => [p[0] + l[0] * Math.cos(yaw) + l[2] * Math.sin(yaw), p[1] + l[1], p[2] - l[0] * Math.sin(yaw) + l[2] * Math.cos(yaw)];
/** ONE assembled object. HELI_PARTS = bounding boxes of every part (local frame) and HELI_EDGES = which part is attached to which: the connectivity check (qa.ts) fails on any gap. */
export interface PartBox {name: string; c: V3; h: V3}
export const HELI_PARTS: PartBox[] = [
  {name: 'cabin', c: [0.2, 0.1, 0], h: [3.6, 1.35, 1.2]}, {name: 'nose', c: [2.6, 0, 0], h: [1.9, 1.15, 1.08]}, {name: 'glass', c: [3.5, 0.28, 0], h: [1.0, 0.82, 1.03]}, {name: 'roof', c: [0.6, 1.5, 0], h: [1.2, 0.45, 0.7]},
  {name: 'mast', c: [0.6, 2.2, 0], h: [0.12, 0.4, 0.12]}, {name: 'rotor hub', c: [0.6, 2.58, 0], h: [0.3, 0.1, 0.3]}, {name: 'boom', c: [-4.7, 0.55, 0], h: [3.3, 0.42, 0.42]}, {name: 'fin', c: [-7.8, 1.5, 0], h: [0.5, 1.15, 0.07]},
  {name: 'tail hub', c: [-7.9, 1.9, 0.1], h: [0.06, 0.06, 0.15]}, {name: 'strut f L', c: [-0.8, -1.0, 0.9], h: [0.07, 0.8, 0.07]}, {name: 'strut f R', c: [-0.8, -1.0, -0.9], h: [0.07, 0.8, 0.07]}, {name: 'strut r L', c: [2.0, -1.0, 0.9], h: [0.07, 0.8, 0.07]},
  {name: 'strut r R', c: [2.0, -1.0, -0.9], h: [0.07, 0.8, 0.07]}, {name: 'skid L', c: [0.2, -1.8, 0.9], h: [2.7, 0.06, 0.08]}, {name: 'skid R', c: [0.2, -1.8, -0.9], h: [2.7, 0.06, 0.08]}, {name: 'winch arm', c: [0.4, 1.3, 1.1], h: [0.06, 0.06, 0.6]},
];
export const HELI_EDGES: [string, string][] = [['cabin', 'nose'], ['nose', 'glass'], ['cabin', 'roof'], ['roof', 'mast'], ['mast', 'rotor hub'], ['cabin', 'boom'], ['boom', 'fin'], ['fin', 'tail hub'], ['cabin', 'strut f L'], ['cabin', 'strut f R'], ['cabin', 'strut r L'], ['nose', 'strut r R'], ['strut f L', 'skid L'], ['strut r L', 'skid L'], ['strut f R', 'skid R'], ['strut r R', 'skid R'], ['roof', 'winch arm']];
const bladeGeo = () => shared('heli-blade', () => { const g = new THREE.BoxGeometry(6.2, 0.07, 0.34); g.translate(3.1, 0, 0); return g; });
export const Heli: React.FC<{p: V3; yaw?: number; f: number; cable?: number; tilt?: number; rotorSpeed?: number}> = ({p, yaw = 0, f, cable = 0, tilt = 0, rotorSpeed = 0.82}) => {
  const ang = f * rotorSpeed, disc = useMemo(() => new THREE.MeshBasicMaterial({color: '#DFF4F2', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}), []);
  return (
    <group position={p} rotation={[tilt * 0.4, yaw, tilt]} userData={{qaHeli: true}}>
      <Sp p={[0.2, 0.1, 0]} s={[3.6, 1.35, 1.2]} c="#F4F4EC" /><Sp p={[2.6, 0.0, 0]} s={[1.9, 1.15, 1.08]} c="#F4F4EC" />
      <Sp p={[3.5, 0.28, 0]} s={[1.0, 0.82, 1.03]} c="#233A4E" basic /><B p={[-0.2, 0.0, 1.21]} s={[6.6, 0.28, 0.06]} c="#E0302A" cast={false} /><B p={[-0.2, 0.0, -1.21]} s={[6.6, 0.28, 0.06]} c="#E0302A" cast={false} />
      <B p={[0.6, 1.5, 0]} s={[2.4, 0.9, 1.4]} c="#E4E6E0" /><Cy p={[0.6, 2.2, 0]} r={0.12} h={0.8} c="#2B3A44" /><Cy p={[0.6, 2.58, 0]} r={0.3} h={0.16} c="#2B3A44" />
      <mesh position={[-4.7, 0.55, 0]} rotation={[0, 0, Math.PI / 2 + 0.03]} castShadow><cylinderGeometry args={[0.14, 0.42, 6.6, 14]} /><meshToonMaterial color="#F4F4EC" /></mesh>
      <B p={[-7.8, 1.5, 0]} s={[0.9, 2.3, 0.14]} c="#E0302A" rot={[0, 0, 0.28]} />
      <Cy p={[-7.9, 1.9, 0.1]} r={0.06} h={0.3} c="#2B3A44" rot={[Math.PI / 2, 0, 0]} />
      <group position={[-7.9, 1.9, 0.26]} rotation={[0, 0, ang * 1.6]}>{[0, 1].map((i) => <B key={i} p={[0, 0, 0]} s={[0.1, 2.0, 0.06]} rot={[0, 0, (i * Math.PI) / 2]} c="#2B3A44" basic cast={false} />)}</group>
      <group position={[0.6, 2.58, 0]} rotation={[0, ang, 0]}>{[0, 1, 2, 3].map((i) => <mesh key={i} geometry={bladeGeo()} rotation={[0, (i * Math.PI) / 2, 0]}><meshToonMaterial color="#2B3A44" /></mesh>)}</group>
      <mesh position={[0.6, 2.55, 0]} rotation={[-Math.PI / 2, 0, 0]} material={disc}><circleGeometry args={[6.3, 40]} /></mesh>
      {[1, -1].map((sg) => (<group key={sg}>{[-0.8, 2.0].map((x) => <Cy key={x} p={[x, -1.0, sg * 0.9]} r={0.07} h={1.6} c="#2B3A44" />)}<B p={[0.2, -1.8, sg * 0.9]} s={[5.4, 0.12, 0.16]} c="#2B3A44" /></group>))}
      <B p={[0.4, 1.3, 1.1]} s={[0.12, 0.12, 1.2]} c="#2B3A44" /><B p={[HELI_HOOK[0], HELI_HOOK[1], HELI_HOOK[2]]} s={[0.16, 0.16, 0.16]} c="#E8B23A" cast={false} />
      {cable > 0.05 && <Cy p={[HELI_HOOK[0], HELI_HOOK[1] - cable / 2, HELI_HOOK[2]]} r={0.022} h={cable} c="#2B2630" cast={false} />}
      <Glow p={[3.7, -0.1, 0]} size={1.6} color="#FFE2B0" intensity={0.6} />
    </group>
  );
};
