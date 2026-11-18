// COBRA_EFFECT shared parts: palette, cheap shared meshes (unit geometry + scale, shared toon materials with painted shadows),
// instanced snakes (3D tubes, flat unlit lime, small 2D head card with two dot eyes), coins.
// Render stability: every geometry and material goes through shared() (never disposed, never per instance), snake fields are built once per shot
// inside useMemo (InstancedMesh matrices written once), nothing is allocated per frame.
//
// PALETTE (one per video, 2026-11-16):
//   STREET  sky #5EC8E8 -> #BFEAF5, walls #E8B27A, terracotta #D9663F, road #C9A27E, painted shadow #8F5A3C   accent SNAKE LIME #7CE23B
//   OFFICE  wall #F2D9A0, wood desk #B0643A                                                                    accent COIN GOLD #FFD23F
//   GARAGE  wall #E3C08E, door #6E8FA8                                                                         accent SNAKE LIME #7CE23B
//   Characters: pure white unlit cards, outline #231A28.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RAMP, V3, hash, makeTex, shared} from '../kit/kit';

export const C = {
  skyTop: '#5EC8E8', skyBot: '#BFEAF5', wall: '#E8B27A', terra: '#D9663F', road: '#C9A27E', shade: '#8F5A3C',
  offWall: '#F2D9A0', wood: '#B0643A', garWall: '#E3C08E', garDoor: '#6E8FA8', lime: '#7CE23B', gold: '#FFD23F', ink: '#231A28',
} as const;

// ---------------------------------------------------------------- shared meshes (unit geometry, scaled per use)
const UBOX = () => shared('cb-ubox', () => new THREE.BoxGeometry(1, 1, 1));
const UCYL = () => shared('cb-ucyl', () => new THREE.CylinderGeometry(1, 1, 1, 20));
const UBALL = () => shared('cb-uball', () => new THREE.SphereGeometry(1, 18, 12));
const UPLANE = () => shared('cb-uplane', () => new THREE.PlaneGeometry(1, 1));
/** Toon material with the 3-step ramp and the kit's painted shadow cut (defines PAINTED_SHADOWS). One per colour, shared. */
export const tm = (c: string, side: THREE.Side = THREE.FrontSide) => shared(`cb-t${c}${side}`, () => { const m = new THREE.MeshToonMaterial({gradientMap: RAMP, color: c, side}); m.defines = {PAINTED_SHADOWS: ''}; return m; });
/** Flat unlit colour (snakes, coins glow, ink). */
export const bm = (c: string, side: THREE.Side = THREE.FrontSide) => shared(`cb-b${c}${side}`, () => new THREE.MeshBasicMaterial({color: c, toneMapped: false, side}));
/** Dark ink shell for occasional ink lines (inverted hull): `Hull` goes next to a mesh with the same geometry and a slightly larger scale. */
const inkM = () => bm(C.ink, THREE.BackSide);

type Rot = [number, number, number];
interface MP {p: V3; c: string; rot?: Rot; cast?: boolean; recv?: boolean; basic?: boolean; ink?: number}
/** Box, size s (w, h, d), centre p. ink > 0 adds a thin ink hull of that thickness (metres). */
export const B: React.FC<MP & {s: V3}> = ({p, s, c, rot, cast = true, recv = true, basic, ink = 0}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh geometry={UBOX()} material={basic ? bm(c) : tm(c)} scale={s} castShadow={cast} receiveShadow={recv} />
    {ink > 0 && <mesh geometry={UBOX()} material={inkM()} scale={[s[0] + ink * 2, s[1] + ink * 2, s[2] + ink * 2]} />}
  </group>
);
/** Cylinder along y, radius r, height h, centre p. rt = top radius factor is not supported (use Cone). */
export const Cy: React.FC<MP & {r: number; h: number}> = ({p, r, h, c, rot, cast = true, recv = true, basic, ink = 0}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh geometry={UCYL()} material={basic ? bm(c) : tm(c)} scale={[r, h, r]} castShadow={cast} receiveShadow={recv} />
    {ink > 0 && <mesh geometry={UCYL()} material={inkM()} scale={[r + ink, h + ink * 2, r + ink]} />}
  </group>
);
/** Ellipsoid with radii s. */
export const Sp: React.FC<MP & {s: V3}> = ({p, s, c, rot, cast = true, recv = true, basic, ink = 0}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh geometry={UBALL()} material={basic ? bm(c) : tm(c)} scale={s} castShadow={cast} receiveShadow={recv} />
    {ink > 0 && <mesh geometry={UBALL()} material={inkM()} scale={[s[0] + ink, s[1] + ink, s[2] + ink]} />}
  </group>
);
/** Plane w x h (facing +z before rot). map = texture (unlit when basic). */
export const Pl: React.FC<{p: V3; w: number; h: number; c?: string; rot?: Rot; map?: THREE.Texture; basic?: boolean; recv?: boolean; side?: THREE.Side}> = ({p, w, h, c = '#ffffff', rot, map, basic, recv = true, side = THREE.FrontSide}) => (
  <mesh geometry={UPLANE()} position={p} rotation={rot ?? [0, 0, 0]} scale={[w, h, 1]} receiveShadow={recv}>
    {map ? (basic ? <meshBasicMaterial map={map} toneMapped={false} side={side} transparent alphaTest={0.02} /> : <meshToonMaterial gradientMap={RAMP} map={map} color={c} side={side} defines={{PAINTED_SHADOWS: ''}} />) : <primitive object={basic ? bm(c, side) : tm(c, side)} attach="material" />}
  </mesh>
);

