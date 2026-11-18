import React from 'react';
import * as THREE from 'three';
import {Ball, Box, Cyl, Floor, LiveTex, Plane, RAMP, Sky, V3, clamp01, hash, lerp, smooth, useTex, INK} from './kit';

// ===================================================================== SUPERMARKET
const shelfPaint = (seed: number) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#f4efe2';
  c.fillRect(0, 0, w, h);
  const tiers = 4;
  const pal = ['#e5484d', '#ffb02e', '#3d8bd4', '#4cb86b', '#f26ca7', '#8a63d2', '#ffd84a', '#2fb5b0'];
  for (let t = 0; t < tiers; t++) {
    const y0 = (t * h) / tiers;
    const th = h / tiers;
    c.fillStyle = '#c9c3b4';
    c.fillRect(0, y0 + th - 14, w, 14);
    let x = 6;
    let i = 0;
    while (x < w - 20) {
      const bw = 34 + hash(seed + t, i) * 38;
      const bh = th * (0.55 + hash(seed + t, i + 40) * 0.3);
      const col = pal[Math.floor(hash(seed + t, i + 9) * pal.length)];
      c.fillStyle = col;
      if (hash(seed, i + t * 7) > 0.5) {
        c.beginPath();
        c.roundRect(x, y0 + th - 14 - bh, bw, bh, 8);
        c.fill();
      } else {
        c.fillRect(x, y0 + th - 14 - bh, bw, bh);
      }
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.strokeRect(x, y0 + th - 14 - bh, bw, bh);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(x + 6, y0 + th - 14 - bh * 0.6, bw - 12, bh * 0.22);
      x += bw + 6;
      i++;
    }
  }
};

const floorTiles = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const n = 8;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      c.fillStyle = (i + j) % 2 ? '#f2f0e6' : '#dcd8c8';
      c.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
    }
};

