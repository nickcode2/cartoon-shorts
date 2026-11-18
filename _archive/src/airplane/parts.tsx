// Building blocks for AIRPLANE_WINDOWS: rounded boxes, window units (modern three-pane with breather hole, Comet square), seats, clouds.
// Render stability: every geometry is made inside useMemo in the component (disposed with the shot), textures via makeTex/paintedTexture
// (tracked by the kit), no per-frame allocations (props only: positions, opacity, scale).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {V3, makeTex, shared} from '../kit/kit';
import {PAL} from '../kit/finish';

export const HDR_GOLD = new THREE.Color(3.4, 3.0, 1.9);
export const HDR_WARM = new THREE.Color(2.6, 2.0, 1.3);
export const HDR_SKY = new THREE.Color(1.5, 1.7, 2.6);

/** Painted shadows on: the shadow term of these materials is cut into three tones with hard brushy edges (kit.tsx paintShadow). */
export const PS = {PAINTED_SHADOWS: ''};
export const Mat: React.FC<{c?: string; map?: THREE.Texture; r?: number; m?: number; e?: THREE.Color | string; ei?: number; o?: number; side?: THREE.Side}> = ({c = '#ffffff', map, r = 0.7, m = 0, e, ei = 1, o, side}) => (
  <meshStandardMaterial color={c} map={map} roughness={r} metalness={m} emissive={e} emissiveIntensity={ei} transparent={o !== undefined} opacity={o ?? 1} depthWrite={o === undefined} side={side} defines={PS} />
);
export const B: React.FC<{s: V3; p: V3; rot?: V3; c?: string; map?: THREE.Texture; r?: number; m?: number; cast?: boolean; recv?: boolean; e?: THREE.Color | string; o?: number}> = ({s, p, rot, cast = true, recv = true, ...mp}) => (
  <mesh position={p} rotation={rot} castShadow={cast} receiveShadow={recv}>
    <boxGeometry args={s} />
    <Mat {...mp} />
  </mesh>
);
/** Rounded box (bevelled edges) for seats, cushions, panels. */
export const RB: React.FC<{s: V3; p: V3; rot?: V3; rad?: number; c?: string; map?: THREE.Texture; r?: number; m?: number; cast?: boolean; o?: number; e?: THREE.Color | string}> = ({s, p, rot, rad = 0.03, cast = true, ...mp}) => {
  const g = shared(`rb${s.join()},${rad}`, () => new RoundedBoxGeometry(s[0], s[1], s[2], 3, Math.min(rad, Math.min(...s) / 2 - 0.001))); // shared across instances and shots (never disposed)
  return (
    <mesh position={p} rotation={rot} geometry={g} castShadow={cast} receiveShadow>
      <Mat {...mp} />
    </mesh>
  );
};
export const Cy: React.FC<{r0: number; r1?: number; h: number; p: V3; rot?: V3; c: string; rough?: number; m?: number; open?: boolean; seg?: number; o?: number; cast?: boolean; e?: THREE.Color | string}> = ({r0, r1, h, p, rot, c, rough = 0.6, m = 0, open, seg = 28, o, cast = true, e}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow>
    <cylinderGeometry args={[r1 ?? r0, r0, h, seg, 1, open]} />
    <Mat c={c} r={rough} m={m} o={o} side={open ? THREE.DoubleSide : THREE.FrontSide} e={e} />
  </mesh>
);
export const Ball: React.FC<{r: number; p: V3; c: string; s?: V3; rough?: number; m?: number; e?: THREE.Color | string; o?: number; cast?: boolean}> = ({r, p, c, s, rough = 0.6, m = 0, e, o, cast = false}) => (
  <mesh position={p} scale={s} castShadow={cast}>
    <sphereGeometry args={[r, 20, 14]} />
    <Mat c={c} r={rough} m={m} e={e} o={o} />
  </mesh>
);

// ---------------------------------------------------------------- rounded-rectangle shapes
export function rrPath<T extends THREE.Path>(p: T, cx: number, cy: number, w: number, h: number, r: number): T {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, k = Math.min(r, w / 2, h / 2);
  p.moveTo(x0 + k, y0);
  p.lineTo(x1 - k, y0); p.absarc(x1 - k, y0 + k, k, -Math.PI / 2, 0, false);
  p.lineTo(x1, y1 - k); p.absarc(x1 - k, y1 - k, k, 0, Math.PI / 2, false);
  p.lineTo(x0 + k, y1); p.absarc(x0 + k, y1 - k, k, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + k); p.absarc(x0 + k, y0 + k, k, Math.PI, Math.PI * 1.5, false);
  return p;
}
export const rrShape = (w: number, h: number, r: number) => rrPath(new THREE.Shape(), 0, 0, w, h, r);
/** Wall plate (local x along the wall, y up, normal +z) with rounded-rect window holes at the given centres. */
export function wallGeometry(len: number, hgt: number, holes: [number, number][], ww: number, wh: number, wr: number) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, hgt); s.lineTo(-len / 2, hgt); s.closePath();
  for (const [cx, cy] of holes) s.holes.push(rrPath(new THREE.Path(), cx, cy, ww, wh, wr));
  const g = new THREE.ShapeGeometry(s, 10);
  return g;
}
/** Raised frame ring around a window opening (rounded, bevelled), extruded `depth` toward +z. */
export function ringGeometry(w: number, h: number, r: number, border: number, depth: number) {
  const s = rrShape(w + 2 * border, h + 2 * border, r + border);
  s.holes.push(rrPath(new THREE.Path(), 0, 0, w, h, r));
  return new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: true, bevelSize: border * 0.25, bevelThickness: border * 0.25, bevelSegments: 2, curveSegments: 10});
}
export function slabGeometry(w: number, h: number, r: number, depth: number) {
  return new THREE.ExtrudeGeometry(rrShape(w, h, r), {depth, bevelEnabled: false, curveSegments: 10});
}

