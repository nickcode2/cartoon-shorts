import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Ball, Box, Cyl, Floor, LiveTex, Plane, Sky, V3, Vehicle, clamp01, hash, lerp, makeTex, smooth, useTex, INK} from './kit';

// ===================================================================== MAP OF EUROPE (+ Canada and Japan tiles)
type LL = [number, number];
const MAINLAND: LL[] = [[-5.6, 36], [-9, 37], [-9.4, 39], [-8.9, 42], [-9.3, 43.2], [-2, 43.6], [-1.2, 44.6], [-1.2, 46.2], [-2.3, 47.2], [-4.7, 47.9], [-4.5, 48.7], [-1.6, 48.6], [-1.4, 49.7], [0.2, 49.5], [1.6, 50.4], [2.5, 51.1], [3.6, 51.4], [4.5, 52.4], [5.1, 53.3], [7, 53.5], [8.6, 53.9], [8.4, 55.3], [8.2, 56.9], [10.6, 57.7], [10.5, 56.2], [10, 55.2], [9.8, 54.8], [11, 54.1], [13.5, 54.2], [14.2, 53.9], [16.5, 54.5], [18.7, 54.5], [19.8, 54.5], [21, 55.2], [21, 56.8], [21.8, 57.6], [23.6, 57], [24.4, 57.8], [23.5, 59.2], [26, 59.5], [28, 59.5], [29.8, 60.0], [28.5, 60.5], [26, 60.4], [22.5, 60.0], [21.6, 61.5], [21.5, 63], [25, 65], [25.4, 65.6], [24.2, 65.8], [22, 65.7], [21, 64.8], [17.8, 62.8], [17.3, 61.3], [18.9, 60], [17.6, 58.7], [16.7, 57.2], [16, 56.2], [14.3, 55.5], [12.8, 55.6], [12.6, 56.5], [11.8, 58.2], [11.2, 59.2], [10.6, 59.6], [9.5, 59], [8, 58.2], [6, 58.4], [5.5, 59.7], [5, 61], [5.5, 62.5], [8, 63.8], [10.5, 64.5], [13, 66.3], [15, 68], [18, 69.5], [21, 70], [25, 71], [29, 70.9], [31, 70.2], [30.5, 69.5], [32, 69.7], [36, 69], [36, 45.5], [33.5, 44.4], [31, 46.5], [29.7, 45.2], [28.9, 44.2], [28, 43.3], [27.8, 42], [28.2, 41.4], [26.5, 40.8], [26, 40.5], [24, 40.8], [23.5, 40.2], [24, 38.5], [23, 37], [21.7, 36.8], [21.2, 38], [19.5, 40], [19.4, 41.9], [18.5, 42.5], [16.5, 43.5], [14.5, 45.3], [13.7, 45.6], [12.3, 45.3], [12.5, 44], [14, 42.3], [16, 41.8], [18.5, 40.2], [17, 39], [16.6, 38.2], [15.7, 38], [16.2, 39.5], [15.6, 40], [14.2, 40.8], [12.4, 41.5], [10.5, 42.9], [10, 44], [8.7, 44.4], [7, 43.6], [6, 43], [4.2, 43.4], [3.2, 42.4], [3.2, 41.7], [0.8, 41], [0, 39.8], [-0.5, 38.5], [-0.7, 37.6], [-2.1, 36.7], [-4.4, 36.7]];
const UK: LL[] = [[-5.7, 50], [-3, 50.6], [1.4, 51.2], [1.7, 52.7], [0, 53.6], [-1.5, 55], [-2, 56], [-1.8, 57.6], [-3.5, 58.6], [-5, 58.6], [-6, 57], [-5.5, 55.7], [-4.8, 54.8], [-3.2, 54.8], [-3, 53.4], [-4.5, 53.3], [-4.2, 52.2], [-5.2, 51.8], [-3.1, 51.4], [-4.5, 51.2]];
const IRELAND: LL[] = [[-10, 51.7], [-6.3, 52.2], [-6, 53.5], [-5.7, 54.6], [-7.3, 55.3], [-8.5, 54.3], [-10, 53.8], [-9.8, 52.5]];
const ICELAND: LL[] = [[-24, 65.5], [-22, 66.4], [-17, 66.2], [-14.5, 65.5], [-14, 64.5], [-18, 63.4], [-22.5, 63.8]];
const SICILY: LL[] = [[12.4, 38], [15.6, 38.2], [15.1, 36.7], [12.5, 37.6]];
const SARDINIA: LL[] = [[8.2, 41], [9.7, 41], [9.6, 39.2], [8.5, 38.9]];
const CANADA: LL[] = [[-141, 69.5], [-125, 70], [-110, 68], [-95, 69], [-85, 67], [-82, 63], [-93, 61], [-93, 58], [-85, 55], [-80, 51.5], [-79, 54], [-77, 58], [-78, 62], [-73, 62], [-65, 60], [-62, 57], [-56, 52], [-60, 50], [-66, 50], [-64, 47.5], [-60, 46], [-66, 44.6], [-67, 45], [-71, 45], [-75, 45], [-79, 43.5], [-83, 42], [-82.5, 45], [-89, 48], [-95, 49], [-123, 49], [-125, 50], [-130, 54], [-133, 57], [-141, 60]];
const JAPAN: LL[][] = [
  [[130.9, 34], [132, 35.5], [135, 35.7], [136.8, 37.3], [139, 38], [140, 40.5], [141.5, 41.4], [142, 39.5], [141, 37], [140.8, 35.7], [139.8, 35], [137, 34.6], [135.2, 33.5], [133, 33.9]],
  [[140, 42], [141.5, 45.4], [145.5, 43.3], [143, 42], [141, 41.8]],
  [[130, 31.2], [131.5, 31.5], [131.8, 33.5], [130, 33.8], [129.7, 32.5]],
  [[132.5, 33.2], [134.5, 34], [134.3, 33.6], [133, 32.8]],
];