export const Supermarket: React.FC<{t: number; cartX: number; cartZ: number; jugs: number; cans: number; belt: number; beep: number}> = ({t, cartX, cartZ, jugs, cans, belt, beep}) => {
  const shelfL = useTex('shL', 1024, 512, shelfPaint(3));
  const shelfR = useTex('shR', 1024, 512, shelfPaint(11));
  const floor = useTex('mf', 512, 512, floorTiles, [4, 8]);
  const wallTex = useTex('mw', 64, 64, (c) => { c.fillStyle = '#ffe9b8'; c.fillRect(0, 0, 64, 64); });
  void wallTex;
  const aisleZ: [number, number] = [-14, 8];
  return (
    <group>
      <Floor w={14} d={30} c="#ffffff" p={[0, -3]} map={floor} />
      <Plane w={14} h={4} p={[0, 2, -14]} c="#ffeab8" />
      <Plane w={30} h={4} p={[-7, 2, -3]} c="#ffd9a8" rot={[0, Math.PI / 2, 0]} />
      <Plane w={30} h={4} p={[7, 2, -3]} c="#ffd9a8" rot={[0, -Math.PI / 2, 0]} />
      <Plane w={14} h={30} p={[0, 3.6, -3]} c="#f6f2e6" rot={[Math.PI / 2, 0, 0]} recv={false} />
      {/* ceiling light panels */}
      {[-10, -6, -2, 2, 6].map((z) => (
        <Box key={z} s={[1.6, 0.06, 0.6]} p={[0, 3.55, z]} c="#ffffff" basic ink={0} cast={false} />
      ))}
      <pointLight position={[0, 3.2, -3]} color="#fff4dc" intensity={6} distance={14} decay={1.6} />
      <pointLight position={[0, 3.2, -9]} color="#fff4dc" intensity={4} distance={10} decay={1.6} />
      {/* shelves, both sides of the aisle */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box s={[0.7, 2.3, 16]} p={[sd * 2.4, 1.15, -2.5]} c="#dfe6ea" />
          <Plane w={16} h={2.2} p={[sd * 2.04, 1.15, -2.5]} rot={[0, -sd * (Math.PI / 2), 0]} map={sd < 0 ? shelfL : shelfR} basic />
        </group>
      ))}
      {/* aisle hanging markers (icon-only) */}
      {[-2, -7].map((z) => (
        <group key={z}>
          <Box s={[1.4, 0.4, 0.06]} p={[0, 3.2, z]} c="#e5484d" />
          <Ball r={0.12} p={[0, 3.2, z + 0.05]} c="#fff6d8" basic ink={0} />
        </group>
      ))}
      {/* water jugs stack, left shelf */}
      {Array.from({length: 10}).map((_, i) => (
        <Box key={i} s={[0.28, 0.4, 0.22]} p={[-1.88, 0.25 + Math.floor(i / 5) * 0.46 + 0.2, -3.2 + (i % 5) * 0.34]} c="#7cc9f2" ink={0.012} />
      ))}
      {/* bean cans, right shelf */}
      {Array.from({length: 16}).map((_, i) => (
        <Cyl key={i} r={0.07} h={0.13} p={[1.9, 0.6 + Math.floor(i / 8) * 0.14, -4.0 + (i % 8) * 0.17]} c="#d7513b" ink={0.01} seg={10} />
      ))}
      {/* radio + flashlight peg display at the far end, left */}
      <Box s={[0.4, 0.26, 0.2]} p={[-1.85, 1.3, -6.4]} c="#c0392b" ink={0.012} />
      <Cyl r={0.04} h={0.3} p={[-1.85, 1.0, -6.0]} c="#f2c53d" ink={0.01} seg={8} />
      {/* shopping cart */}
      <group position={[cartX, 0, cartZ]}>
        <Box s={[0.7, 0.05, 0.95]} p={[0, 0.4, 0]} c="#c9d2da" ink={0.01} />
        <Box s={[0.7, 0.4, 0.04]} p={[0, 0.62, 0.48]} c="#c9d2da" ink={0.01} />
        <Box s={[0.7, 0.4, 0.04]} p={[0, 0.62, -0.48]} c="#c9d2da" ink={0.01} />
        <Box s={[0.04, 0.4, 0.95]} p={[0.35, 0.62, 0]} c="#c9d2da" ink={0.01} />
        <Box s={[0.04, 0.4, 0.95]} p={[-0.35, 0.62, 0]} c="#c9d2da" ink={0.01} />
        <Box s={[0.76, 0.05, 0.06]} p={[0, 1.0, 0.6]} c="#e5484d" ink={0.01} />
        {Array.from({length: Math.min(jugs, 4)}).map((_, i) => (
          <Box key={i} s={[0.24, 0.34, 0.2]} p={[-0.22 + (i % 2) * 0.44, 0.62, -0.24 + Math.floor(i / 2) * 0.3]} c="#7cc9f2" ink={0.01} />
        ))}
        {Array.from({length: Math.min(cans, 8)}).map((_, i) => (
          <Cyl key={i} r={0.06} h={0.12} p={[-0.25 + (i % 4) * 0.17, 0.5, 0.12 + Math.floor(i / 4) * 0.16]} c="#d7513b" ink={0.008} seg={8} />
        ))}
        {[-0.28, 0.28].map((x) => [-0.4, 0.4].map((z) => <Ball key={x + '' + z} r={0.05} p={[x, 0.07, z]} c="#222" ink={0} />))}
      </group>
      {/* checkout lane at the far end */}
      <group position={[0, 0, -10.8]}>
        <Box s={[3.2, 0.95, 0.9]} p={[0.6, 0.48, 0]} c="#2f6fae" />
        <Box s={[2.4, 0.08, 0.7]} p={[0.2, 0.98, 0]} c="#2b2e36" ink={0.012} />
        {Array.from({length: 12}).map((_, i) => (
          <Box key={i} s={[0.03, 0.01, 0.7]} p={[-0.9 + ((i * 0.2 + belt * 0.8) % 2.4), 1.03, 0]} c="#4a4f5c" ink={0} cast={false} />
        ))}
        <Box s={[0.6, 0.45, 0.5]} p={[1.6, 1.2, 0]} c="#e8ecef" ink={0.02} />
        <Box s={[0.4, 0.28, 0.04]} p={[1.6, 1.36, 0.27]} c={beep > 0 ? '#9dffb0' : '#1b3a2b'} basic ink={0} />
        <Box s={[0.5, 0.02, 0.5]} p={[0.2, 1.04, 0]} c={beep > 0 ? '#ff4040' : '#661111'} basic ink={0} cast={false} />
        <Box s={[1.0, 0.8, 0.6]} p={[2.3, 0.4, 0.1]} c="#e5484d" />
        {/* lane light */}
        <Cyl r={0.05} h={2.4} p={[2.9, 1.9, 0]} c="#aab4bd" ink={0.012} seg={8} />
        <Ball r={0.22} p={[2.9, 3.1, 0]} c={beep > 0 ? '#9dffb0' : '#4cb86b'} basic ink={0.02} />
      </group>
      <Sky top="#ffeab8" bottom="#ffeab8" r={60} />
    </group>
  );
};

