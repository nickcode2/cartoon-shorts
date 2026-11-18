// OVERBOARD_SURVIVOR interiors (GlintGaze warm palette): LOUNGE STAGE (air guitar contest: stage, truss + coloured spotlights, curtain, speakers, crowd floor, hero TROPHY), CORRIDOR (doors, carpet
// runner, ceiling lights, restroom door with a pictogram), CABIN (bunk beds, porthole, lamp), RECEPTION (desk, key cubbies, clock). Floors / walls carry designed textures only (no random clutter).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex, shared} from '../kit/kit';
import {B, Cy, Sp, Pl, BoxField, BoxInst} from '../cobra/common';
import {Glow} from '../kit/finish';
import {LAMP_HDR} from './ocean';

const gold = () => shared('os-gold', () => new THREE.MeshToonMaterial({color: '#C99528'}));
const goldHi = () => shared('os-goldhi', () => new THREE.MeshBasicMaterial({color: new THREE.Color(1.5, 1.25, 0.8), toneMapped: false}));
const diamondFloor = (a: string, b: string, line: string) => makeTex(256, 256, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 64 + 32, y = j * 64 + 32; c.beginPath(); c.moveTo(x, y - 26); c.lineTo(x + 26, y); c.lineTo(x, y + 26); c.lineTo(x - 26, y); c.closePath(); c.fill(); } c.strokeStyle = line; c.lineWidth = 3; c.strokeRect(0, 0, w, h); const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.75); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.14)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, [6, 5]);
const Beam: React.FC<{a: V3; b: V3; w: number; color: string; op?: number}> = ({a, b, w, color, op = 0.2}) => {
  const q = useMemo(() => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.clone().normalize()); }, [a, b]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), tex = useMemo(() => makeTex(32, 128, (c, ww, h) => { const g = c.createLinearGradient(0, 0, ww, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, ww, h); c.globalCompositeOperation = 'destination-in'; const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0.15)'); c.fillStyle = v; c.fillRect(0, 0, ww, h); }), []);
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} scale={[w, len, 1]} renderOrder={20}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={tex} color={color} transparent opacity={op} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>;
};

// ------------------------------------------------------------------ the TROPHY (hero): round walnut base, gold collar and pole, a gold guitar with sound hole, bridge, neck, headstock, star on top
export const TROPHY_H = 0.44;
/** grip anchors (world) of a held trophy: both hands on the pole just above the base, `hand` = the pole centre */
export const trophyGrips = (p: V3, s = 1): V3[] => [[p[0], p[1] + 0.2 * s, p[2]]];
export const Trophy: React.FC<{p: V3; s?: number; spin?: number}> = ({p, s = 1, spin = 0}) => (
  <group position={p} scale={s} rotation={[0, spin, 0]} userData={{qaBox: {name: 'trophy', c: [p[0], p[1] + 0.2 * s, p[2]], h: [0.1 * s, 0.22 * s, 0.1 * s]}}}>
    <Cy p={[0, 0.03, 0]} r={0.12} h={0.06} c="#5A3A22" /><Cy p={[0, 0.075, 0]} r={0.1} h={0.03} c="#E8B23A" />
    <mesh position={[0, 0.2, 0]} material={gold()}><cylinderGeometry args={[0.013, 0.016, 0.24, 10]} /></mesh>
    <group position={[0, 0.3, 0]} rotation={[0, 0, 0.32]}>
      <mesh position={[0, -0.04, 0]} scale={[1, 1.15, 0.3]} material={gold()}><sphereGeometry args={[0.085, 20, 14]} /></mesh>
      <mesh position={[0, 0.045, 0]} scale={[1, 1, 0.3]} material={gold()}><sphereGeometry args={[0.062, 18, 12]} /></mesh>
      <mesh position={[0, -0.03, 0.026]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]}><circleGeometry args={[0.024, 16]} /><meshBasicMaterial color="#5A3A22" /></mesh>
      <mesh position={[0, -0.095, 0.025]} material={goldHi()}><boxGeometry args={[0.07, 0.012, 0.006]} /></mesh>
      <mesh position={[0.026, -0.06, 0.03]} rotation={[0, 0, 0.5]} material={goldHi()} scale={[0.4, 1.8, 0.3]}><sphereGeometry args={[0.012, 8, 6]} /></mesh>
      <mesh position={[0, 0.17, 0]} material={gold()}><boxGeometry args={[0.022, 0.22, 0.018]} /></mesh>
      <mesh position={[0, 0.305, 0]} material={gold()}><boxGeometry args={[0.04, 0.05, 0.02]} /></mesh>
      {[-0.012, 0, 0.012].map((x, i) => <mesh key={i} position={[x, 0.03, 0.032]} material={goldHi()}><boxGeometry args={[0.002, 0.34, 0.002]} /></mesh>)}
    </group>
    <mesh position={[0.1, 0.5, 0]} rotation={[0, 0, 0.2]} material={goldHi()}><octahedronGeometry args={[0.035, 0]} /></mesh>
    <Glow p={[0, 0.3, 0.05]} size={0.7} color="#FFD98A" intensity={0.55} />
  </group>
);