/** One instanced mesh of unit boxes with a colour per instance (windows, bricks, crates, boxes). Built once per mount. */
export interface BoxInst {p: V3; s: V3; c: string; ry?: number; rz?: number}
export const BoxField: React.FC<{items: BoxInst[]; cast?: boolean; basic?: boolean; map?: THREE.Texture}> = ({items, cast = true, basic, map}) => {
  const mesh = useMemo(() => {
    const bmat = map ? Object.assign(new THREE.MeshToonMaterial({gradientMap: RAMP, map}), {defines: {PAINTED_SHADOWS: ''}}) : basic ? bm('#ffffff') : tm('#ffffff');
    const m = new THREE.InstancedMesh(UBOX(), bmat, Math.max(1, items.length));
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    items.forEach((it, i) => { e.set(0, it.ry ?? 0, it.rz ?? 0); q.setFromEuler(e); mat.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s)); m.setMatrixAt(i, mat); m.setColorAt(i, col.set(it.c)); });
    m.count = items.length; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  }, [items, cast, basic, map]);
  return <primitive object={mesh} />;
};

// snakes: see ./snake.tsx (one continuous mesh per snake, path-buffer locomotion)
export * from './snake';
import type {SnakeShape, SnakeSpec} from './snake';

/** Deterministic scatter inside a rectangle (x0..x1, z0..z1), n snakes, avoiding the given circles [x, z, r]. */
export function scatter(n: number, seed: number, r: {x0: number; x1: number; z0: number; z1: number; y?: number}, o: {dead?: boolean; scale?: number; avoid?: [number, number, number][]; shapes?: SnakeShape[]} = {}): SnakeSpec[] {
  const out: SnakeSpec[] = [], shapes = o.shapes ?? ['S', 'tight', 'S', 'coil'];
  for (let i = 0, tries = 0; out.length < n && tries < n * 30; tries++, i++) {
    const x = r.x0 + hash(i + 1, seed) * (r.x1 - r.x0), z = r.z0 + hash(i + 7, seed + 3) * (r.z1 - r.z0);
    if (o.avoid?.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    out.push({x, z, y: r.y ?? 0, yaw: hash(i, seed + 9) * Math.PI * 2, shape: o.dead ? 'limp' : shapes[Math.floor(hash(i, seed + 5) * shapes.length) % shapes.length], dead: o.dead, s: (o.scale ?? 1) * (0.8 + hash(i, seed + 11) * 0.4), flip: hash(i, seed + 13) > 0.5});
  }
  return out;
}

// ---------------------------------------------------------------- coins
/** One coin: gold disc with a lighter inner disc and a raised rim, flat on a surface (y = surface height). r = radius in metres. */
export const Coin: React.FC<{p: V3; r?: number; rot?: Rot}> = ({p, r = 0.07, rot}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <Cy p={[0, r * 0.1, 0]} r={r} h={r * 0.2} c={C.gold} cast ink={0.004} />
    <Cy p={[0, r * 0.21, 0]} r={r * 0.72} h={r * 0.04} c="#FFE98A" cast={false} basic />
  </group>
);
export const CoinStack: React.FC<{p: V3; n: number; r?: number}> = ({p, n, r = 0.07}) => (
  <group position={p}>{Array.from({length: n}, (_, i) => <Cy key={i} p={[0, r * 0.1 + i * r * 0.22, 0]} r={r} h={r * 0.2} c={i % 2 ? C.gold : '#F2BE22'} ink={0.003} />)}</group>
);
/** Coin bag: round sack, tied neck, flared top, a gold coin badge on the front (no text). size = body radius. */
export const CoinBag: React.FC<{p: V3; size?: number; ry?: number}> = ({p, size = 0.22, ry = 0}) => (
  <group position={p} rotation={[0, ry, 0]}>
    <Sp p={[0, size * 0.95, 0]} s={[size, size * 1.0, size * 0.9]} c="#C98F4E" ink={0.012} />
    <Cy p={[0, size * 1.85, 0]} r={size * 0.32} h={size * 0.34} c="#B07A3C" ink={0.01} />
    <Cy p={[0, size * 2.05, 0]} r={size * 0.5} h={size * 0.12} c="#C98F4E" ink={0.008} />
    <Cy p={[0, size * 1.7, 0]} r={size * 0.36} h={size * 0.1} c="#7A4A20" />
    <Cy p={[0, size * 0.95, size * 0.82]} r={size * 0.36} h={size * 0.06} c={C.gold} rot={[Math.PI / 2, 0, 0]} basic />
  </group>
);

/** Tiny shared helper: a texture painted once (key = cache key within the shot). */
export const useCanvasTex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => useMemo(() => makeTex(w, h, draw), [key, w, h]); // eslint-disable-line react-hooks/exhaustive-deps

/** A hanging string (catenary-like parabola) from a to b with sag (m). Thin tube, shared per parameter set. */
export const Line3: React.FC<{a: V3; b: V3; sag: number; r?: number; c?: string}> = ({a, b, sag, r = 0.012, c = '#3E3A36'}) => {
  const g = useMemo(() => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 5, false); }, [a[0], a[1], a[2], b[0], b[1], b[2], sag, r]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={g} material={bm(c)} castShadow />;
};
/** Position on the same parabola (for flags / laundry hung on the string). */
export const onString = (a: V3, b: V3, sag: number, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