// ===================================================================== HOUSES (front of two neighbours)
const sidingTex = (base: string, line: string) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = line;
  c.lineWidth = 4;
  for (let y = 0; y < h; y += 28) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
};

const House: React.FC<{x: number; wall: string; line: string; roof: string; door: string; lit: boolean; flip?: boolean}> = ({x, wall, line, roof, door, lit}) => {
  const tex = useTex('sid' + wall, 256, 256, sidingTex(wall, line), [3, 2]);
  const w = 4.4, h = 3.2, d = 3.4;
  const roofShape = React.useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.35, 0);
    s.lineTo(0, 1.6);
    s.lineTo(w / 2 + 0.35, 0);
    s.closePath();
    return s;
  }, []);
  const win = lit ? '#ffd77a' : '#9fd8f5';
  return (
    <group position={[x, 0, 0]}>
      <Box s={[w, h, d]} p={[0, h / 2, 0]} c="#ffffff" map={tex} />
      <group position={[0, h, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, d / 2 + 0.3]}>
          <extrudeGeometry args={[roofShape, {depth: d + 0.6, bevelEnabled: false}]} />
          <meshToonMaterial gradientMap={RAMP} color={roof} />
        </mesh>
        <mesh position={[0, 0, d / 2 + 0.3]} scale={1.0}>
          <extrudeGeometry args={[roofShape, {depth: d + 0.6, bevelEnabled: false}]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      </group>
      {/* door */}
      <Box s={[0.9, 1.9, 0.08]} p={[-0.9, 0.95, d / 2 + 0.04]} c={door} ink={0.02} />
      <Ball r={0.05} p={[-0.6, 0.95, d / 2 + 0.1]} c="#f2c53d" ink={0.01} />
      <Box s={[1.3, 0.12, 0.6]} p={[-0.9, 0.06, d / 2 + 0.3]} c="#d6d0c4" ink={0.015} />
      {/* windows */}
      {[0.9, -1.4].map((wx, i) => (
        <group key={i}>
          <Box s={[1.1, 1.2, 0.08]} p={[wx + (i === 1 ? 0.2 : 0.5), 1.9, d / 2 + 0.04]} c="#ffffff" ink={0.02} />
          <Box s={[0.9, 1.0, 0.09]} p={[wx + (i === 1 ? 0.2 : 0.5), 1.9, d / 2 + 0.06]} c={win} basic={lit} ink={0} />
          <Box s={[0.05, 1.0, 0.1]} p={[wx + (i === 1 ? 0.2 : 0.5), 1.9, d / 2 + 0.08]} c="#ffffff" ink={0} />
        </group>
      ))}
      <Box s={[0.5, 1.2, 0.5]} p={[1.4, h + 1.3, -0.4]} c="#b5654a" />
      {lit && <pointLight position={[0, 1.8, d / 2 + 1.2]} color="#ffcf80" intensity={3} distance={6} decay={2} />}
    </group>
  );
};

const Tree: React.FC<{p: V3; s?: number}> = ({p, s = 1}) => (
  <group position={p} scale={s}>
    <Cyl r={0.14} h={1.4} p={[0, 0.7, 0]} c="#7a5230" ink={0.02} seg={8} />
    <Ball r={0.9} p={[0, 2.0, 0]} c="#4cb86b" scale={[1, 1.15, 1]} />
    <Ball r={0.6} p={[0.5, 1.7, 0.2]} c="#3ea05b" ink={0.02} />
  </group>
);

