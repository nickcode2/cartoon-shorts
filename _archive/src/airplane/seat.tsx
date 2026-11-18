// Airliner seat as a designed prop (STYLE_NOTES "PROPS v8"): beveled cushion on a seat pan, curved extruded backrest with a rounded top and a headrest,
// capsule armrests, metal seat frame (legs, rails, angled spars), lap belt with buckle, seat-back pocket and folded tray on the rear face.
// Cheap: ONE shared geometry per part and ONE shared material per colour for every seat in every shot (shared() in kit.tsx, never disposed), few
// meshes per seat (8 full, 2 for far seats), no per-seat allocations. Seat local space: floor at y 0, passenger faces +z, cushion top at y 0.30 (SEAT_TOP),
// cushion footprint x +-0.31, z -0.15..+0.23 (zone for the leg check). The character card stands at z = SEAT_CARD_DZ in front of the cushion.
import React from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {V3, shared} from '../kit/kit';
import {PS, rrShape} from './parts';

export const SEAT_TOP = 0.3;
export const SEAT_CARD_DZ = 0.36;
export const SEAT_ZONE = {c: [0, 0.04] as [number, number], half: [0.33, 0.19] as [number, number]}; // relative to the seat origin (x, z)

const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const put = (g: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0]) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  return ni(g).applyMatrix4(m);
};
const tube = (a: V3, b: V3, r: number) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, 10);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1));
  return ni(g).applyMatrix4(m);
};
const backShape = (w: number, h: number, rt: number, rb: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rb, 0); s.lineTo(w / 2 - rb, 0); s.quadraticCurveTo(w / 2, 0, w / 2, rb);
  s.lineTo(w / 2, h - rt); s.quadraticCurveTo(w / 2, h, w / 2 - rt, h); s.lineTo(-w / 2 + rt, h); s.quadraticCurveTo(-w / 2, h, -w / 2, h - rt);
  s.lineTo(-w / 2, rb); s.quadraticCurveTo(-w / 2, 0, -w / 2 + rb, 0);
  return s;
};
const extr = (shape: THREE.Shape, depth: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10});
  g.translate(0, 0, -depth / 2);
  return g;
};
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs, false)!;

const G = {
  cushion: () => shared('seat.cushion', () => new RoundedBoxGeometry(0.62, 0.1, 0.38, 4, 0.045).translate(0, 0.25, 0.04)),
  pan: () => shared('seat.pan', () => new RoundedBoxGeometry(0.56, 0.08, 0.34, 3, 0.03).translate(0, 0.17, 0.04)),
  back: () => shared('seat.back', () => put(extr(backShape(0.64, 0.8, 0.22, 0.06), 0.1, 0.025), [0, 0.28, -0.22], [-0.14, 0, 0])),
  head: () => shared('seat.head', () => put(extr(backShape(0.4, 0.24, 0.1, 0.1), 0.08, 0.02), [0, 1.1, -0.29], [-0.2, 0, 0])),
  arms: () => shared('seat.arms', () => merge([
    put(new THREE.CapsuleGeometry(0.033, 0.3, 4, 10), [-0.36, 0.45, -0.02], [Math.PI / 2, 0, 0]),
    put(new THREE.CapsuleGeometry(0.033, 0.3, 4, 10), [0.36, 0.45, -0.02], [Math.PI / 2, 0, 0]),
    tube([-0.36, 0.3, 0.06], [-0.36, 0.43, 0.06], 0.02), tube([0.36, 0.3, 0.06], [0.36, 0.43, 0.06], 0.02),
  ])),
  frame: () => shared('seat.frame', () => merge([
    tube([-0.26, 0, 0.06], [-0.26, 0.2, 0.02], 0.022), tube([0.26, 0, 0.06], [0.26, 0.2, 0.02], 0.022),
    tube([-0.26, 0, -0.1], [-0.26, 0.2, -0.06], 0.022), tube([0.26, 0, -0.1], [0.26, 0.2, -0.06], 0.022),
    tube([-0.26, 0.02, 0.06], [-0.26, 0.02, -0.1], 0.018), tube([0.26, 0.02, 0.06], [0.26, 0.02, -0.1], 0.018),
    tube([-0.26, 0.2, -0.02], [0.26, 0.2, -0.02], 0.018),
    tube([-0.26, 0.2, -0.06], [-0.28, 0.55, -0.24], 0.02), tube([0.26, 0.2, -0.06], [0.28, 0.55, -0.24], 0.02),
  ])),
  belt: () => shared('seat.belt', () => merge([
    put(new THREE.BoxGeometry(0.2, 0.012, 0.045), [-0.13, 0.309, 0.06], [0, 0, 0.06]), put(new THREE.BoxGeometry(0.2, 0.012, 0.045), [0.13, 0.309, 0.06], [0, 0, -0.06]),
    new RoundedBoxGeometry(0.07, 0.02, 0.06, 2, 0.008).translate(0, 0.314, 0.06),
  ])),
  pocket: () => shared('seat.pocket', () => merge([
    put(new THREE.ExtrudeGeometry(rrShape(0.4, 0.2, 0.05), {depth: 0.03, bevelEnabled: false}), [0, 0.58, -0.33]),
    new RoundedBoxGeometry(0.46, 0.3, 0.025, 2, 0.01).translate(0, 0.84, -0.32),
    new THREE.BoxGeometry(0.1, 0.025, 0.03).translate(0, 0.96, -0.32),
  ])),
  doily: () => shared('seat.doily', () => new RoundedBoxGeometry(0.34, 0.22, 0.012, 2, 0.005).translate(0, 0.82, -0.14)),
};
const M = (key: string, color: string, rough: number, metal = 0) => shared('seat.mat.' + key + color, () => {
  const m = new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal});
  m.defines = {...PS}; // painted shadows (kit.tsx paintShadow)
  return m;
});

export const Seat: React.FC<{p: V3; c: string; accent: string; retro?: boolean; lod?: boolean}> = ({p, c, accent, retro, lod}) => (
  <group position={p}>
    <mesh geometry={G.cushion()} material={M('cush', accent, 0.85)} castShadow receiveShadow />
    <mesh geometry={G.back()} material={M('back', c, 0.8)} castShadow receiveShadow />
    {!lod && (
      <>
        <mesh geometry={G.pan()} material={M('pan', '#352A57', 0.6)} castShadow receiveShadow />
        <mesh geometry={G.head()} material={M('head', accent, 0.85)} castShadow receiveShadow />
        <mesh geometry={G.arms()} material={M('arms', retro ? '#e9e6f5' : '#6A6CC0', 0.4, retro ? 0.7 : 0.1)} castShadow />
        <mesh geometry={G.frame()} material={M('frame', retro ? '#e9e6f5' : '#8f90b0', 0.3, 0.7)} castShadow />
        <mesh geometry={G.belt()} material={M('belt', '#1E1448', 0.6)} />
        <mesh geometry={G.pocket()} material={M('pocket', '#DCDDF3', 0.7)} castShadow />
        {retro && <mesh geometry={G.doily()} material={M('doily', '#f6f1fa', 0.95)} />}
      </>
    )}
  </group>
);