const SEA = '#6cc3e6';
const LAND = '#f6e7b0';
const LAND_EDGE = '#241726';

function drawPoly(c: CanvasRenderingContext2D, pts: LL[], f: (p: LL) => [number, number]) {
  c.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = f(p);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.closePath();
  c.fillStyle = LAND;
  c.fill();
  c.lineWidth = 5;
  c.lineJoin = 'round';
  c.strokeStyle = LAND_EDGE;
  c.stroke();
}

const PPX = 40, PPY = 64;
const MAP_W = 61 * PPX, MAP_H = 38 * PPY;
const toPx = (p: LL): [number, number] => [(p[0] + 25) * PPX, (72 - p[1]) * PPY];
// world position on the map table (metres)
export const mapXZ = (lon: number, lat: number): [number, number] => [(lon + 25) * 0.12 - 3.66, (72 - lat) * 0.192 - 3.65];

const europeTex = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = SEA;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.28)';
  c.lineWidth = 2;
  for (let lon = -20; lon < 36; lon += 10) { const [x] = toPx([lon, 0]); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let lat = 40; lat < 72; lat += 10) { const [, y] = toPx([0, lat]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (const poly of [MAINLAND, UK, IRELAND, ICELAND, SICILY, SARDINIA]) drawPoly(c, poly, toPx);
  // inner texture: soft hills
  c.fillStyle = 'rgba(190,160,100,0.18)';
  for (let i = 0; i < 160; i++) {
    const lon = -9 + hash(i, 1) * 44, lat = 37 + hash(i, 2) * 33;
    const [x, y] = toPx([lon, lat]);
    c.beginPath(); c.arc(x, y, 14 + hash(i, 3) * 26, 0, 7); c.fill();
  }
  c.strokeStyle = LAND_EDGE; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
};

const CITIES: {n: string; ll: LL; at: number}[] = [
  {n: 'Stockholm', ll: [18.1, 59.3], at: 0.25}, {n: 'Oslo', ll: [10.7, 59.9], at: 0.5}, {n: 'Helsinki', ll: [25, 60.2], at: 0.6},
  {n: 'Berlin', ll: [13.4, 52.5], at: 0.8}, {n: 'Copenhagen', ll: [12.6, 55.7], at: 0.85}, {n: 'Warsaw', ll: [21, 52.2], at: 1.0},
  {n: 'Paris', ll: [2.3, 48.9], at: 1.15}, {n: 'Amsterdam', ll: [4.9, 52.4], at: 1.2}, {n: 'Prague', ll: [14.4, 50.1], at: 1.3},
  {n: 'Vienna', ll: [16.4, 48.2], at: 1.45}, {n: 'Brussels', ll: [4.4, 50.8], at: 1.5}, {n: 'Dublin', ll: [-6.3, 53.3], at: 1.6},
  {n: 'Madrid', ll: [-3.7, 40.4], at: 1.8}, {n: 'Rome', ll: [12.5, 41.9], at: 1.9}, {n: 'Budapest', ll: [19, 47.5], at: 1.95},
  {n: 'Kyiv', ll: [30.5, 50.4], at: 2.05}, {n: 'Lisbon', ll: [-9.1, 38.7], at: 2.2}, {n: 'Athens', ll: [23.7, 38], at: 2.3},
  {n: 'Bucharest', ll: [26, 44.4], at: 2.4}, {n: 'Reykjavik', ll: [-21.9, 64.1], at: 2.55},
];
// London / Tokyo / Ottawa come in with the lines about the UK, Japan and Canada
const EXTRA = [
  {n: 'London', ll: [-0.1, 51.5] as LL, at: 33.7 - 15.3, tile: 'eu'}, {n: 'Tokyo', ll: [139.7, 35.7] as LL, at: 34.6 - 15.3, tile: 'jp'}, {n: 'Ottawa', ll: [-75.7, 45.4] as LL, at: 35.4 - 15.3, tile: 'ca'},
];

const Pulse: React.FC<{p: V3; t0: number; t: number; r: number}> = ({p, t0, t, r}) => {
  const age = t - t0;
  if (age < 0) return null;
  const pop = Math.min(1, age / 0.18);
  const sc = pop < 1 ? 1 + 0.5 * Math.sin(pop * Math.PI) : 1;
  const ph = (age * 0.9) % 1;
  return (
    <group position={p}>
      <Cyl r={r} h={0.05} p={[0, 0.03, 0]} c="#ff2f3a" ink={0.012} seg={20} basic />
      <group scale={sc * pop}>
        <Cyl r={r * 0.55} h={0.06} p={[0, 0.06, 0]} c="#ffd0d0" ink={0} seg={14} basic />
      </group>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={r * (1 + ph * 5)}>
        <ringGeometry args={[0.85, 1, 36]} />
        <meshBasicMaterial color="#ff2f3a" transparent opacity={0.65 * (1 - ph)} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const MapSet: React.FC<{t: number; absT: number; dotR?: number}> = ({t, absT, dotR = 0.075}) => {
  const eu = useTex('europe', MAP_W, MAP_H, europeTex);
  const caTex = useTex('canada', 1200, 700, (c, w, h) => {
    c.fillStyle = SEA; c.fillRect(0, 0, w, h);
    const f = (p: LL): [number, number] => [((p[0] + 142) / 92) * w, ((72 - p[1]) / 31) * h];
    drawPoly(c, CANADA, f);
    c.strokeStyle = LAND_EDGE; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
  const jpTex = useTex('japan', 700, 900, (c, w, h) => {
    c.fillStyle = SEA; c.fillRect(0, 0, w, h);
    const f = (p: LL): [number, number] => [((p[0] - 127) / 21) * w, ((47 - p[1]) / 18) * h];
    JAPAN.forEach((p) => drawPoly(c, p, f));
    c.strokeStyle = LAND_EDGE; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
  const wood = useTex('tablewood', 256, 256, (c, w, h) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#b98655' : '#c4915e';
      c.fillRect(0, (i * h) / 8, w, h / 8);
      c.strokeStyle = '#7a5230'; c.lineWidth = 3; c.strokeRect(0, (i * h) / 8, w, h / 8);
    }
  }, [6, 6]);
  const toWorld = (ll: LL, tile: string): V3 => {
    if (tile === 'ca') return [-9.5 + ((ll[0] + 142) / 92 - 0.5) * 6, 0.02, ((72 - ll[1]) / 31 - 0.5) * 3.5];
    if (tile === 'jp') return [9 + ((ll[0] - 127) / 21 - 0.5) * 3.5, 0.02, ((47 - ll[1]) / 18 - 0.5) * 4.5];
    const [x, z] = mapXZ(ll[0], ll[1]);
    return [x, 0.02, z];
  };
  return (
    <group>
      <Floor w={60} d={60} c="#ffffff" map={wood} y={-0.06} />
      <Box s={[7.4, 0.1, 7.4]} p={[0, -0.03, 0]} c="#f5f0e0" ink={0.02} recv={false} />
      <Plane w={7.32} h={7.296} p={[0, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={eu} basic />
      <Box s={[6.2, 0.1, 3.7]} p={[-9.5, -0.03, 0]} c="#f5f0e0" ink={0.02} recv={false} />
      <Plane w={6} h={3.5} p={[-9.5, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={caTex} basic />
      <Box s={[3.7, 0.1, 4.7]} p={[9, -0.03, 0]} c="#f5f0e0" ink={0.02} recv={false} />
      <Plane w={3.5} h={4.5} p={[9, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={jpTex} basic />
      {CITIES.map((c) => (
        <Pulse key={c.n} p={toWorld(c.ll, 'eu')} t0={c.at} t={absT - 15.3} r={dotR} />
      ))}
      {EXTRA.map((c) => (
        <Pulse key={c.n} p={toWorld(c.ll, c.tile)} t0={c.at} t={absT - 15.3} r={dotR * (c.tile === 'eu' ? 1.4 : 1.8)} />
      ))}
      {/* thumb tacks on the corners */}
      {[[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].map(([x, z], i) => (
        <Ball key={i} r={0.08} p={[x, 0.08, z]} c="#e5484d" ink={0.01} />
      ))}
      <Sky top="#2c3a63" bottom="#8a9ec4" r={120} />
      <pointLight position={[0, 8, 2]} intensity={10} color="#fff4dc" distance={30} decay={1.4} />
      <group visible={false}>{t > 1e9 && <mesh />}</group>
    </group>
  );
};

// ===================================================================== BOOKLET COVER (shared)
export const coverDraw = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#1d5fb4';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#174e96';
  c.fillRect(0, h * 0.66, w, h * 0.34);
  c.fillStyle = '#f7c928';
  c.fillRect(0, h * 0.04, w, h * 0.07);
  c.fillRect(0, h * 0.89, w, h * 0.06);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 ${w * 0.2}px Arial Black, Arial, Helvetica, sans-serif`;
  c.fillText('IF CRISIS', w / 2, h * 0.27);
  c.fillStyle = '#f7c928';
  c.fillText('OR WAR', w / 2, h * 0.43);
  c.fillStyle = '#ffffff';
  c.fillText('COMES', w / 2, h * 0.59);
  // simple emblem
  c.fillStyle = '#f7c928';
  c.beginPath(); c.arc(w / 2, h * 0.78, w * 0.1, 0, 7); c.fill();
  c.fillStyle = '#1d5fb4';
  c.fillRect(w / 2 - w * 0.012, h * 0.78 - w * 0.07, w * 0.024, w * 0.14);
  c.fillRect(w / 2 - w * 0.07, h * 0.78 - w * 0.012, w * 0.14, w * 0.024);
  c.strokeStyle = '#120a14'; c.lineWidth = w * 0.02; c.strokeRect(w * 0.01, w * 0.01, w * 0.98, h - w * 0.02);
};

export const BookletSet: React.FC<{t: number}> = ({t}) => {
  const cover = useTex('cover', 640, 900, coverDraw);
  const desk = useTex('deskwood', 256, 256, (c, w, h) => {
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#a9744a' : '#b8825a';
      c.fillRect(0, (i * h) / 6, w, h / 6);
      c.strokeStyle = '#6b4528'; c.lineWidth = 3; c.strokeRect(0, (i * h) / 6, w, h / 6);
    }
  }, [3, 3]);
  const flutter = Math.sin(t * 5) * 0.012;
  return (
    <group>
      <Floor w={14} d={14} c="#ffffff" map={desk} y={0} />
      <Plane w={14} h={8} p={[0, 4, -5]} c="#274a7a" />
      <group position={[0, 0.5, 0]} rotation={[-0.45 + flutter, 0.1, 0.08]}>
        <Box s={[1.1, 1.55, 0.04]} p={[0, 0, 0]} c="#fffdf2" ink={0.02} />
        <Plane w={1.1} h={1.55} p={[0, 0, 0.022]} map={cover} basic />
        <Box s={[1.08, 1.53, 0.02]} p={[0.02, -0.02, -0.03]} c="#efe9d6" ink={0.01} />
      </group>
      <Box s={[0.5, 0.05, 0.3]} p={[-1.4, 0.03, 0.6]} c="#e5484d" rot={[0, 0.4, 0]} ink={0.012} />
      <Cyl r={0.05} h={0.3} p={[1.5, 0.05, 0.9]} c="#f2c53d" rot={[0, 0, Math.PI / 2]} ink={0.01} seg={8} />
      <pointLight position={[-1, 3, 3]} color="#fff0d8" intensity={7} distance={14} decay={1.6} />
      <Sky top="#274a7a" bottom="#274a7a" r={40} />
    </group>
  );
};

// ===================================================================== MAILBOXES (Swedish street)
const flagTex = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#006aa7';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#fecc02';
  c.fillRect(w * 0.3125, 0, w * 0.125, h);
  c.fillRect(0, h * 0.4, w, h * 0.2);
  c.strokeStyle = '#120a14'; c.lineWidth = 4; c.strokeRect(1, 1, w - 2, h - 2);
};

export const Mailboxes: React.FC<{t: number}> = ({t}) => {
  const flag = useTex('swflag', 160, 100, flagTex);
  const cover = useTex('cover', 640, 900, coverDraw);
  const wall = useTex('redwood', 128, 128, (c, w, h) => {
    c.fillStyle = '#b8472f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#9c3a26';
    for (let i = 0; i < 128; i += 16) c.fillRect(i, 0, 4, h);
  }, [4, 2]);
  const N = 7;
  const xs = Array.from({length: N}, (_, i) => -5.4 + i * 1.8);
  return (
    <group>
      <Floor w={40} d={16} c="#7bd05f" p={[0, -1]} />
      <Floor w={40} d={3} c="#6b7482" p={[0, 4.5]} y={0.01} />
      <Floor w={40} d={0.9} c="#cfc8bb" p={[0, 2.5]} y={0.012} />
      {/* red houses with white trim in the back */}
      {[-6, 0, 6].map((x, i) => (
        <group key={i} position={[x, 0, -4.5]}>
          <Box s={[3.6, 2.8, 2.6]} p={[0, 1.4, 0]} c="#ffffff" map={wall} />
          <Box s={[3.9, 0.3, 2.9]} p={[0, 2.95, 0]} c="#3a3f4a" ink={0.02} />
          <Box s={[3.6, 0.08, 0.06]} p={[0, 2.78, 1.33]} c="#ffffff" ink={0.01} />
          <Box s={[0.8, 1.7, 0.06]} p={[-0.9, 0.85, 1.32]} c="#ffffff" ink={0.02} />
          <Box s={[0.9, 0.9, 0.06]} p={[0.8, 1.7, 1.32]} c="#ffe9a8" basic ink={0.02} />
          <Box s={[0.06, 0.9, 0.07]} p={[0.8, 1.7, 1.34]} c="#ffffff" ink={0} />
        </group>
      ))}
      {[-8, -2.5, 3, 8.5].map((x) => (
        <group key={x} position={[x, 0, -2.2]}>
          <Cyl r={0.13} h={1.2} p={[0, 0.6, 0]} c="#6a4630" ink={0.015} seg={8} />
          <Cyl r={0.75} r2={0.04} h={2.6} p={[0, 2.5, 0]} c="#2f8f55" ink={0.03} seg={10} />
        </group>
      ))}
      {/* row of mailboxes along the pavement */}
      {xs.map((x, i) => {
        const tHit = 0.15 + i * 0.33; // booklet lands
        const age = t - tHit;
        const flap = age > 0 && age < 0.35 ? Math.sin((age / 0.35) * Math.PI) * 0.9 : 0;
        return (
          <group key={i} position={[x, 0, 2.9]}>
            <Cyl r={0.045} h={1.0} p={[0, 0.5, 0]} c="#7a5230" ink={0.012} seg={6} />
            <Box s={[0.42, 0.3, 0.58]} p={[0, 1.15, 0]} c="#1f6fb5" ink={0.02} />
            <Cyl r={0.21} h={0.58} p={[0, 1.3, 0]} c="#1f6fb5" rot={[Math.PI / 2, 0, 0]} ink={0.02} seg={14} />
            <Box s={[0.44, 0.05, 0.58]} p={[0, 1.07, 0]} c="#fecc02" ink={0.008} />
            <group position={[0, 1.02, 0.3]} rotation={[flap, 0, 0]}>
              <Box s={[0.34, 0.2, 0.025]} p={[0, 0.1, 0]} c="#e8c24a" ink={0.01} />
            </group>
            {/* small Swedish flag on a stick */}
            <Cyl r={0.012} h={0.5} p={[0.24, 1.5, -0.1]} c="#e8e8e8" ink={0.006} seg={6} />
            <group position={[0.24, 1.66, -0.1]} rotation={[0, 0.2 + Math.sin(t * 5 + i) * 0.3, 0]}>
              <Plane w={0.26} h={0.17} p={[0.13, 0, 0]} map={flag} basic side={THREE.DoubleSide} />
            </group>
          </group>
        );
      })}
      {/* booklets flying in */}
      {xs.map((x, i) => {
        const tHit = 0.15 + i * 0.33;
        const u = (t - (tHit - 0.45)) / 0.45;
        if (u <= 0 || u >= 1) return null;
        const px = lerp(x + 1.5, x, smooth(u));
        const py = lerp(1.9, 1.1, u) + Math.sin(u * Math.PI) * 0.35;
        const pz = lerp(1.5, 3.15, smooth(u));
        return (
          <group key={'b' + i} position={[px, py, pz]} rotation={[u * 3, 0.6, u * 4]}>
            <Box s={[0.18, 0.25, 0.015]} p={[0, 0, 0]} c="#1d5fb4" ink={0.008} />
            <Box s={[0.18, 0.04, 0.02]} p={[0, 0.02, 0.003]} c="#f7c928" ink={0} />
          </group>
        );
      })}
      {void cover}
      <Sky top="#6fb4ee" bottom="#cfeeff" r={120} />
    </group>
  );
};

// ===================================================================== CITY AT NIGHT
const bldTex = (seed: number, on: boolean) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = on ? '#2a3466' : '#1b2148';
  c.fillRect(0, 0, w, h);
  const cols = 5, rows = 12;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const lit = hash(seed * 31 + i, j) > 0.3;
      c.fillStyle = on && lit ? (hash(i, j + seed) > 0.5 ? '#ffe08a' : '#fff4c8') : '#141a3a';
      c.fillRect(8 + i * (w / cols), 10 + j * (h / rows), w / cols - 14, h / rows - 12);
    }
};

export const CityNight: React.FC<{absT: number; storm?: number; hero?: boolean; bright?: number}> = ({absT, storm = 0, hero, bright = 1}) => {
  const variants = [0, 1, 2];
  const texOn = variants.map((s) => useTex('bon' + s, 128, 256, bldTex(s, true))); // eslint-disable-line react-hooks/rules-of-hooks
  const texOff = variants.map((s) => useTex('boff' + s, 128, 256, bldTex(s, false))); // eslint-disable-line react-hooks/rules-of-hooks
  const blds = useMemo(() => {
    const arr: {x: number; z: number; w: number; d: number; h: number; v: number; block: number}[] = [];
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++) {
        if (hero && Math.abs(i) <= 1 && (j === 1 || j === 2)) continue;
        const k = i * 9 + j;
        arr.push({x: i * 9 + (hash(k, 1) - 0.5) * 2, z: j * 9 - 10 + (hash(k, 2) - 0.5) * 2, w: 5 + hash(k, 3) * 3, d: 5 + hash(k, 4) * 3, h: 6 + hash(k, 5) * 20 + (Math.abs(i) < 2 && Math.abs(j) < 2 ? 12 : 0), v: Math.floor(hash(k, 6) * 3), block: (Math.floor((i + 3) / 2) * 4 + Math.floor((j + 3) / 2))});
      }
    return arr;
  }, [hero]);
  // block order for the blackout (spiral-ish), seconds on the audio clock
  const OFF0 = 40.75;
  const offAt = (block: number) => OFF0 + ((block * 7) % 16) * 0.055;
  const darkFrac = clamp01((absT - OFF0) / 0.9);
  const flick = (block: number) => {
    const a = absT - offAt(block);
    return a < 0 ? 1 : a < 0.12 ? (Math.floor(a * 40) % 2 === 0 ? 0 : 1) : 0;
  };
  const faces = (b: typeof blds[0]) => {
    const on = flick(b.block) > 0.5;
    const tx = on ? texOn[b.v] : texOff[b.v];
    return [0.8, 0.55, 1, 1, 1, 0.7].map((k, i) => (
      <meshBasicMaterial key={i} attach={`material-${i}`} map={i === 2 || i === 3 ? null : tx} color={i === 2 ? '#1a2048' : i === 3 ? '#0a0e22' : new THREE.Color(k * bright, k * bright, k * bright * 1.1)} toneMapped={false} />
    ));
  };
  const lampOn = absT < OFF0 + 0.5;
  return (
    <group>
      <Floor w={140} d={140} c="#141a33" />
      {/* streets */}
      {Array.from({length: 8}).map((_, i) => (
        <group key={i}>
          <Plane w={140} h={2.2} p={[0, 0.02, -26 + i * 9 + 4.5 - 10]} rot={[-Math.PI / 2, 0, 0]} c="#262c4a" recv={false} />
          <Plane w={2.2} h={140} p={[-31.5 + i * 9 + 4.5, 0.02, 0]} rot={[-Math.PI / 2, 0, 0]} c="#262c4a" recv={false} />
        </group>
      ))}
      {blds.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          {faces(b)}
        </mesh>
      ))}
      {blds.map((b, i) => (
        <mesh key={'o' + i} position={[b.x, b.h / 2, b.z]} scale={[1 + 0.5 / b.w, 1 + 0.4 / b.h, 1 + 0.5 / b.d]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      ))}
      {/* street lamps */}
      {Array.from({length: 18}).map((_, i) => (
        <Ball key={i} r={0.35} p={[-30 + (i % 6) * 12, 3.2, -8 + Math.floor(i / 6) * 9 - 4]} c={lampOn ? '#ffd27a' : '#2b2f4a'} basic ink={0} />
      ))}
      {hero && (
        <group position={[0, 0, 4]}>
          <HeroBlock absT={absT} />
        </group>
      )}
      <mesh position={[-40, 55, -100]}>
        <circleGeometry args={[6, 24]} />
        <meshBasicMaterial color="#f4f1d8" toneMapped={false} />
      </mesh>
      <Sky top={storm > 0.5 ? '#dfe6ff' : storm > 0 ? '#27336e' : '#0b1030'} bottom={storm > 0.5 ? '#b9c6f5' : storm > 0 ? '#4a5aa6' : '#2b2f6a'} r={220} stars={darkFrac > 0.5 && storm === 0} />
      {storm > 0 && <group position={[0, 0, 0]} />}
      <group visible={false}>{darkFrac > 5 && <mesh />}</group>
    </group>
  );
};

// a tall apartment block for shot 28; dark windows, a few flickering
const HeroBlock: React.FC<{absT: number}> = ({absT}) => {
  const w = 14, h = 30, d = 8;
  const tex = useMemo(
    () =>
      makeTex(512, 1024, (c, tw, th) => {
        c.fillStyle = '#3a3f66';
        c.fillRect(0, 0, tw, th);
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 20; j++) {
            c.fillStyle = '#10143a';
            c.fillRect(14 + i * 62, 18 + j * 49, 44, 34);
            c.fillStyle = 'rgba(120,150,255,0.18)';
            c.fillRect(14 + i * 62, 18 + j * 49, 44, 8);
          }
      }),
    [],
  );
  const lit = useMemo(() => [[2, 5], [5, 9], [3, 14], [6, 3], [1, 11]], []);
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, h / 2, 0]} scale={[1.02, 1.01, 1.04]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {/* a few candle-lit windows that go out */}
      {lit.map(([i, j], k) => {
        const on = hash(k, 3) * 2 + 57.9 > absT && Math.floor(absT * 7 + k) % 5 !== 0;
        return on ? (
          <mesh key={k} position={[-w / 2 + 14 / 512 * w + 22 / 512 * w + i * (62 / 512) * w, h / 2 - (18 + 17 + j * 49) / 1024 * h + h / 2 - 0.05, d / 2 + 0.02]}>
            <planeGeometry args={[44 / 512 * w, 34 / 1024 * h]} />
            <meshBasicMaterial color={new THREE.Color(2.4, 1.7, 0.6)} toneMapped={false} />
          </mesh>
        ) : null;
      })}
    </group>
  );
};

export const Rain: React.FC<{t: number}> = ({t}) => (
  <group>
    {Array.from({length: 140}).map((_, i) => {
      const x = (hash(i, 1) - 0.5) * 40, z = (hash(i, 2) - 0.5) * 30 + 12;
      const y = 14 - (((t * 22 + hash(i, 3) * 20) % 20));
      return (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, 0.18]}>
          <planeGeometry args={[0.03, 0.9]} />
          <meshBasicMaterial color="#cdd8ff" transparent opacity={0.55} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      );
    })}
  </group>
);

export const Bolt: React.FC<{p: V3; on: boolean}> = ({p, on}) =>
  on ? (
    <LiveTex
      w={256}
      h={512}
      size={[10, 20]}
      p={p}
      draw={(c) => {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 10;
        c.lineJoin = 'round';
        c.shadowColor = '#bcd0ff';
        c.shadowBlur = 24;
        c.beginPath();
        let x = 130, y = 0;
        c.moveTo(x, y);
        for (let i = 0; i < 9; i++) { x += (hash(i, 8) - 0.5) * 90; y += 56; c.lineTo(x, y); }
        c.stroke();
      }}
    />
  ) : null;

// ===================================================================== HOSPITAL + FIRE
const FlameCard: React.FC<{p: V3; w: number; h: number; t: number; seed: number}> = ({p, w, h, t, seed}) => (
  <LiveTex
    w={256}
    h={384}
    size={[w, h]}
    p={p}
    draw={(c) => {
      const layers: [string, number][] = [['#e8321c', 1], ['#ff8a1f', 0.74], ['#ffd84a', 0.46]];
      for (const [col, k] of layers) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(24 + (1 - k) * 60, 384);
        const n = 4;
        for (let i = 0; i <= n; i++) {
          const fx = 24 + (1 - k) * 60 + ((208 - (1 - k) * 120) * i) / n;
          const fh = 384 - (150 + 190 * k * (0.55 + 0.45 * Math.sin(t * 9 + i * 1.9 + seed * 3))) * (i % 2 === 0 ? 0.85 : 1.2);
          c.quadraticCurveTo(fx - 20, fh + 90, fx, fh);
        }
        c.lineTo(232 - (1 - k) * 60, 384);
        c.closePath();
        c.fill();
        if (k === 1) { c.strokeStyle = '#3b0f0b'; c.lineWidth = 6; c.stroke(); }
      }
    }}
  />
);

export const FireSet: React.FC<{t: number; hose: boolean}> = ({t, hose}) => {
  const wall = useTex('burn', 256, 512, (c, w, h) => {
    c.fillStyle = '#7a4b3a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a3326'; c.lineWidth = 3;
    for (let y = 0; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
  const flick = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 9);
  return (
    <group>
      <Floor w={60} d={40} c="#4d5568" p={[0, -4]} />
      <Floor w={60} d={9} c="#2f3442" p={[0, 3]} y={0.01} />
      <Box s={[9, 9, 5]} p={[0, 4.5, -4]} c="#ffffff" map={wall} />
      {[-3, 0, 3].map((x) =>
        [2, 4.8, 7.4].map((y) => (
          <group key={x + '' + y}>
            <Box s={[1.1, 1.2, 0.1]} p={[x, y, -1.45]} c={y > 4 ? '#ff9a2a' : '#26304a'} basic={y > 4} ink={0.02} />
          </group>
        )),
      )}
      {[-3, 0, 3].map((x, i) => (
        <FlameCard key={i} p={[x, 5.6 + (i % 2) * 1.4, -1.3]} w={2.4} h={3.4} t={t} seed={i} />
      ))}
      <FlameCard p={[0, 10.2, -3.5]} w={5} h={5} t={t} seed={7} />
      {/* smoke */}
      {Array.from({length: 7}).map((_, i) => {
        const u = ((t * 0.5 + i / 7) % 1);
        return <Ball key={i} r={0.8 + u * 1.6} p={[-1 + hash(i, 1) * 3, 9 + u * 7, -3 + hash(i, 2)]} c={`rgb(${70 - u * 20},${66 - u * 20},${76 - u * 20})`} ink={0} basic />;
      })}
      <pointLight position={[0, 6, 1.5]} color="#ff8a3a" intensity={14 * flick} distance={22} decay={1.5} />
      <Vehicle p={[3.8, 0, 3.6]} kind="fire" t={t} yaw={Math.PI} />
      {/* spray arc */}
      {hose &&
        Array.from({length: 16}).map((_, i) => {
          const u = ((t * 1.6 + i / 16) % 1);
          return <Ball key={i} r={0.1} p={[lerp(2.4, 0.4, u), 2.0 + Math.sin(u * Math.PI) * 2.2, lerp(2.6, -1.0, u)]} c="#bfe9ff" ink={0} basic />;
        })}
      {[-6, 7.5].map((x) => (
        <Cyl key={x} r={0.07} h={3.2} p={[x, 1.6, 1]} c="#555b6a" ink={0.012} seg={8} />
      ))}
      <Sky top="#2a1a3a" bottom="#a8503a" r={160} />
    </group>
  );
};

export const HospitalSet: React.FC<{t: number}> = ({t}) => {
  const glass = useTex('hosp', 128, 128, (c, w, h) => {
    c.fillStyle = '#f2f6f8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c6d0d8'; c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
  });
  void glass;
  return (
    <group>
      <Floor w={60} d={40} c="#5a6275" p={[0, -4]} />
      <Floor w={60} d={7} c="#2b303d" p={[0, 4.5]} y={0.01} />
      <Box s={[14, 8, 6]} p={[0, 4, -6]} c="#eef3f6" />
      {[-5, -2.5, 0, 2.5, 5].map((x) =>
        [2.5, 5, 7].map((y) => (
          <Box key={x + '' + y} s={[1.2, 1.1, 0.08]} p={[x, y, -2.96]} c="#ffe9a8" basic ink={0.015} />
        )),
      )}
      {/* entrance canopy */}
      <Box s={[4.2, 0.2, 2]} p={[0, 3.0, -2.2]} c="#e5484d" />
      <Box s={[2.6, 2.6, 0.08]} p={[0, 1.3, -2.95]} c="#bfe6f7" basic ink={0.02} />
      {/* red cross sign on the roof */}
      <Box s={[3.2, 3.2, 0.3]} p={[0, 10, -6]} c="#ffffff" />
      <Box s={[2.2, 0.7, 0.34]} p={[0, 10, -5.82]} c="#e5333c" basic ink={0} />
      <Box s={[0.7, 2.2, 0.34]} p={[0, 10, -5.82]} c="#e5333c" basic ink={0} />
      {/* two ambulances rushing in, and one parked */}
      <Vehicle p={[lerp(-16, -3.5, smooth(t / 1.1)), 0, 3.2]} kind="ambulance" t={t} />
      <Vehicle p={[lerp(-24, -8.5, smooth((t - 0.2) / 1.25)), 0, 5.4]} kind="ambulance" t={t + 0.1} />
      <Vehicle p={[6.5, 0, 1.6]} kind="ambulance" t={t} yaw={Math.PI} lightsOn />
      {[-10, 9, 12].map((x) => (
        <Cyl key={x} r={0.08} h={3.4} p={[x, 1.7, 0.4]} c="#555b6a" ink={0.012} seg={8} />
      ))}
      <Sky top="#14193a" bottom="#5a4a8a" r={160} />
    </group>
  );
};