export const Houses: React.FC<{mode: 'day' | 'dusk'; t: number; mailLeft?: boolean}> = ({mode}) => {
  const dusk = mode === 'dusk';
  const road = useTex('road', 64, 64, (c) => { c.fillStyle = '#6b7482'; c.fillRect(0, 0, 64, 64); });
  void road;
  return (
    <group>
      <Floor w={40} d={14} c={dusk ? '#4c7a54' : '#7bd05f'} p={[0, 1]} />
      <Floor w={40} d={3.2} c="#6b7482" p={[0, 6.6]} y={0.01} />
      {/* sidewalk */}
      <Floor w={40} d={1.0} c="#cfc8bb" p={[0, 4.6]} y={0.012} />
      {/* dashed centre line */}
      {Array.from({length: 14}).map((_, i) => (
        <Plane key={i} w={0.9} h={0.12} p={[-12 + i * 1.8, 0.016, 6.6]} rot={[-Math.PI / 2, 0, 0]} c="#f2e9b5" recv={false} />
      ))}
      <House x={-3.4} wall="#bfe3f2" line="#9bc6dc" roof="#2d8f9e" door="#e5484d" lit={dusk} />
      <House x={3.4} wall="#ffc7a6" line="#eaa57f" roof="#c64b78" door="#2f6fae" lit={false} />
      {/* fence between */}
      {Array.from({length: 7}).map((_, i) => (
        <Box key={i} s={[0.08, 0.7, 0.05]} p={[-0.45 + i * 0.15, 0.35, 2.2]} c="#ffffff" ink={0.01} />
      ))}
      <Box s={[1.1, 0.06, 0.05]} p={[0, 0.5, 2.2]} c="#ffffff" ink={0.01} />
      <Tree p={[-7, 0, -0.5]} s={1.2} />
      <Tree p={[8.2, 0, 0.5]} s={1.1} />
      {/* bushes */}
      {[-5.2, -1.8, 1.8, 5.0].map((x) => (
        <Ball key={x} r={0.35} p={[x, 0.3, 2.0]} c="#3ea05b" scale={[1.4, 1, 1]} />
      ))}
      {/* mailbox */}
      <Cyl r={0.04} h={0.9} p={[2.0, 0.45, 3.9]} c="#7a5230" ink={0.012} seg={6} />
      <Box s={[0.3, 0.22, 0.4]} p={[2.0, 0.98, 3.9]} c="#e5484d" ink={0.015} />
      {/* back hills + sky */}
      <Plane w={60} h={6} p={[0, 2.6, -14]} c={dusk ? '#3c5f6a' : '#8fd3a0'} recv={false} />
      <Sky top={dusk ? '#5b4a9a' : '#6fb4ee'} bottom={dusk ? '#ffa772' : '#cfeeff'} r={120} />
    </group>
  );
};

