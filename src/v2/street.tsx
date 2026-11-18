// Street / house / vehicle / tree props for CrisisShortV2 (standard materials, no ink on the set).
import React from 'react';
import * as THREE from 'three';
import {V3, Sky, hash, lerp, makeTex} from '../kit/kit';
import {Ctx, Halo, SBall, SBox, SCyl, SPlane, blot, fitText, lgr, paintHalo, shade} from './gfx';

// ---- shared texture cache (one canvas per key for the whole video)
const texCache = new Map<string, THREE.CanvasTexture>();
export function ctex(key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, repeat?: [number, number]) {
  const k = `${key}|${w}x${h}|${repeat ? repeat.join(',') : ''}`;
  let t = texCache.get(k);
  if (!t) {
    t = makeTex(w, h, draw, repeat) as THREE.CanvasTexture;
    texCache.set(k, t);
  }
  return t;
}

export const paintSiding = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const n = 8, bh = h / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = lgr(c, 0, i * bh, 0, (i + 1) * bh, [[0, 'rgba(255,255,255,0.14)'], [0.8, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
    c.fillRect(0, i * bh, w, bh);
  }
  blot(c, 4, 18, w, h, 20, 80, '0,0,0', 0.06);
  for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(0,0,0,${hash(i, 1) * 0.05})`; c.fillRect(hash(i, 2) * w, hash(i, 3) * h, 3 + hash(i, 4) * 14, 1.5); }
};
export const paintShingles = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = shade(base, 0.7); c.fillRect(0, 0, w, h);
  const rows = 12, rh = h / rows, cw = w / 8;
  for (let r = 0; r < rows; r++)
    for (let i = -1; i < 9; i++) {
      const x = i * cw + (r % 2 ? cw / 2 : 0);
      c.fillStyle = shade(base, 0.82 + hash(r, i) * 0.3);
      c.beginPath(); c.roundRect(x + 2, r * rh + 2, cw - 4, rh - 3, 4); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 2, r * rh + rh - 6, cw - 4, 4);
    }
};
export const paintAsphalt = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#3c4048'; c.fillRect(0, 0, w, h);
  blot(c, 2, 26, w, h, 40, 160, '70,74,82', 0.35);
  blot(c, 7, 12, w, h, 30, 90, '20,22,28', 0.3);
  for (let i = 0; i < 4000; i++) { c.fillStyle = hash(i, 1) > 0.5 ? `rgba(255,255,255,${hash(i, 2) * 0.12})` : `rgba(0,0,0,${hash(i, 3) * 0.2})`; c.fillRect(hash(i, 4) * w, hash(i, 5) * h, 2, 2); }
  c.strokeStyle = 'rgba(10,10,14,0.55)'; c.lineWidth = 3; c.lineCap = 'round';
  for (let k = 0; k < 5; k++) { c.beginPath(); let x = hash(k, 9) * w, y = hash(k, 8) * h; c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (hash(k, j + 20) - 0.4) * 80; y += (hash(k, j + 40) - 0.5) * 50; c.lineTo(x, y); } c.stroke(); }
};
export const paintRoadStrip = (c: Ctx, w: number, h: number) => {
  paintAsphalt(c, w, h);
  c.fillStyle = '#f0c834';
  for (const x of [0, w / 2]) { c.fillRect(x, h / 2 - 9, w * 0.25, 7); c.fillRect(x, h / 2 + 5, w * 0.25, 7); }
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fillRect(0, 12, w, 8); c.fillRect(0, h - 20, w, 8);
};
export const paintConcrete = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#d0cfc9'; c.fillRect(0, 0, w, h);
  blot(c, 5, 14, w, h, 30, 110, '120,118,110', 0.12);
  for (let i = 0; i < 2200; i++) { c.fillStyle = `rgba(90,88,80,${hash(i, 1) * 0.14})`; c.fillRect(hash(i, 2) * w, hash(i, 3) * h, 2, 2); }
  c.strokeStyle = '#8f8d84'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
};
export const paintGrass = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#5da84a'; c.fillRect(0, 0, w, h);
  blot(c, 1, 40, w, h, 20, 90, '120,190,80', 0.32);
  blot(c, 3, 34, w, h, 20, 90, '40,110,50', 0.3);
  c.lineCap = 'round';
  for (let i = 0; i < 1800; i++) { c.strokeStyle = hash(i, 1) > 0.5 ? 'rgba(150,215,100,0.5)' : 'rgba(30,100,45,0.45)'; c.lineWidth = 1.6; const x = hash(i, 2) * w, y = hash(i, 3) * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (hash(i, 4) - 0.5) * 8, y - 6 - hash(i, 5) * 10); c.stroke(); }
};
export const paintLeaves = (base: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  blot(c, 2, 40, w, h, 10, 50, '255,255,200', 0.22);
  blot(c, 6, 40, w, h, 10, 50, '0,40,10', 0.3);
};
export const paintWindow = (lit: boolean) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = lit ? lgr(c, 0, 0, 0, h, [[0, '#ffd890'], [1, '#ffb560']]) : lgr(c, 0, 0, 0, h, [[0, '#9fd0ee'], [0.55, '#5b8fb8'], [1, '#3d6585']]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = lit ? '#e8744a' : '#d9d3e8'; // curtains
  c.fillRect(0, 0, w * 0.22, h); c.fillRect(w * 0.78, 0, w * 0.22, h);
  c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) { c.fillRect(i * w * 0.06, 0, 4, h); c.fillRect(w - i * w * 0.06, 0, 4, h); }
  if (!lit) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(w * 0.3, 0); c.lineTo(w * 0.55, 0); c.lineTo(w * 0.2, h); c.lineTo(w * 0.05, h); c.fill(); }
  c.strokeStyle = '#f4f1ea'; c.lineWidth = 12; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
};
export const paintTreeline = (c: Ctx, w: number, h: number) => {
  c.clearRect(0, 0, w, h);
  for (let layer = 0; layer < 2; layer++) {
    c.fillStyle = layer ? '#4f8a52' : '#6b9d78';
    for (let i = 0; i < 70; i++) {
      const x = hash(i, layer + 1) * w, r = 26 + hash(i, 5 + layer) * 46, y = h - 10 - hash(i, 9 + layer) * 70 - layer * 20;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    c.fillRect(0, h - 40 - layer * 14, w, 60);
  }
};
export const paintPlaque = (text: string) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#2d313b'; c.fillRect(0, 0, w, h);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, text, w * 0.7, h * 0.7);
  c.fillStyle = '#f4f1ea'; c.fillText(text, w / 2, h / 2 + 2);
};

// ---- trees, bushes, fences, lamps
export const Tree: React.FC<{p: V3; s?: number; leaf?: string; seed?: number}> = ({p, s = 1, leaf = '#3f9a4a', seed = 1}) => {
  const map = ctex('leaf' + leaf, 256, 256, paintLeaves(leaf));
  return (
    <group position={p} scale={s}>
      <SCyl r0={0.16} h={1.8} p={[0, 0.9, 0]} c="#6a4630" r={0.9} seg={9} />
      {[[0, 2.5, 0, 1.1], [0.55, 2.1, 0.2, 0.8], [-0.55, 2.2, -0.15, 0.85], [0.1, 3.1, 0.1, 0.8], [-0.2, 2.0, 0.5, 0.7]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[r * (0.9 + hash(seed, i) * 0.2), 18, 14]} />
          <meshStandardMaterial map={map} roughness={0.95} color={shade('#ffffff', 0.9 + hash(seed, i + 3) * 0.2)} />
        </mesh>
      ))}
    </group>
  );
};
export const Bush: React.FC<{p: V3; s?: number; flowers?: string}> = ({p, s = 1, flowers}) => {
  const map = ctex('leaf#3a8a45', 256, 256, paintLeaves('#3a8a45'));
  return (
    <group position={p} scale={s}>
      {[[0, 0.32, 0, 0.42], [0.38, 0.26, 0.05, 0.34], [-0.38, 0.27, 0, 0.35]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial map={map} roughness={0.95} />
        </mesh>
      ))}
      {flowers && [0, 1, 2, 3, 4, 5].map((i) => <SBall key={i} r0={0.05} p={[(hash(i, 4) - 0.5) * 0.9, 0.35 + hash(i, 6) * 0.3, 0.3 + hash(i, 5) * 0.1]} c={flowers} r={0.6} />)}
    </group>
  );
};
export const Fence: React.FC<{p: V3; len: number; h?: number; c?: string}> = ({p, len, h = 0.85, c = '#f4f1ea'}) => {
  const n = Math.floor(len / 0.22);
  return (
    <group position={p}>
      <SBox s={[len, 0.06, 0.04]} p={[len / 2, h * 0.3, 0]} c={c} r={0.8} />
      <SBox s={[len, 0.06, 0.04]} p={[len / 2, h * 0.75, 0]} c={c} r={0.8} />
      {Array.from({length: n}).map((_, i) => <SBox key={i} s={[0.1, h, 0.03]} p={[0.11 + i * 0.22, h / 2, 0.03]} c={c} r={0.8} />)}
    </group>
  );
};
export const LampPost: React.FC<{p: V3; on?: boolean; h?: number; tex?: THREE.Texture; rot?: number}> = ({p, on, h = 4.2, tex, rot = 0}) => (
  <group position={p} rotation={[0, rot, 0]}>
    <SCyl r0={0.06} h={h} p={[0, h / 2, 0]} c="#2e3340" r={0.5} m={0.5} seg={10} />
    <SBox s={[0.7, 0.06, 0.06]} p={[0.3, h, 0]} c="#2e3340" r={0.5} m={0.5} cast={false} />
    <mesh position={[0.6, h - 0.06, 0]}>
      <boxGeometry args={[0.38, 0.1, 0.22]} />
      <meshStandardMaterial color={on ? new THREE.Color(3.4, 2.7, 1.5) : '#c9ccd2'} emissive={on ? '#ffb560' : '#000000'} emissiveIntensity={on ? 1 : 0} toneMapped={false} />
    </mesh>
    {on && tex && <Halo tex={tex} p={[0.6, h - 0.2, 0.25]} w={2.2} color="#ffc27a" op={0.55} />}
  </group>
);
export const Mailbox: React.FC<{p: V3; c?: string}> = ({p, c = '#2f6fae'}) => (
  <group position={p}>
    <SBox s={[0.08, 1.0, 0.08]} p={[0, 0.5, 0]} c="#6a4630" r={0.9} />
    <SBox s={[0.28, 0.24, 0.48]} p={[0, 1.1, 0]} c={c} r={0.5} />
    <SBox s={[0.02, 0.18, 0.1]} p={[0.15, 1.2, -0.1]} c="#e5333c" r={0.5} />
  </group>
);

// ---- house
export const Win: React.FC<{p: V3; w?: number; h?: number; lit?: boolean; shutter?: string; boxFlowers?: string}> = ({p, w = 1.1, h = 1.3, lit, shutter, boxFlowers}) => {
  const map = ctex('win' + lit, 256, 256, paintWindow(!!lit));
  return (
    <group position={p}>
      <SBox s={[w + 0.2, h + 0.2, 0.08]} p={[0, 0, 0]} c="#f4f1ea" r={0.6} />
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.15} metalness={0.1} emissive={lit ? '#ffffff' : '#000000'} emissiveMap={lit ? map : undefined} emissiveIntensity={lit ? 1.1 : 0} />
      </mesh>
      {shutter && <><SBox s={[0.28, h + 0.1, 0.05]} p={[-w / 2 - 0.3, 0, 0.0]} c={shutter} r={0.7} /><SBox s={[0.28, h + 0.1, 0.05]} p={[w / 2 + 0.3, 0, 0.0]} c={shutter} r={0.7} /></>}
      <SBox s={[w + 0.3, 0.12, 0.08]} p={[0, -h / 2 - 0.16, 0.0]} c="#f4f1ea" r={0.6} />
      {boxFlowers && (
        <group position={[0, -h / 2 - 0.3, 0.12]}>
          <SBox s={[w + 0.1, 0.16, 0.18]} p={[0, 0, 0]} c="#7a4a2a" r={0.9} />
          {Array.from({length: 7}).map((_, i) => <SBall key={i} r0={0.075} p={[-w / 2 + 0.1 + i * (w / 6.4), 0.14 + hash(i, 3) * 0.05, 0.02]} c={i % 2 ? boxFlowers : '#3f9a4a'} r={0.7} />)}
        </group>
      )}
    </group>
  );
};

export const House: React.FC<{p: V3; w?: number; d?: number; h?: number; wall: string; roof: string; door: string; lit?: boolean; num?: string; shutter?: string; flowers?: string; rotY?: number}> = ({
  p, w = 6.4, d = 5, h = 3.1, wall, roof, door, lit, num = '12', shutter, flowers = '#ff6f8f', rotY = 0,
}) => {
  const sid = ctex('sid' + wall, 512, 512, paintSiding(wall), [w / 1.6, h / 1.1]);
  const sidSide = ctex('sid' + wall, 512, 512, paintSiding(wall), [d / 1.6, h / 1.1]);
  const shin = ctex('shin' + roof, 512, 512, paintShingles(roof), [(w + 0.8) / 1.6, 2]);
  const conc = ctex('conc', 256, 256, paintConcrete, [2, 1]);
  const plaque = ctex('plq' + num, 128, 64, paintPlaque(num));
  const rh = 1.5;
  const half = d / 2 + 0.45;
  const slope = Math.atan2(rh, half);
  const slopeLen = Math.hypot(half, rh);
  const gable = React.useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, rh); sh.closePath();
    return sh;
  }, [d]);
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {/* body + textured facades */}
      <SBox s={[w, h, d]} p={[0, h / 2, 0]} c={wall} r={0.9} />
      <SPlane w={w} h={h} p={[0, h / 2, d / 2 + 0.005]} map={sid} r={0.85} />
      <SPlane w={w} h={h} p={[0, h / 2, -d / 2 - 0.005]} rot={[0, Math.PI, 0]} map={sid} r={0.85} />
      <SPlane w={d} h={h} p={[w / 2 + 0.005, h / 2, 0]} rot={[0, Math.PI / 2, 0]} map={sidSide} r={0.85} />
      <SPlane w={d} h={h} p={[-w / 2 - 0.005, h / 2, 0]} rot={[0, -Math.PI / 2, 0]} map={sidSide} r={0.85} />
      <SBox s={[w + 0.1, 0.18, d + 0.1]} p={[0, 0.09, 0]} c="#8d8a82" r={0.9} />
      <SBox s={[w + 0.12, 0.12, 0.1]} p={[0, h - 0.05, d / 2 + 0.03]} c="#f4f1ea" r={0.7} />
      {/* gable ends */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 + 0.002), h, 0]} rotation={[0, sd * Math.PI / 2, 0]} receiveShadow castShadow>
          <shapeGeometry args={[gable]} />
          <meshStandardMaterial map={sidSide} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* roof: two slabs with shingles */}
      {[1, -1].map((sd) => (
        <group key={sd} position={[0, h + rh / 2, sd * half / 2]} rotation={[sd * slope, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w + 0.8, 0.14, slopeLen]} />
            <meshStandardMaterial map={shin} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <SBox s={[w + 0.84, 0.12, 0.2]} p={[0, h + rh + 0.02, 0]} c={shade(roof, 0.7)} r={0.8} />
      {/* chimney */}
      <SBox s={[0.6, 1.5, 0.6]} p={[w * 0.28, h + rh + 0.2, -0.4]} c="#a84f3a" r={0.95} />
      <SBox s={[0.76, 0.1, 0.76]} p={[w * 0.28, h + rh + 0.98, -0.4]} c="#7f7a72" r={0.9} />
      {/* door + porch */}
      <group position={[-w * 0.18, 0, d / 2]}>
        <SBox s={[1.1, 2.05, 0.1]} p={[0, 1.05, 0.04]} c={door} r={0.55} />
        <SBox s={[0.84, 0.7, 0.04]} p={[0, 1.55, 0.1]} c={lit ? '#ffd890' : '#bfe0f2'} r={0.15} emissive={lit ? '#ffb560' : '#000000'} ei={lit ? 1 : 0} />
        <SBox s={[0.84, 0.5, 0.03]} p={[0, 0.7, 0.1]} c={shade(door, 0.85)} r={0.55} />
        <SBall r0={0.045} p={[0.38, 1.0, 0.13]} c="#d8b04a" r={0.3} m={0.8} />
        <SBox s={[1.9, 0.16, 1.4]} p={[0, 0.08, 0.75]} c="#bdbab0" r={0.9} />
        <SBox s={[1.5, 0.1, 0.9]} p={[0, 0.03, 1.55]} c="#bdbab0" r={0.9} />
        <SBox s={[0.1, 2.4, 0.1]} p={[-0.88, 1.28, 1.35]} c="#f4f1ea" r={0.6} />
        <SBox s={[0.1, 2.4, 0.1]} p={[0.88, 1.28, 1.35]} c="#f4f1ea" r={0.6} />
        <SBox s={[2.1, 0.12, 1.6]} p={[0, 2.5, 0.75]} c={shade(roof, 0.85)} r={0.8} />
        <SBox s={[0.7, 0.04, 0.45]} p={[0, 0.2, 1.1]} c="#7a5230" r={0.95} />
        <mesh position={[0.9, 1.7, 0.1]}>
          <boxGeometry args={[0.14, 0.2, 0.12]} />
          <meshStandardMaterial color={lit ? new THREE.Color(3.4, 2.7, 1.5) : '#d9d4c6'} emissive={lit ? '#ffb560' : '#000000'} emissiveIntensity={lit ? 1 : 0} toneMapped={false} />
        </mesh>
        <SPlane w={0.3} h={0.15} p={[0.9, 1.35, 0.075]} map={plaque} r={0.5} />
      </group>
      <Win p={[w * 0.27, 1.65, d / 2 + 0.04]} lit={lit} shutter={shutter} boxFlowers={flowers} />
      <Win p={[-w * 0.4, 1.65, d / 2 + 0.04]} lit={lit} shutter={shutter} />
      <Win p={[0, h - 0.0, d / 2 + 0.04]} w={0.01} h={0.01} />
      {/* garden */}
      <Bush p={[w * 0.43, 0, d / 2 + 0.45]} s={1.1} flowers={flowers} />
      <Bush p={[-w * 0.43, 0, d / 2 + 0.45]} s={0.9} flowers="#ffd23f" />
      <SBox s={[1.0, 0.012, 3.4]} p={[-w * 0.18, 0.008, d / 2 + 2.3]} c="#d8d5cb" r={0.9} />
      <SPlane w={1.0} h={3.4} p={[-w * 0.18, 0.013, d / 2 + 2.3]} rot={[-Math.PI / 2, 0, 0]} map={conc} r={0.9} />
    </group>
  );
};

// ---- vehicles (standard materials, extruded side profile)
const carProfile = (kind: 'car' | 'van' | 'truck') => {
  const s = new THREE.Shape();
  if (kind === 'car') {
    const pts: [number, number][] = [[-2.1, 0.35], [-2.1, 0.85], [-1.7, 0.95], [-0.8, 1.0], [-0.45, 1.5], [0.7, 1.5], [1.15, 1.0], [2.05, 0.9], [2.1, 0.55], [2.05, 0.35]];
    s.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => s.lineTo(p[0], p[1]));
  } else if (kind === 'van') {
    const pts: [number, number][] = [[-2.3, 0.4], [-2.3, 2.15], [0.9, 2.15], [1.7, 1.55], [2.3, 1.2], [2.3, 0.4]];
    s.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => s.lineTo(p[0], p[1]));
  } else {
    const pts: [number, number][] = [[-3.4, 0.5], [-3.4, 2.5], [0.9, 2.5], [0.9, 2.9], [3.0, 2.9], [3.4, 2.2], [3.4, 0.5]];
    s.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach((p) => s.lineTo(p[0], p[1]));
  }
  s.closePath();
  return s;
};

export const Vehicle2: React.FC<{p: V3; yaw?: number; kind: 'car' | 'ambulance' | 'fire'; color?: string; t?: number; lightsOn?: boolean; doorOpen?: number}> = ({
  p, yaw = 0, kind, color, t = 0, lightsOn = true, doorOpen = 0,
}) => {
  const prof = kind === 'car' ? 'car' : kind === 'ambulance' ? 'van' : 'truck';
  const body = color ?? (kind === 'car' ? '#d94b52' : kind === 'ambulance' ? '#f4f4f0' : '#d8352f');
  const W = kind === 'fire' ? 2.5 : kind === 'ambulance' ? 2.1 : 1.85;
  const geo = React.useMemo(() => new THREE.ExtrudeGeometry(carProfile(prof), {depth: W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3}), [prof, W]);
  const flash = Math.floor(t * 6) % 2 === 0;
  const half = kind === 'fire' ? 3.4 : kind === 'ambulance' ? 2.3 : 2.1;
  const wheelX = kind === 'fire' ? [-2.2, 0.2, 2.3] : kind === 'ambulance' ? [-1.4, 1.5] : [-1.3, 1.3];
  const wr = kind === 'car' ? 0.34 : 0.45;
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh geometry={geo} position={[0, 0.0, -(W - 0.12) / 2]} castShadow receiveShadow>
        <meshStandardMaterial color={body} roughness={0.32} metalness={0.45} />
      </mesh>
      {/* windows (both sides), windscreen */}
      {kind === 'car' && [-1, 1].map((sd) => (
        <mesh key={sd} position={[0.15, 1.2, sd * (W / 2 + 0.001)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[1.5, 0.42]} />
          <meshStandardMaterial color="#1f2d3d" roughness={0.1} metalness={0.6} />
        </mesh>
      ))}
      {kind === 'ambulance' && [-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[1.45, 1.55, sd * (W / 2 + 0.001)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.7, 0.45]} /><meshStandardMaterial color="#1f2d3d" roughness={0.1} metalness={0.6} /></mesh>
          <mesh position={[-0.2, 1.55, sd * (W / 2 + 0.001)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.8, 0.45]} /><meshStandardMaterial color="#1f2d3d" roughness={0.1} metalness={0.6} /></mesh>
          <mesh position={[-0.2, 1.0, sd * (W / 2 + 0.002)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[4.4, 0.28]} /><meshStandardMaterial color="#e5333c" roughness={0.4} /></mesh>
          <mesh position={[-1.0, 1.55, sd * (W / 2 + 0.003)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.1, 0.5]} /><meshStandardMaterial color="#e5333c" /></mesh>
          <mesh position={[-1.0, 1.55, sd * (W / 2 + 0.003)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[0.5, 0.1]} /><meshStandardMaterial color="#e5333c" /></mesh>
        </group>
      ))}
      {kind === 'fire' && (
        <group>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh position={[2.2, 2.0, sd * (W / 2 + 0.001)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[1.1, 0.7]} /><meshStandardMaterial color="#1f2d3d" roughness={0.1} metalness={0.6} /></mesh>
              <mesh position={[-0.4, 1.0, sd * (W / 2 + 0.002)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[5.6, 0.22]} /><meshStandardMaterial color="#f5d142" roughness={0.4} /></mesh>
            </group>
          ))}
          <SBox s={[5.2, 0.12, 0.14]} p={[-1.0, 2.7, 0.55]} c="#c9ccd2" r={0.3} m={0.8} />
          <SBox s={[5.2, 0.12, 0.14]} p={[-1.0, 2.7, -0.55]} c="#c9ccd2" r={0.3} m={0.8} />
          {Array.from({length: 12}).map((_, i) => <SBox key={i} s={[0.06, 0.06, 1.1]} p={[-3.3 + i * 0.44, 2.7, 0]} c="#c9ccd2" r={0.3} m={0.8} />)}
          <SCyl r0={0.4} h={1.2} p={[-2.0, 1.6, 1.2]} rot={[Math.PI / 2, 0, 0]} c="#2d313b" r={0.6} />
        </group>
      )}
      {/* head / tail lights */}
      <mesh position={[half, kind === 'car' ? 0.62 : 0.8, 0.6]}><boxGeometry args={[0.06, 0.14, 0.3]} /><meshStandardMaterial color={new THREE.Color(3, 3, 2.6)} emissive="#fff6c8" emissiveIntensity={lightsOn ? 1 : 0.2} toneMapped={false} /></mesh>
      <mesh position={[half, kind === 'car' ? 0.62 : 0.8, -0.6]}><boxGeometry args={[0.06, 0.14, 0.3]} /><meshStandardMaterial color={new THREE.Color(3, 3, 2.6)} emissive="#fff6c8" emissiveIntensity={lightsOn ? 1 : 0.2} toneMapped={false} /></mesh>
      <mesh position={[-half, kind === 'car' ? 0.62 : 0.8, 0.6]}><boxGeometry args={[0.06, 0.14, 0.3]} /><meshStandardMaterial color="#b3202a" emissive="#ff2020" emissiveIntensity={0.6} /></mesh>
      <mesh position={[-half, kind === 'car' ? 0.62 : 0.8, -0.6]}><boxGeometry args={[0.06, 0.14, 0.3]} /><meshStandardMaterial color="#b3202a" emissive="#ff2020" emissiveIntensity={0.6} /></mesh>
      {/* bumpers */}
      <SBox s={[0.14, 0.22, W - 0.1]} p={[half + 0.05, 0.5, 0]} c="#2d313b" r={0.5} />
      <SBox s={[0.14, 0.22, W - 0.1]} p={[-half - 0.05, 0.5, 0]} c="#2d313b" r={0.5} />
      {/* wheels with hubs */}
      {wheelX.map((x) => [-1, 1].map((sd) => (
        <group key={x + '_' + sd} position={[x, wr, sd * (W / 2 - 0.05)]}>
          <SCyl r0={wr} h={0.28} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c="#17181d" r={0.8} seg={22} />
          <SCyl r0={wr * 0.58} h={0.3} p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} c="#c9ccd2" r={0.3} m={0.8} seg={16} />
        </group>
      )))}
      {/* roof light bar (emergency) */}
      {kind !== 'car' && lightsOn && (
        <group position={[kind === 'fire' ? 2.1 : 1.1, kind === 'fire' ? 3.0 : 2.25, 0]}>
          <mesh position={[0, 0.06, -0.45]}><boxGeometry args={[0.3, 0.2, 0.7]} /><meshStandardMaterial color={flash ? new THREE.Color(5, 0.4, 0.4) : '#661111'} emissive="#ff2020" emissiveIntensity={flash ? 1.5 : 0.1} toneMapped={false} /></mesh>
          <mesh position={[0, 0.06, 0.45]}><boxGeometry args={[0.3, 0.2, 0.7]} /><meshStandardMaterial color={!flash ? new THREE.Color(0.5, 1.2, 5) : '#142255'} emissive="#2f6bff" emissiveIntensity={!flash ? 1.5 : 0.1} toneMapped={false} /></mesh>
          <pointLight position={[0, 0.5, flash ? -1.2 : 1.2]} color={flash ? '#ff3030' : '#3d7bff'} intensity={22} distance={12} decay={2} />
        </group>
      )}
      {kind === 'car' && doorOpen > 0 && (
        <group position={[0.35, 0.95, W / 2]} rotation={[0, -doorOpen, 0]}>
          <SBox s={[1.1, 0.5, 0.05]} p={[-0.55, 0.0, 0]} c={shade(body, 0.9)} r={0.4} m={0.4} />
        </group>
      )}
    </group>
  );
};

// ---- the street environment: ground, roads, sky, sun / dusk lighting, distant houses and trees on every side
export const StreetEnv: React.FC<{mode: 'day' | 'dusk'; t?: number; lampOn?: boolean}> = ({mode, lampOn}) => {
  const dusk = mode === 'dusk';
  const grass = ctex('grass', 512, 512, paintGrass, [100, 100]);
  const road = ctex('roadstrip', 1024, 512, paintRoadStrip, [40, 1]);
  const conc = ctex('conc', 256, 256, paintConcrete, [200, 1]);
  const conc2 = ctex('conc', 256, 256, paintConcrete, [4, 4]);
  const tl = ctex('treeline', 2048, 256, paintTreeline);
  const halo = ctex('halo', 256, 256, paintHalo);
  const wallC = ['#9ec4a6', '#e8c98a', '#a8c4e0', '#e3a99a', '#cfd8a8', '#d9b8d6'];
  const roofC = ['#7a4a3a', '#46566b', '#6f5a48', '#55684a'];
  const far = Array.from({length: 7}, (_, i) => i);
  return (
    <group>
      {/* lights */}
      <hemisphereLight args={dusk ? ['#8e82d8', '#7a5a50', 0.95] : ['#a8c8ff', '#c6b89a', 1.05]} />
      <directionalLight color={dusk ? '#ff9a5a' : '#ffd9a8'} intensity={dusk ? 2.3 : 2.5} position={dusk ? [-9, 4.2, 8] : [-6, 9, 9]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-camera-near={0.5} shadow-camera-far={50} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color={dusk ? '#7d78d8' : '#a8c8ff'} intensity={dusk ? 0.55 : 0.5} position={[6, 3, -6]} />
      <ambientLight color="#ffffff" intensity={0.1} />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* sidewalk, curb, road (near and far side), far sidewalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 2.05]} receiveShadow><planeGeometry args={[500, 1.7]} /><meshStandardMaterial map={ctex('conc', 256, 256, paintConcrete, [330, 1])} roughness={0.95} /></mesh>
      <SBox s={[500, 0.14, 0.18]} p={[0, 0.0, 2.99]} c="#b9b7ae" r={0.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 6.25]} receiveShadow><planeGeometry args={[500, 6.4]} /><meshStandardMaterial map={road} roughness={0.9} /></mesh>
      <SBox s={[500, 0.14, 0.18]} p={[0, 0.0, 9.5]} c="#b9b7ae" r={0.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 10.4]} receiveShadow><planeGeometry args={[500, 1.7]} /><meshStandardMaterial map={ctex('conc', 256, 256, paintConcrete, [330, 1])} roughness={0.95} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 1.0]}><planeGeometry args={[0.001, 0.001]} /><meshBasicMaterial map={conc2} /></mesh>
      {/* the pair of houses (man left, neighbor right) */}
      <House p={[-4.6, 0, -4.5]} wall="#8fb8a0" roof="#5b4a42" door="#2f6fae" lit={dusk} num="12" shutter="#3f7f68" />
      <House p={[4.6, 0, -4.5]} wall="#e8b878" roof="#6b4a36" door="#c0392b" lit={dusk} num="14" shutter="#b8793d" flowers="#ffd23f" />
      <Fence p={[-1.2, 0, -1.6]} len={2.4} />
      <Bush p={[-1.1, 0, -2.0]} s={1.2} /><Bush p={[1.1, 0, -2.0]} s={1.2} flowers="#ff6f8f" />
      <Tree p={[0.1, 0, -4.2]} s={1.5} seed={4} />
      <Mailbox p={[-2.6, 0, 1.45]} /><Mailbox p={[2.6, 0, 1.45]} c="#c0392b" />
      {/* street furniture along the near sidewalk */}
      {[-12, 12].map((x) => <LampPost key={x} p={[x, 0, 2.6]} on={lampOn ?? dusk} tex={halo} />)}
      <LampPost p={[-26, 0, 2.6]} on={lampOn ?? dusk} tex={halo} /><LampPost p={[26, 0, 2.6]} on={lampOn ?? dusk} tex={halo} />
      <Tree p={[-8.2, 0, 2.55]} s={1.15} seed={9} leaf="#4aa04a" /><Tree p={[8.6, 0, 2.55]} s={1.1} seed={5} leaf="#3d8f45" />
      {/* parked cars well off to the sides */}
      <Vehicle2 p={[-13, 0, 4.2]} kind="car" color="#3f78c4" lightsOn={false} />
      <Vehicle2 p={[14.5, 0, 8.2]} yaw={Math.PI} kind="car" color="#f2c53d" lightsOn={false} />
      {/* more houses to both sides, then opposite the road (behind the camera) */}
      {far.map((i) => {
        const side = i % 2 ? 1 : -1;
        const x = side * (14 + Math.floor(i / 2) * 9.5);
        return <House key={'n' + i} p={[x, 0, -4.5]} wall={wallC[i % 6]} roof={roofC[i % 4]} door={['#2f6fae', '#c0392b', '#3a7d44', '#7a52c8'][i % 4]} lit={dusk && i % 3 !== 0} num={String(16 + i * 2)} shutter={i % 2 ? '#f4f1ea' : undefined} flowers={['#ff6f8f', '#ffd23f', '#ffffff'][i % 3]} />;
      })}
      {Array.from({length: 11}).map((_, i) => {
        const x = -46 + i * 9.5;
        return <House key={'o' + i} p={[x, 0, 17.5]} rotY={Math.PI} wall={wallC[(i + 2) % 6]} roof={roofC[(i + 1) % 4]} door={['#2f6fae', '#c0392b', '#3a7d44'][i % 3]} lit={dusk && i % 2 === 0} num={String(21 + i * 2)} />;
      })}
      {Array.from({length: 14}).map((_, i) => <Tree key={'t' + i} p={[-60 + i * 9 + hash(i, 1) * 4, 0, i % 2 ? 11.0 : -9.5]} s={1 + hash(i, 2) * 0.6} seed={i + 10} leaf={['#3f9a4a', '#4aa04a', '#357f3f'][i % 3]} />)}
      {/* horizon: ring of tree-line hills + sky */}
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[110, 110, 24, 48, 1, true]} />
        <meshBasicMaterial map={tl} transparent side={THREE.BackSide} toneMapped={false} color={dusk ? '#7a6a9a' : '#ffffff'} depthWrite={false} />
      </mesh>
      <Sky top={dusk ? '#4c3f8f' : '#5ea8e8'} bottom={dusk ? '#ffa772' : '#d7f0ff'} r={160} />
      {Array.from({length: 9}).map((_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        return <Halo key={i} tex={halo} p={[Math.sin(a) * 120, 38 + hash(i, 2) * 22, Math.cos(a) * 120]} w={70} h={24} rot={[0, a + Math.PI, 0]} color={dusk ? '#ffb99a' : '#ffffff'} op={dusk ? 0.35 : 0.8} />;
      })}
      <mesh position={[lerp(0, 0, 0), 0, 0]} visible={false}><boxGeometry args={[0.01, 0.01, 0.01]} /></mesh>
    </group>
  );
};