// ------------------------------------------------------------------ LOUNGE STAGE. Local frame: the stage is at the back (z = -7 .. -4, top y = 0.8), the audience floor in front (z > -4), the camera in front.
export const Stage: React.FC<{f: number; t?: number}> = ({f}) => {
  const floor = useMemo(() => diamondFloor('#1F5F6E', '#2A7F86', '#12404B'), []), wood = useMemo(() => makeTex(256, 128, (c, w, h) => { c.fillStyle = '#9A6A3E'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(40,20,5,0.28)'; c.fillRect(0, i * 16, w, 2); c.fillStyle = `rgba(255,220,170,${0.05 + (i % 3) * 0.03})`; c.fillRect(0, i * 16 + 2, w, 14); } }, [4, 1]), []);
  const curtains: BoxInst[] = []; for (let i = 0; i < 22; i++) curtains.push({p: [-9 + i * 0.86, 3.4, -8.1 + 0.12 * Math.sin(i * 1.3)], s: [0.8, 6.8, 0.3 + 0.12 * (i % 2)], c: i % 2 ? '#B8332B' : '#9E2A24'});
  const lamps = [-5.2, -2.6, 0, 2.6, 5.2], cols = ['#FF5A8A', '#3FD0E0', '#FFD25A', '#7A8CFF', '#FF8A3A'];
  const br = 0.8 + 0.2 * Math.sin(f * 0.25);
  return (
    <group>
      <mesh position={[0, 0, -2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 24]} /><meshToonMaterial map={floor} /></mesh>
      <BoxField items={curtains} cast={false} /><B p={[0, 7.0, -7.9]} s={[20, 0.5, 0.7]} c="#E8B23A" cast={false} />
      <B p={[-10.5, 3.5, -2]} s={[0.4, 7, 14]} c="#F6E8C8" /><B p={[10.5, 3.5, -2]} s={[0.4, 7, 14]} c="#F6E8C8" /><B p={[0, 7.2, -2]} s={[22, 0.4, 14]} c="#3A6F7A" cast={false} />
      <mesh position={[0, 0.4, -5.6]} receiveShadow castShadow><boxGeometry args={[12.4, 0.8, 4.4]} /><meshToonMaterial map={wood} /></mesh>
      <B p={[0, 0.78, -3.38]} s={[12.6, 0.1, 0.1]} c="#E8B23A" cast={false} /><B p={[0, 0.05, -3.41]} s={[12.4, 0.1, 0.06]} c="#2B3A44" cast={false} />
      {[-4.4, -1.5, 1.5, 4.4].map((x, i) => <B key={i} p={[x, 0.82, -3.48]} s={[0.35, 0.02, 0.35]} c="#FFFFFF" basic cast={false} />)}
      <B p={[0, 7.3 - 0.9, -3.2]} s={[14, 0.14, 0.14]} c="#2B3A44" cast={false} />
      {lamps.map((x, i) => (<group key={i}><Cy p={[x, 6.1, -3.2]} r={0.2} h={0.5} c="#2B3A44" cast={false} /><mesh position={[x, 5.85, -3.2]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color={new THREE.Color(cols[i]).multiplyScalar(3)} toneMapped={false} /></mesh><Beam a={[x, 5.8, -3.2]} b={[x * 0.6 + (i % 2 ? 1 : -1) * 0.5, 0.82, -5.2]} w={1.6} color={cols[i]} op={0.2 * br} /><Glow p={[x, 5.8, -3.2]} size={1.6} color={cols[i]} intensity={0.7} /></group>))}
      {[-8.5, 8.5].map((x, i) => (<group key={i}><B p={[x, 1.4, -5.6]} s={[1.4, 2.8, 1.2]} c="#2B3A44" /><Cy p={[x, 0.9, -4.98]} r={0.45} h={0.1} c="#12202A" rot={[Math.PI / 2, 0, 0]} cast={false} /><Cy p={[x, 1.9, -4.98]} r={0.3} h={0.1} c="#12202A" rot={[Math.PI / 2, 0, 0]} cast={false} /></group>))}
      <mesh position={[0, 6.2, -1.2]}><icosahedronGeometry args={[0.5, 1]} /><meshBasicMaterial color="#DDE9EE" /></mesh><Cy p={[0, 6.8, -1.2]} r={0.02} h={1.0} c="#2B3A44" cast={false} /><Glow p={[0, 6.2, -1.2]} size={2.4} color="#FFFFFF" intensity={0.5} />
      <B p={[0, 3.2, -7.7]} s={[9.5, 4.4, 0.1]} c="#2F7FA0" cast={false} /><BoxField items={Array.from({length: 13}, (_, i) => ({p: [-4.5 + i * 0.75, 3.2, -7.63] as V3, s: [0.16, 4.4, 0.04] as V3, c: i % 2 ? '#4FA9C4' : '#256C8A'}))} cast={false} /><BoxField items={Array.from({length: 9}, (_, i) => ({p: [-4.2 + i * 1.05, 5.1 - 0.25 * Math.abs(i - 4), -7.6] as V3, s: [0.5, 0.5, 0.04] as V3, c: ['#E8B23A', '#E0302A', '#F6E8C8'][i % 3]}))} cast={false} />{[-3.5, -1.2, 1.2, 3.5].map((x, i) => <B key={i} p={[x, 3.2 + (i % 2) * 0.8, -7.62]} s={[0.5, 0.5, 0.05]} c="#FFE9A0" basic cast={false} rot={[0, 0, 0.785]} />)}
    </group>
  );
};

// ------------------------------------------------------------------ CORRIDOR: runs along z (from +9 to -14); width 2.6 (x -1.3 .. 1.3); the restroom door is the end wall at z = -14
export const Corridor: React.FC<{open?: number}> = ({open = 0}) => {
  const carpet = useMemo(() => makeTex(128, 256, (c, w, h) => { c.fillStyle = '#7A2E3A'; c.fillRect(0, 0, w, h); c.fillStyle = '#B8553F'; c.fillRect(10, 0, 12, h); c.fillRect(w - 22, 0, 12, h); for (let j = 0; j < 8; j++) { c.fillStyle = '#E8B23A'; c.beginPath(); c.moveTo(w / 2, j * 32 + 4); c.lineTo(w / 2 + 14, j * 32 + 16); c.lineTo(w / 2, j * 32 + 28); c.lineTo(w / 2 - 14, j * 32 + 16); c.closePath(); c.fill(); } c.strokeStyle = '#F6E8C8'; c.lineWidth = 3; c.strokeRect(4, 0, w - 8, h); }, [1, 7]), []);
  const pic = useMemo(() => makeTex(128, 128, (c, w, h) => { c.fillStyle = '#2F5F7F'; c.fillRect(0, 0, w, h); c.strokeStyle = '#F6E8C8'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#F6E8C8'; for (const x of [40, 88]) { c.beginPath(); c.arc(x, 34, 11, 0, 7); c.fill(); c.fillRect(x - 12, 48, 24, 38); c.fillRect(x - 11, 86, 8, 24); c.fillRect(x + 3, 86, 8, 24); } c.fillStyle = '#E8B23A'; c.fillRect(w / 2 - 2, 20, 4, 90); }), []);
  const doors: React.ReactElement[] = [];
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const z = 6 - i * 3, c = i % 2 ? '#3F7F95' : '#2F6F85'; doors.push(<group key={`${i}${s}`}><B p={[s * 1.24, 1.05, z]} s={[0.1, 2.1, 0.95]} c={c} cast={false} /><B p={[s * 1.2, 1.05, z - 0.52]} s={[0.14, 2.2, 0.08]} c="#F6E8C8" cast={false} /><B p={[s * 1.2, 1.05, z + 0.52]} s={[0.14, 2.2, 0.08]} c="#F6E8C8" cast={false} /><B p={[s * 1.2, 2.14, z]} s={[0.14, 0.08, 1.1]} c="#F6E8C8" cast={false} /><Sp p={[s * 1.17, 1.0, z + 0.34]} s={[0.05, 0.05, 0.05]} c="#E8B23A" basic cast={false} /><B p={[s * 1.18, 1.65, z]} s={[0.04, 0.12, 0.2]} c="#E8B23A" basic cast={false} /></group>); }
  return (
    <group>
      <mesh position={[0, 0.001, -2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[2.6, 24]} /><meshToonMaterial color="#E8D8B8" /></mesh>
      <mesh position={[0, 0.012, -2.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.5, 24]} /><meshToonMaterial map={carpet} /></mesh>
      <B p={[-1.32, 1.2, -2.5]} s={[0.1, 2.4, 24]} c="#F2E4C6" cast={false} /><B p={[1.32, 1.2, -2.5]} s={[0.1, 2.4, 24]} c="#F2E4C6" cast={false} />
      <B p={[-1.27, 0.45, -2.5]} s={[0.06, 0.9, 24]} c="#B8553F" cast={false} /><B p={[1.27, 0.45, -2.5]} s={[0.06, 0.9, 24]} c="#B8553F" cast={false} /><B p={[0, 2.45, -2.5]} s={[2.7, 0.1, 24]} c="#F6E8C8" cast={false} />
      {doors}
      {[8, 3, -2, -7, -12].map((z, i) => (<group key={i}><B p={[0, 2.38, z]} s={[0.5, 0.05, 1.1]} c="#FFFFFF" basic cast={false} /><mesh position={[0, 2.34, z]}><boxGeometry args={[0.46, 0.02, 1.0]} /><meshBasicMaterial color={new THREE.Color(2.6, 2.3, 1.7)} toneMapped={false} /></mesh><Glow p={[0, 2.2, z]} size={2.4} color="#FFD9A0" intensity={0.6} /></group>))}
      <B p={[0, 1.2, -14.1]} s={[2.7, 2.4, 0.15]} c="#F2E4C6" cast={false} />
      <group position={[0, 0, -14.0]}>
        <B p={[-0.55, 1.0, 0.0]} s={[0.1, 2.1, 0.12]} c="#F6E8C8" cast={false} /><B p={[0.55, 1.0, 0.0]} s={[0.1, 2.1, 0.12]} c="#F6E8C8" cast={false} /><B p={[0, 2.06, 0.0]} s={[1.2, 0.1, 0.12]} c="#F6E8C8" cast={false} />
        <group position={[-0.5, 0, 0.0]} rotation={[0, open * 1.55, 0]}>
          <B p={[0.5, 1.0, 0.0]} s={[1.0, 2.0, 0.08]} c="#3FA7C9" /><B p={[0.5, 1.0, 0.045]} s={[0.82, 1.8, 0.03]} c="#2F8FB0" cast={false} /><Sp p={[0.88, 0.95, 0.08]} s={[0.05, 0.05, 0.05]} c="#E8B23A" basic cast={false} />
          <Pl p={[0.5, 1.55, 0.065]} w={0.46} h={0.46} map={pic} basic />
        </group>
        <B p={[0, 1.0, -1.1]} s={[1.1, 2.0, 0.05]} c="#8FD8E8" cast={false} /><B p={[-0.58, 1.0, -0.6]} s={[0.05, 2.0, 1.2]} c="#7CCBDD" cast={false} /><B p={[0.58, 1.0, -0.6]} s={[0.05, 2.0, 1.2]} c="#7CCBDD" cast={false} /><B p={[0, 0.01, -0.6]} s={[1.1, 0.02, 1.2]} c="#E8F4F6" cast={false} /><B p={[0.3, 0.8, -1.0]} s={[0.4, 0.1, 0.3]} c="#FFFFFF" cast={false} />
        {open > 0.05 && <Glow p={[0, 1.4, -0.5]} size={2.2} color="#DFF8FF" intensity={0.6 * open} />}
      </group>
      <B p={[-1.28, 1.5, -13.2]} s={[0.04, 0.5, 0.6]} c="#F6E8C8" basic cast={false} />
    </group>
  );
};

// ------------------------------------------------------------------ CABIN: 4.2 x 2.8 x 2.5 (x -2.1..2.1, z -1.8..1.0). Bunk bed on the left wall; the porthole on the back wall shows the night sea.
export const Cabin: React.FC<{lamp?: boolean}> = ({lamp = true}) => {
  const floor = useMemo(() => makeTex(256, 256, (c, w, h) => { c.fillStyle = '#C79B62'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(80,45,15,${0.1 + (i % 2) * 0.06})`; c.fillRect(0, i * 32, w, 3); } }, [2, 2]), []);
  const sea = useMemo(() => makeTex(64, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1A5F7C'); g.addColorStop(0.5, '#4DB1B0'); g.addColorStop(0.52, '#1B8196'); g.addColorStop(1, '#0F5468'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#FFF4D2'; c.beginPath(); c.arc(44, 28, 7, 0, 7); c.fill(); }), []);
  return (
    <group>
      <mesh position={[0, 0, -0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[4.2, 2.8]} /><meshToonMaterial map={floor} /></mesh>
      <B p={[0, 1.25, -1.82]} s={[4.3, 2.5, 0.08]} c="#F2E4C6" cast={false} /><B p={[-2.12, 1.25, -0.4]} s={[0.08, 2.5, 2.9]} c="#E8D8B8" cast={false} /><B p={[2.12, 1.25, -0.4]} s={[0.08, 2.5, 2.9]} c="#E8D8B8" cast={false} /><B p={[0, 2.52, -0.4]} s={[4.3, 0.08, 2.9]} c="#F8F0DC" cast={false} /><B p={[0, 0.5, -1.77]} s={[4.3, 1.0, 0.04]} c="#3F7F95" cast={false} />
      <B p={[0, 1.8, -1.78]} s={[1.0, 1.0, 0.06]} c="#E8B23A" cast={false} /><mesh position={[0, 1.8, -1.745]}><circleGeometry args={[0.4, 28]} /><meshBasicMaterial map={sea} toneMapped={false} /></mesh>
      {[0, 1].map((k) => (<group key={k}><B p={[-1.45, 0.38 + k * 1.2, -0.8]} s={[1.2, 0.14, 2.2]} c="#6B4A32" /><B p={[-1.45, 0.52 + k * 1.2, -0.8]} s={[1.14, 0.14, 2.1]} c={k ? '#3FA7C9' : '#E0302A'} />{k === 0 && <B p={[-1.3, 0.66, -0.2]} s={[1.0, 0.14, 1.2]} c="#F6E8C8" rot={[0, 0.1, 0.04]} />}<B p={[-1.45, 0.62 + k * 1.2, -1.7]} s={[0.7, 0.16, 0.35]} c="#FFFFFF" cast={false} /></group>))}
      {[[-2.0, -1.7], [-0.9, -1.7], [-2.0, 0.28], [-0.9, 0.28]].map(([x, z], i) => <Cy key={i} p={[x, 1.1, z]} r={0.035} h={2.2} c="#6B4A32" />)}
      <B p={[-0.88, 1.6, -0.7]} s={[0.04, 0.5, 2.1]} c="#6B4A32" cast={false} /><B p={[-1.45, 0.95, 0.27]} s={[0.04, 1.8, 0.04]} c="#CFCFC6" cast={false} />
      <B p={[-1.1, 0.46, 0.34]} s={[0.04, 0.9, 0.04]} c="#6B4A32" cast={false} /><B p={[-1.1, 0.12, 0.3]} s={[0.1, 0.24, 0.5]} c="#6B4A32" cast={false} />
      <B p={[1.6, 0.4, -1.4]} s={[0.9, 0.8, 0.5]} c="#7A5C3E" /><B p={[1.6, 0.84, -1.4]} s={[1.0, 0.06, 0.55]} c="#E8D8B8" cast={false} />
      {lamp && (<><Cy p={[1.45, 0.98, -1.4]} r={0.05} h={0.28} c="#E8B23A" cast={false} /><mesh position={[1.45, 1.2, -1.4]}><coneGeometry args={[0.2, 0.22, 14, 1, true]} /><meshBasicMaterial color={new THREE.Color(3, 2.5, 1.6)} toneMapped={false} side={THREE.DoubleSide} /></mesh><Glow p={[1.45, 1.15, -1.35]} size={1.6} color="#FFD9A0" intensity={0.8} /></>)}
      <B p={[1.55, 0.2, 0.35]} s={[0.8, 0.4, 0.5]} c="#C9657A" /><B p={[1.55, 0.42, 0.35]} s={[0.4, 0.06, 0.06]} c="#2B3A44" cast={false} />
    </group>
  );
};

// ------------------------------------------------------------------ RECEPTION (x -2.4..2.4, back wall at z = -1.6, the counter at z = -0.5)
export const Reception: React.FC<{}> = () => {
  const cub = useMemo(() => { const o: BoxInst[] = []; for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) { o.push({p: [-1.4 + i * 0.4, 0.95 + j * 0.34, -1.5], s: [0.34, 0.28, 0.12], c: '#4A3426'}); if (hash(i, j) < 0.45) o.push({p: [-1.4 + i * 0.4, 0.95 + j * 0.34, -1.43], s: [0.05, 0.12, 0.05], c: '#E8B23A'}); } return o; }, []);
  const floor = useMemo(() => diamondFloor('#E8D8B8', '#C9657A', '#8A6A50'), []);
  const clock = useMemo(() => makeTex(128, 128, (c, w, h) => { c.fillStyle = '#F8F0DC'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#2B3A44'; c.lineWidth = 6; c.stroke(); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.fillStyle = '#2B3A44'; c.fillRect(64 + Math.sin(a) * 50 - 3, 64 - Math.cos(a) * 50 - 3, 6, 6); } c.lineWidth = 6; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 28); c.moveTo(64, 64); c.lineTo(90, 76); c.stroke(); }), []);
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[5.4, 4]} /><meshToonMaterial map={floor} /></mesh>
      <B p={[0, 1.4, -1.62]} s={[5.6, 2.8, 0.1]} c="#2F6F85" cast={false} /><B p={[-2.7, 1.4, 0]} s={[0.1, 2.8, 4]} c="#2F6F85" cast={false} /><B p={[2.7, 1.4, 0]} s={[0.1, 2.8, 4]} c="#2F6F85" cast={false} /><B p={[0, 2.84, 0]} s={[5.6, 0.1, 4]} c="#F6E8C8" cast={false} />
      <B p={[0, 1.6, -1.56]} s={[3.6, 2.0, 0.08]} c="#6B4A32" cast={false} /><BoxField items={cub} cast={false} />
      <mesh position={[0, 2.5, -1.54]}><circleGeometry args={[0.28, 24]} /><meshBasicMaterial map={clock} toneMapped={false} /></mesh>
      <B p={[0, 0.5, -0.5]} s={[3.2, 1.0, 0.7]} c="#7A5C3E" /><B p={[0, 1.04, -0.5]} s={[3.4, 0.08, 0.84]} c="#F2E4C6" /><B p={[0, 0.5, -0.14]} s={[3.0, 0.8, 0.04]} c="#5A3A22" cast={false} />
      <B p={[1.1, 1.3, -0.6]} s={[0.5, 0.32, 0.05]} c="#2B3A44" /><B p={[1.1, 1.14, -0.6]} s={[0.1, 0.2, 0.08]} c="#2B3A44" cast={false} /><mesh position={[1.1, 1.3, -0.57]}><planeGeometry args={[0.44, 0.26]} /><meshBasicMaterial color={new THREE.Color(0.6, 1.4, 1.4)} toneMapped={false} /></mesh>
      <Sp p={[-0.9, 1.1, -0.4]} s={[0.07, 0.04, 0.07]} c="#E8B23A" /><Cy p={[-0.9, 1.15, -0.4]} r={0.012} h={0.06} c="#E8B23A" cast={false} />
      <Cy p={[-1.9, 0.3, -1.1]} r={0.3} h={0.6} c="#B8553F" /><Sp p={[-1.9, 0.95, -1.1]} s={[0.5, 0.55, 0.5]} c="#35B36B" />
      <Cy p={[-1.2, 1.15, -0.8]} r={0.04} h={0.2} c="#E8B23A" cast={false} /><mesh position={[-1.2, 1.35, -0.8]}><coneGeometry args={[0.14, 0.16, 12, 1, true]} /><meshBasicMaterial color={LAMP_HDR} toneMapped={false} side={THREE.DoubleSide} /></mesh><Glow p={[-1.2, 1.3, -0.75]} size={1.4} color="#FFD9A0" intensity={0.7} />
    </group>
  );
};