// ===================================================================== KITCHEN
export const Kitchen: React.FC<{
  t: number;
  lamp: number; // 0..1 ceiling lamp
  variant: 'man' | 'neighbor';
  clock?: boolean;
  tapDrip?: number; // 0 flowing .. 1 dry
  phoneGlow?: number;
  sky?: number; // window sky phase 0..1 (0 day, .5 night)
  fridgeOpen?: number;
  skyLive?: boolean;
}> = ({t, lamp, variant, clock, tapDrip = 0, phoneGlow = 0, sky = 0.1, fridgeOpen = 0}) => {
  const nb = variant === 'neighbor';
  const wall = nb ? '#ffe08a' : '#a8dcc9';
  const lower = nb ? '#e8a548' : '#6fb7a6';
  const tileTex = useTex('ktile' + nb, 256, 256, (c, w, h) => {
    c.fillStyle = nb ? '#f0e2c0' : '#e9f2ee';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b9b5a6';
    c.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      c.beginPath(); c.moveTo((i * w) / 8, 0); c.lineTo((i * w) / 8, h); c.stroke();
      c.beginPath(); c.moveTo(0, (i * h) / 8); c.lineTo(w, (i * h) / 8); c.stroke();
    }
  }, [5, 5]);
  const skyDraw = (c: CanvasRenderingContext2D) => {
    const night = Math.sin(sky * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5; // 0 day .. 1 night
    const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(lerp(v, b[i], night)));
    const top = mix([108, 180, 238], [12, 20, 56]);
    const bot = mix([207, 238, 255], [60, 50, 110]);
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    // sun / moon travelling across
    const a = sky * Math.PI * 2;
    const sx = 128 + Math.cos(a - Math.PI / 2) * 90, sy = 200 - Math.sin(a - Math.PI / 2) * 150;
    c.fillStyle = night > 0.5 ? '#f4f1d8' : '#ffe27a';
    c.beginPath(); c.arc(sx, sy, 20, 0, 7); c.fill();
    // far rooftops
    c.fillStyle = night > 0.5 ? '#0b1030' : '#9fb7c9';
    for (let i = 0; i < 8; i++) c.fillRect(i * 34, 200 - hash(i, 5) * 40, 30, 80);
  };
  const L = lamp;
  return (
    <group>
      <Floor w={7} d={7} c={nb ? '#c9a27a' : '#c8d6dd'} p={[0, 0]} />
      {/* back wall (z = -2.4) */}
      <Plane w={7} h={3} p={[0, 1.5, -2.4]} c={wall} />
      <Plane w={7} h={1.0} p={[0, 1.1, -2.39]} c="#ffffff" map={tileTex} />
      <Plane w={7} h={3} p={[-3.4, 1.5, 0]} c={wall} rot={[0, Math.PI / 2, 0]} />
      <Plane w={7} h={3} p={[3.4, 1.5, 0]} c={wall} rot={[0, -Math.PI / 2, 0]} />
      <Plane w={7} h={7} p={[0, 3, 0]} c="#f4efe6" rot={[Math.PI / 2, 0, 0]} recv={false} />
      {/* counter with sink */}
      <Box s={[4.6, 0.9, 0.7]} p={[0.2, 0.45, -2.0]} c={lower} />
      <Box s={[4.7, 0.06, 0.78]} p={[0.2, 0.93, -2.0]} c="#f1ead6" ink={0.015} />
      <Box s={[0.8, 0.04, 0.5]} p={[0.9, 0.96, -2.0]} c="#9aa7b2" ink={0.012} />
      {/* tap */}
      <Cyl r={0.03} h={0.38} p={[0.9, 1.15, -2.25]} c="#c7d0d8" ink={0.012} seg={8} />
      <Cyl r={0.03} h={0.2} p={[0.9, 1.34, -2.15]} c="#c7d0d8" rot={[Math.PI / 2, 0, 0]} ink={0.012} seg={8} />
      {/* water stream / drops */}
      {tapDrip < 0.05 && <Cyl r={0.012} h={0.3} p={[0.9, 1.12, -2.05]} c="#8fd8ff" basic ink={0} seg={6} />}
      {/* upper cabinets */}
      <Box s={[2.2, 0.8, 0.4]} p={[-1.7, 2.1, -2.2]} c={lower} />
      <Box s={[1.4, 0.8, 0.4]} p={[2.4, 2.1, -2.2]} c={lower} />
      {/* window above the sink */}
      <Box s={[1.5, 1.3, 0.1]} p={[0.9, 1.9, -2.38]} c="#ffffff" ink={0.025} />
      <LiveTex w={256} h={256} size={[1.3, 1.1]} p={[0.9, 1.9, -2.32]} draw={skyDraw} />
      <Box s={[0.05, 1.1, 0.04]} p={[0.9, 1.9, -2.3]} c="#ffffff" ink={0} />
      {/* fridge */}
      <group position={[nb ? -0.4 : -2.7, 0, nb ? -1.7 : -1.9]}>
        <Box s={[1.1, 2.1, 0.8]} p={[0, 1.05, 0]} c="#eef2f4" />
        {nb && fridgeOpen > 0.01 && <Box s={[0.96, 1.9, 0.02]} p={[0, 1.05, 0.38]} c={'#fffbea'} basic ink={0} cast={false} />}
        {nb && fridgeOpen > 0.01 && [0.4, 0.95, 1.5].map((y) => <Box key={y} s={[0.96, 0.03, 0.6]} p={[0, y, 0.1]} c="#cfe6ee" ink={0.008} cast={false} />)}
        <group position={[-0.55, 1.05, 0.41]} rotation={[0, -fridgeOpen * 1.9, 0]}>
          <Box s={[1.1, 2.08, 0.06]} p={[0.55, 0, 0]} c="#eef2f4" ink={0.025} />
          <Box s={[0.05, 0.7, 0.07]} p={[0.95, 0.3, 0.06]} c="#9aa7b2" ink={0.012} />
        </group>
        {nb && fridgeOpen > 0.01 && <pointLight position={[0, 1.2, 0.7]} color="#fff6d8" intensity={3 * clamp01(fridgeOpen * 2)} distance={4} decay={2} />}
      </group>
      {/* table with phone */}
      <Cyl r={0.7} h={0.06} p={[1.2, 0.8, 0.4]} c="#f1ead6" ink={0.02} />
      <Cyl r={0.06} h={0.8} p={[1.2, 0.4, 0.4]} c="#8a6a4a" ink={0.015} seg={8} />
      <Box s={[0.1, 0.02, 0.18]} p={[1.1, 0.84, 0.4]} c={phoneGlow > 0.05 ? '#8fe3ff' : '#10131a'} basic={phoneGlow > 0.05} ink={0.006} />
      {/* wall clock */}
      {clock && (
        <group position={[-1.2, 1.9, -2.36]}>
          <Cyl r={0.32} h={0.06} p={[0, 0, 0]} c="#ffffff" rot={[Math.PI / 2, 0, 0]} ink={0.025} seg={28} />
          <Box s={[0.025, 0.2, 0.02]} p={[0, 0.09, 0.05]} c={INK} ink={0} basic rot={[0, 0, -t * 0.2]} />
          <Box s={[0.02, 0.26, 0.02]} p={[0.07, 0.07, 0.06]} c={INK} ink={0} basic rot={[0, 0, -t * 0.8 - 0.8]} />
        </group>
      )}
      {/* ceiling lamp */}
      <group position={[0, 2.75, -0.4]}>
        <Cyl r={0.02} h={0.25} p={[0, 0.12, 0]} c="#444" ink={0} seg={6} />
        <Ball r={0.18} p={[0, -0.05, 0]} c={L > 0.05 ? '#ffffff' : '#403f48'} basic={L > 0.05} ink={0.02} />
      </group>
      <pointLight position={[0, 2.6, -0.4]} color="#ffe6b8" intensity={9 * L} distance={10} decay={1.6} />
      <Sky top="#101020" bottom="#101020" r={30} />
    </group>
  );
};