// ---------------------------------------------------------------- window units (local: +z toward the cabin, wall plane at z = 0)
export interface WinSpec {w: number; h: number; r: number}
export const MODERN_WIN: WinSpec = {w: 0.36, h: 0.5, r: 0.15};
export const COMET_WIN: WinSpec = {w: 0.7, h: 0.62, r: 0.03};

/** Modern airliner window: shaded reveal, scratch pane (inner), middle pane with the breather hole near the bottom, outer pane. */
export const ModernWindow: React.FC<{spec?: WinSpec; holeGlow?: number}> = ({spec = MODERN_WIN, holeGlow = 0}) => {
  const {w, h, r} = spec;
  const ring = useMemo(() => ringGeometry(w, h, r, 0.045, 0.07), [w, h, r]);
  const slab = useMemo(() => slabGeometry(w + 0.02, h + 0.02, r, 0.012), [w, h, r]);
  const reveal = useMemo(() => {
    const s = new THREE.Shape();
    rrPath(s, 0, 0, w + 0.1, h + 0.1, r + 0.05);
    s.holes.push(rrPath(new THREE.Path(), 0, 0, w, h, r));
    return new THREE.ExtrudeGeometry(s, {depth: 0.05, bevelEnabled: false, curveSegments: 10});
  }, [w, h, r]);
  const hy = -h / 2 + 0.07; // breather hole height (bottom of the middle pane)
  return (
    <group>
      {/* inner plastic reveal and frame ring: cabin side */}
      <mesh geometry={ring} position={[0, 0, -0.01]} castShadow receiveShadow><Mat c={PAL.lavender.base} r={0.55} /></mesh>
      <mesh geometry={reveal} position={[0, 0, -0.06]} receiveShadow><Mat c="#cfd0ee" r={0.8} /></mesh>
      {/* scratch pane (inner), middle pane, outer pane */}
      <mesh geometry={slab} position={[0, 0, -0.02]}><Mat c="#d9e4ff" r={0.1} o={0.16} /></mesh>
      <mesh geometry={slab} position={[0, 0, -0.07]}><Mat c="#cfdcff" r={0.1} o={0.2} /></mesh>
      <mesh geometry={slab} position={[0, 0, -0.12]}><Mat c="#c4d4ff" r={0.1} o={0.24} /></mesh>
      {/* breather hole in the middle pane: dark opening with a pale rim, optional warm glow when the shot points at it */}
      <mesh position={[0, hy, -0.057]}><circleGeometry args={[0.03, 24]} /><meshBasicMaterial color="#1E1448" toneMapped={false} /></mesh>
      <mesh position={[0, hy, -0.058]}><ringGeometry args={[0.03, 0.04, 24]} /><meshBasicMaterial color="#F5C2A0" toneMapped={false} /></mesh>
      {holeGlow > 0 && <mesh position={[0, hy, -0.055]}><circleGeometry args={[0.03 + 0.03 * holeGlow, 24]} /><meshBasicMaterial color={HDR_GOLD} transparent opacity={0.55 * holeGlow} toneMapped={false} depthWrite={false} /></mesh>}
    </group>
  );
};

/** 1950s Comet window: big, nearly square, chunky chrome frame, single thick pane. */
export const CometWindow: React.FC<{spec?: WinSpec}> = ({spec = COMET_WIN}) => {
  const {w, h, r} = spec;
  const ring = useMemo(() => ringGeometry(w, h, r, 0.07, 0.09), [w, h, r]);
  const slab = useMemo(() => slabGeometry(w + 0.02, h + 0.02, r, 0.02), [w, h, r]);
  return (
    <group>
      <mesh geometry={ring} position={[0, 0, -0.01]} castShadow receiveShadow><Mat c="#e9e6f5" r={0.25} m={0.7} /></mesh>
      <mesh geometry={slab} position={[0, 0, -0.04]}><Mat c="#cfdcff" r={0.1} o={0.22} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- clouds (outside the windows, in the sky set)
export const Clouds: React.FC<{items: [number, number, number, number][]; tint?: string}> = ({items, tint = '#f3eefc'}) => (
  <group>
    {items.map(([x, y, z, s], i) => (
      <group key={i} position={[x, y, z]} scale={s}>
        {[[0, 0, 0, 1], [0.9, -0.1, 0.2, 0.8], [-0.95, -0.15, 0, 0.85], [0.3, 0.45, -0.1, 0.75], [-0.4, 0.3, 0.3, 0.65]].map(([a, b, c, d], j) => (
          <mesh key={j} position={[a, b, c]} scale={[d, d * 0.78, d]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={tint} roughness={1} emissive={'#8f90e0'} emissiveIntensity={0.18} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

/** Soft painted floor/ceiling-type texture with panel lines. */
export const useStripeTex = (key: string, a: string, b: string, rep: [number, number]) =>
  useMemo(() => makeTex(256, 256, (c, w, h) => {
    c.fillStyle = a; c.fillRect(0, 0, w, h);
    c.fillStyle = b; for (let i = 0; i < 8; i++) c.fillRect(0, i * (h / 8), w, h / 16);
    c.strokeStyle = 'rgba(30,20,72,0.25)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
  }, rep), [key]); // eslint-disable-line react-hooks/exhaustive-deps