// ===================================================================== HOME HALL (backpack, door, Paris window)
const parisTex = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6d8bd8');
  g.addColorStop(0.55, '#f7b4a0');
  g.addColorStop(1, '#ffd9b0');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // haze sun
  c.fillStyle = 'rgba(255,240,200,0.8)'; c.beginPath(); c.arc(w * 0.25, h * 0.62, 46, 0, 7); c.fill();
  // far roofs
  c.fillStyle = '#9a8aa8';
  for (let i = 0; i < 14; i++) c.fillRect(i * (w / 14), h * 0.74 - hash(i, 7) * 30, w / 14 + 2, 200);
  // Eiffel tower silhouette
  const cx = w * 0.62, base = h * 0.78, top = h * 0.12, bw = w * 0.34;
  const ink = '#3d3350';
  c.fillStyle = ink;
  const tw = (y: number) => {
    const u = (y - top) / (base - top);
    return 6 + Math.pow(u, 2.4) * bw;
  };
  c.beginPath();
  c.moveTo(cx - 3, top);
  for (let y = top; y <= base; y += 4) c.lineTo(cx - tw(y) / 2, y);
  c.lineTo(cx - bw / 2 - 6, base);
  c.lineTo(cx - bw / 2 + 24, base);
  // arch cut
  c.quadraticCurveTo(cx, base - bw * 0.42, cx + bw / 2 - 24, base);
  c.lineTo(cx + bw / 2 + 6, base);
  for (let y = base; y >= top; y -= 4) c.lineTo(cx + tw(y) / 2, y);
  c.lineTo(cx + 3, top);
  c.closePath();
  c.fill();
  // platforms
  for (const u of [0.36, 0.62]) {
    const y = top + (base - top) * u;
    c.fillRect(cx - tw(y) / 2 - 6, y - 4, tw(y) + 12, 8);
  }
  // lattice cross-bracing
  c.strokeStyle = '#f7b4a0'; c.lineWidth = 1.6;
  for (let u = 0.12; u < 0.7; u += 0.055) {
    const y = top + (base - top) * u;
    const w0 = tw(y) / 2;
    c.beginPath(); c.moveTo(cx - w0, y); c.lineTo(cx + w0, y + 14); c.moveTo(cx + w0, y); c.lineTo(cx - w0, y + 14); c.stroke();
  }
  c.fillStyle = ink; c.fillRect(cx - 1.5, top - 28, 3, 30);
};

export const Home: React.FC<{t: number; zip: number; items: {kind: string; u: number; from: V3}[]; packOpen: number; lift: number; showItems?: boolean}> = ({t, zip, items, packOpen, lift}) => {
  const paris = useTex('paris', 640, 800, parisTex);
  const wood = useTex('plank', 256, 256, (c, w, h) => {
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#d8aa78' : '#cf9f6c';
      c.fillRect(0, (i * h) / 6, w, h / 6);
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3; c.strokeRect(0, (i * h) / 6, w, h / 6);
    }
  }, [3, 3]);
  const paper = useTex('wallp', 128, 128, (c, w, h) => {
    c.fillStyle = '#f5e7cf'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ecd4b0';
    for (let i = 0; i < 8; i++) c.fillRect(i * 16, 0, 6, h);
  }, [6, 2]);
  return (
    <group>
      <Floor w={8} d={8} c="#ffffff" map={wood} p={[0, 0]} />
      <Plane w={8} h={3.2} p={[0, 1.6, -2.2]} c="#ffffff" map={paper} />
      <Plane w={8} h={3.2} p={[-4, 1.6, 0]} c="#ffffff" map={paper} rot={[0, Math.PI / 2, 0]} />
      <Plane w={8} h={3.2} p={[4, 1.6, 0]} c="#ffffff" map={paper} rot={[0, -Math.PI / 2, 0]} />
      <Plane w={8} h={8} p={[0, 3.2, 0]} c="#faf5ea" rot={[Math.PI / 2, 0, 0]} recv={false} />
      <Box s={[8, 0.16, 0.06]} p={[0, 0.08, -2.17]} c="#ffffff" ink={0.012} />
      {/* door */}
      <Box s={[1.1, 2.3, 0.08]} p={[-1.9, 1.15, -2.15]} c="#8a5aa8" ink={0.025} />
      <Ball r={0.06} p={[-1.5, 1.1, -2.08]} c="#f2c53d" ink={0.01} />
      {/* coat hooks */}
      <Box s={[0.8, 0.05, 0.06]} p={[-0.6, 1.8, -2.15]} c="#8a6a4a" ink={0.01} />
      {/* window with Paris */}
      <Box s={[1.7, 2.1, 0.16]} p={[1.3, 1.6, -2.18]} c="#ffffff" ink={0.03} />
      <Plane w={1.5} h={1.9} p={[1.3, 1.6, -2.08]} map={paris} basic />
      <Box s={[0.06, 1.9, 0.06]} p={[1.3, 1.6, -2.04]} c="#ffffff" ink={0.01} />
      <Box s={[1.5, 0.06, 0.06]} p={[1.3, 1.9, -2.04]} c="#ffffff" ink={0.01} />
      <Plane w={0.5} h={2.2} p={[0.35, 1.6, -2.0]} c="#e5484d" rot={[0, 0.15, 0]} />
      <Plane w={0.5} h={2.2} p={[2.25, 1.6, -2.0]} c="#e5484d" rot={[0, -0.15, 0]} />
      <pointLight position={[1.3, 1.6, -1.3]} color="#ffbb8a" intensity={5} distance={7} decay={2} />
      <pointLight position={[-0.5, 2.7, 0.5]} color="#fff0d8" intensity={5} distance={9} decay={2} />
      {/* rug */}
      <Plane w={2.4} h={1.6} p={[0, 0.012, -0.8]} rot={[-Math.PI / 2, 0, 0]} c="#e5a05c" recv={false} />
      {/* BACKPACK */}
      <group position={[-1.1, lift, -0.8]}>
        <Box s={[0.5, 0.66, 0.32]} p={[0, 0.33, 0]} c="#e0752b" />
        <Box s={[0.42, 0.22, 0.12]} p={[0, 0.22, 0.2]} c="#b85a1c" ink={0.015} />
        <Box s={[0.08, 0.5, 0.06]} p={[-0.18, 0.4, -0.18]} c="#2a2f3a" ink={0.01} />
        <Box s={[0.08, 0.5, 0.06]} p={[0.18, 0.4, -0.18]} c="#2a2f3a" ink={0.01} />
        <Box s={[0.1, 0.4, 0.04]} p={[0.28, 0.33, 0.16]} c="#e8c24a" ink={0.008} />
        {/* top flap hinged at the back */}
        <group position={[0, 0.66, -0.15]} rotation={[-packOpen * 1.9, 0, 0]}>
          <Box s={[0.5, 0.06, 0.36]} p={[0, 0.03, 0.17]} c="#c9631f" ink={0.02} />
        </group>
        {packOpen > 0.2 && <Box s={[0.42, 0.01, 0.24]} p={[0, 0.64, 0]} c="#2b1b12" ink={0} cast={false} />}
        {/* zipper line + sliding pull */}
        <Box s={[0.5, 0.012, 0.012]} p={[0, 0.7, 0.18]} c="#333" ink={0} cast={false} />
        <Box s={[0.05, 0.05, 0.03]} p={[lerp(-0.22, 0.22, zip) , 0.72, 0.2]} c="#f2c53d" ink={0.008} />
      </group>
      {/* items flying into the pack */}
      {items.map((it, i) => {
        const u = clamp01(it.u);
        if (u <= 0 || u >= 1) return null;
        const tgt: V3 = [-1.1, 0.8, -0.8];
        const px = lerp(it.from[0], tgt[0], smooth(u));
        const pz = lerp(it.from[2], tgt[2], smooth(u));
        const py = lerp(it.from[1], tgt[1], smooth(u)) + Math.sin(u * Math.PI) * 0.45;
        const s = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
        return (
          <group key={i} position={[px, py, pz]} scale={s} rotation={[u * 5, u * 3, 0]}>
            {it.kind === 'bottle' && <Cyl r={0.05} h={0.26} p={[0, 0, 0]} c="#7cc9f2" ink={0.01} seg={10} />}
            {it.kind === 'can' && <Cyl r={0.05} h={0.1} p={[0, 0, 0]} c="#d7513b" ink={0.01} seg={10} />}
            {it.kind === 'torch' && <Cyl r={0.03} h={0.24} p={[0, 0, 0]} c="#f2c53d" ink={0.008} seg={8} />}
            {it.kind === 'radio' && <Box s={[0.22, 0.14, 0.08]} p={[0, 0, 0]} c="#c0392b" ink={0.01} />}
            {it.kind === 'cash' && <Box s={[0.2, 0.06, 0.1]} p={[0, 0, 0]} c="#7bc96f" ink={0.01} />}
            {it.kind === 'blanket' && <Cyl r={0.07} h={0.3} p={[0, 0, 0]} c="#8a63d2" ink={0.01} rot={[0, 0, Math.PI / 2]} seg={10} />}
          </group>
        );
      })}
      <Sky top="#2a2a44" bottom="#2a2a44" r={30} />
    </group>
  );
};
