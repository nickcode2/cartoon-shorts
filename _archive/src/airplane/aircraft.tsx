// Aircraft exterior (Comet 4-engine jet with swept wings, engines buried in the wing roots; or the modern small-window liner), the
// breaking-apart sequence, the sky set, and the pressure-test fuselage section used in the hangar and the cutaway stage.
// Research notes: src/airplane/NOTES.md. All geometry is made inside components (disposed with the shot), animation drives props only.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {LiveTex, Sky, V3, makeTex, clamp01, lerp} from '../kit/kit';
import {Glow, PAINTED_SURFACES, PAL} from '../kit/finish';
import {B, Ball, Clouds, Cy, HDR_GOLD, HDR_WARM, Mat, PS, ringGeometry, slabGeometry} from './parts';

const ease = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- skin texture (u around, v along the axis; u = 0 faces +z, increasing toward +y)
const skinTexture = (key: string, win: {n: number; w: number; h: number; r: number} | null, rivets = true) =>
  makeTex(1024, 512, (c, W, H) => {
    c.fillStyle = PAL.lavender.base; c.fillRect(0, 0, W, H);
    // painted brush streaks
    let s = 7;
    const rnd = () => ((s = (s * 49297 + 233280) % 233280) / 233280);
    for (let i = 0; PAINTED_SURFACES && i < 260; i++) {
      c.strokeStyle = (rnd() > 0.5 ? '#ffffff' : '#8f90e0') + '26'; c.lineWidth = 6 + rnd() * 14; c.lineCap = 'round';
      const x = rnd() * W, y = rnd() * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60 + rnd() * 160, y + (rnd() - 0.5) * 12); c.stroke();
    }
    // lower half shaded lilac, cheat line stripe in dusty rose just under the windows
    const g = c.createLinearGradient(0, H * 0.12, 0, H * 0.7);
    c.fillStyle = PAL.lilac.base + '00';
    // u runs along x here: shade band 0.18..0.46 (underside) in lilac, stripe 0.93..0.99 rose
    const gx = c.createLinearGradient(W * 0.1, 0, W * 0.5, 0); gx.addColorStop(0, 'rgba(187,168,227,0)'); gx.addColorStop(1, 'rgba(106,108,192,0.55)');
    c.fillStyle = gx; c.fillRect(W * 0.1, 0, W * 0.4, H);
    c.fillStyle = PAL.rose.base; c.fillRect(W * 0.93, 0, W * 0.05, H);
    void g;
    // panel seams and rivets
    c.strokeStyle = 'rgba(53,42,87,0.35)'; c.lineWidth = 3;
    for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(0, (H / 8) * i); c.lineTo(W, (H / 8) * i); c.stroke(); }
    if (rivets) {
      c.fillStyle = 'rgba(53,42,87,0.45)';
      for (let i = 1; i < 8; i++) for (let x = 6; x < W; x += 18) { c.beginPath(); c.arc(x, (H / 8) * i - 8, 2.2, 0, 7); c.fill(); c.beginPath(); c.arc(x, (H / 8) * i + 8, 2.2, 0, 7); c.fill(); }
    }
    if (win) {
      // windows on both sides (u about 0.05 = +z side, u about 0.45 = -z side)
      for (const ux of [0.05, 0.45]) for (let i = 0; i < win.n; i++) {
        const cx = ux * W, cy = ((i + 0.5) / win.n) * H;
        c.fillStyle = '#2a2f66'; c.strokeStyle = '#ffffff'; c.lineWidth = 4;
        c.beginPath(); c.roundRect(cx - win.w / 2, cy - win.h / 2, win.w, win.h, win.r); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,233,168,0.55)'; c.beginPath(); c.roundRect(cx - win.w / 2 + 4, cy - win.h / 2 + 4, win.w - 8, win.h * 0.4, win.r); c.fill();
      }
    }
  }, [1, 1]);
void skinTexture;

// Airliner exterior --------------------------------------------------------------------------
const wingShape = (sign: 1 | -1) => {
  const s = new THREE.Shape();
  s.moveTo(0.9, 0.4 * sign); s.lineTo(-1.1, 3.7 * sign); s.lineTo(-1.7, 3.7 * sign); s.lineTo(-1.2, 0.4 * sign); s.closePath();
  return s;
};
const finShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-3.0, 0.4); s.lineTo(-4.3, 0.4); s.lineTo(-4.2, 1.6); s.lineTo(-3.8, 1.6); s.closePath();
  return s;
};
const stabShape = (sign: 1 | -1) => {
  const s = new THREE.Shape();
  s.moveTo(-3.9, 0.15 * sign); s.lineTo(-4.5, 1.25 * sign); s.lineTo(-4.75, 1.25 * sign); s.lineTo(-4.5, 0.15 * sign); s.closePath();
  return s;
};

export const Aircraft: React.FC<{modern?: boolean; breakT?: number; seed?: number}> = ({modern, breakT = 0, seed = 0}) => {
  const skin = useMemo(() => skinTexture('ac' + (modern ? 'm' : 'c'), modern ? {n: 14, w: 46, h: 34, r: 14} : {n: 9, w: 74, h: 62, r: 6}), [modern]);
  const wingG = useMemo(() => [1, -1].map((sg) => new THREE.ExtrudeGeometry(wingShape(sg as 1 | -1), {depth: 0.11, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2})), []);
  const finG = useMemo(() => new THREE.ExtrudeGeometry(finShape(), {depth: 0.07, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1}), []);
  const stabG = useMemo(() => [1, -1].map((sg) => new THREE.ExtrudeGeometry(stabShape(sg as 1 | -1), {depth: 0.05, bevelEnabled: false})), []);
  const e = ease((breakT - 0.1) / 0.9), e2 = ease((breakT - 0.45) / 0.55);
  const ptx = -2.5; // break station
  // the tail assembly tears off and tumbles away; the rear fuselage keeps a ragged edge (dark disc)
  const tail: V3 = [-1.8 * e, -1.1 * e * e - 0.1 * e, 0.5 * e];
  const body = (
    <>
      {/* fuselage tube + nose + tail cone */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 5.0, 40, 1, true]} />
        <meshStandardMaterial map={skin} roughness={0.6} side={THREE.DoubleSide} defines={PS} />
      </mesh>
      <Ball r={0.5} p={[2.5, 0, 0]} s={[1.7, 0.95, 0.95]} c={PAL.lavender.base} rough={0.5} cast />
      <B s={[0.5, 0.08, 0.5]} p={[3.0, 0.2, 0]} rot={[0, 0, -0.2]} c="#2a2f66" m={0.3} cast={false} />
      {/* wings with the four root engines */}
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh geometry={wingG[i]} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} castShadow receiveShadow><Mat c={PAL.blueViolet.base} r={0.55} /></mesh>
          {[0.85, 1.35].map((z, k) => {
            const sg = i === 0 ? 1 : -1, xle = 0.9 - (z - 0.4) * 0.57;
            return (
              <group key={k} position={[xle - 0.1, -0.2, sg * z]}>
                <Cy r0={0.17} h={1.3} p={[0, 0, 0]} rot={[0, 0, Math.PI / 2]} c={PAL.lilac.base} m={0.3} rough={0.4} />
                <Cy r0={0.12} h={0.06} p={[0.62, 0, 0]} rot={[0, 0, Math.PI / 2]} c="#1E1448" />
              </group>
            );
          })}
        </group>
      ))}
    </>
  );
  return (
    <group rotation={[0.35 * e * (seed % 2 ? -1 : 1) * 0, 0, -0.5 * e2]} position={[0, -1.0 * e * e, 0]}>
      {body}
      {/* tail assembly (detaches) */}
      <group position={tail} rotation={[0.9 * e, 0.3 * e, -0.7 * e]}>
        <Cy r0={0.5} r1={0.12} h={1.8} p={[-3.4, 0, 0]} rot={[0, 0, Math.PI / 2]} c={PAL.lavender.base} rough={0.6} />
        <mesh geometry={finG} position={[0, 0, -0.035]} castShadow><Mat c={PAL.rose.base} r={0.55} /></mesh>
        {[0, 1].map((i) => (
          <mesh key={i} geometry={stabG[i]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} castShadow><Mat c={PAL.blueViolet.base} r={0.55} /></mesh>
        ))}
      </group>
      {/* tear: ragged dark ring at the break station + fireball + smoke + debris, all driven by breakT */}
      {breakT > 0.02 && (
        <group position={[ptx, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[0.02, 0, 0]}><circleGeometry args={[0.5, 24]} /><meshStandardMaterial color="#1E1448" roughness={1} side={THREE.DoubleSide} /></mesh>
          <Ball r={0.35 + 0.5 * e} p={[0, 0, 0]} c="#ffb04d" e={new THREE.Color(3.2, 1.9, 0.7)} o={Math.max(0, 0.9 - e * 0.5)} />
          <Glow p={[0, 0, 0.1]} size={1.5 + 3 * e} color={PAL.rim} intensity={0.8 * (1 - 0.4 * e)} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Ball key={'s' + i} r={0.22 + 0.06 * i} p={[-0.5 - i * 0.55 * (0.3 + e), 0.05 * i - 0.1 * e * i, 0.1 * Math.sin(i * 2.1)]} c="#5b4a8a" rough={1} o={Math.max(0, 0.7 - 0.08 * i) * Math.min(1, breakT * 4)} />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = i * 2.3 + seed;
            return <B key={'d' + i} s={[0.16, 0.05, 0.12]} p={[-0.3 * i * e - 0.4 * e, -0.6 * e * e * (1 + 0.3 * i) + 0.3 * Math.sin(a) * e, 0.9 * Math.cos(a) * e]} rot={[a * e * 2, a, e * 3]} c={i % 2 ? PAL.lavender.base : PAL.rose.base} cast={false} />;
          })}
        </group>
      )}
    </group>
  );
};

/** The sky set: gradient dome (golden horizon, coral, rose, violet), key sun, clouds. The aircraft group is passed as children. */
export const SkySet: React.FC<{children?: React.ReactNode; low?: boolean}> = ({children}) => (
  <group>
    <hemisphereLight args={['#C7CBFF', '#6A6CC0', 1.05]} />
    <directionalLight color="#ffd9a0" intensity={2.6} position={[-6, 7, 6]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.0004} shadow-normalBias={0.02} />
    <pointLight position={[4, -2, -4]} color={PAL.rim} intensity={6} distance={14} decay={2} />
    <Sky top="#5A4FDB" bottom="#F58A6B" r={160} />
    <Clouds items={[[-9, -3.4, -6, 2.4], [8, -4.2, -9, 3], [-2, -5.2, 4, 2.6], [12, -2.8, 2, 2.2], [-14, -2.6, 8, 2.6], [3, -6.0, -3, 3.2], [-6, 4.2, -16, 3.6], [9, 3.4, -14, 3]]} />
    {children}
  </group>
);

// Pressure-test fuselage section -------------------------------------------------------------
export const FUSE = {r: 0.9, len: 5.0, wins: [-1.6, -0.8, 0, 0.8, 1.6], winW: 0.34, winH: 0.3, winDy: 0.28};
const fuseSkin = () =>
  makeTex(1024, 512, (c, W, H) => {
    c.fillStyle = PAL.lavender.base; c.fillRect(0, 0, W, H);
    let s = 11;
    const rnd = () => ((s = (s * 49297 + 233280) % 233280) / 233280);
    for (let i = 0; PAINTED_SURFACES && i < 300; i++) {
      c.strokeStyle = (rnd() > 0.5 ? '#ffffff' : '#8f90e0') + '28'; c.lineWidth = 6 + rnd() * 14; c.lineCap = 'round';
      const x = rnd() * W, y = rnd() * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 12, y + 60 + rnd() * 140); c.stroke();
    }
    const gx = c.createLinearGradient(W * 0.15, 0, W * 0.5, 0); gx.addColorStop(0, 'rgba(187,168,227,0)'); gx.addColorStop(1, 'rgba(106,108,192,0.6)');
    c.fillStyle = gx; c.fillRect(W * 0.15, 0, W * 0.35, H);
    c.fillStyle = PAL.rose.base; c.fillRect(W * 0.935, 0, W * 0.04, H);
    c.strokeStyle = 'rgba(53,42,87,0.4)'; c.lineWidth = 3;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, (H / 6) * i); c.lineTo(W, (H / 6) * i); c.stroke(); }
    c.fillStyle = 'rgba(53,42,87,0.5)';
    for (let i = 1; i < 6; i++) for (let x = 5; x < W; x += 16) { c.beginPath(); c.arc(x, (H / 6) * i - 7, 2.2, 0, 7); c.fill(); c.beginPath(); c.arc(x, (H / 6) * i + 7, 2.2, 0, 7); c.fill(); }
  });

/** Fuselage section for the pressure test. swell 0..1 inflates it like a balloon (windows glow, skin flushes rose); crack 0..1 grows a crack
 *  from the top-left corner of the middle window; cut = translucent skin for the cutaway stage. */
export const Fuselage: React.FC<{swell?: number; crack?: number; cut?: boolean; dim?: number}> = ({swell = 0, crack = 0, cut, dim = 0}) => {
  const {r, len, wins, winW, winH, winDy} = FUSE;
  const skin = useMemo(() => fuseSkin(), []);
  const ring = useMemo(() => ringGeometry(winW, winH, 0.02, 0.05, 0.07), [winW, winH]);
  const glass = useMemo(() => slabGeometry(winW + 0.02, winH + 0.02, 0.02, 0.01), [winW, winH]);
  const hose = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(len / 2, 0.1, 0), new THREE.Vector3(len / 2 + 0.7, 0.2, 0.1), new THREE.Vector3(len / 2 + 1.0, 1.2, 0.3), new THREE.Vector3(len / 2 + 0.7, 2.4, 0.2)]), 24, 0.045, 8), [len]);
  const th = Math.asin(winDy / r), zw = r * Math.cos(th), yw = r * Math.sin(th);
  const sc: V3 = [1 + 0.02 * swell, 1 + 0.075 * swell, 1 + 0.075 * swell];
  // dim 0..1: submerged hull gets a a slightly cooler skin against the now dark tank interior; the rim lights outline it
  const heat = new THREE.Color().setRGB((1.0 + 0.5 * swell) * (1 - 0.2 * dim), (1.0 - 0.38 * swell) * (1 - 0.18 * dim), (1.0 - 0.3 * swell));
  return (
    <group scale={sc}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 56, 1, true]} />
        <meshStandardMaterial map={skin} roughness={0.55} metalness={0.1} side={THREE.DoubleSide} color={heat} emissive="#8f90e0" emissiveIntensity={0.4 - 0.26 * dim} defines={PS} transparent={!!cut} opacity={cut ? 0.28 : 1} depthWrite={!cut} />
      </mesh>
      {[-1, 1].map((sg) => (
        <mesh key={sg} position={[sg * (len / 2), 0, 0]} rotation={[0, sg * Math.PI / 2, 0]} castShadow>
          <circleGeometry args={[r, 40]} />
          <meshStandardMaterial color={PAL.lilac.base} roughness={0.6} side={THREE.DoubleSide} transparent={!!cut} opacity={cut ? 0.35 : 1} />
        </mesh>
      ))}
      {[-1, 1].map((sg) => <Cy key={'rim' + sg} r0={r + 0.02} h={0.06} p={[sg * (len / 2 - 0.03), 0, 0]} rot={[0, 0, Math.PI / 2]} c={PAL.indigo.base} rough={0.5} m={0.3} open />)}
      <mesh geometry={hose} castShadow><Mat c={PAL.rose.vivid} r={0.5} /></mesh>
      {wins.map((x, i) => (
        <group key={i} position={[x, yw, zw]} rotation={[-th, 0, 0]}>
          <mesh geometry={ring} position={[0, 0, -0.01]} castShadow receiveShadow><Mat c="#e9e6f5" r={0.3} m={0.6} /></mesh>
          <mesh geometry={glass} position={[0, 0, 0.0]}><meshStandardMaterial color="#2a2f66" emissive={HDR_WARM} emissiveIntensity={0.55 + 1.6 * swell} roughness={0.2} transparent opacity={cut ? 0.7 : 0.92} /></mesh>
          {swell > 0.05 && <Glow p={[0, 0, 0.18]} size={0.8} color={PAL.rim} intensity={0.55 * swell} />}
          {i === 2 && !cut && (
            <LiveTex w={512} h={512} size={[1.0, 1.0]} p={[0, 0, 0.115]} draw={(c) => drawCrack(c, crack)} />
          )}
        </group>
      ))}
    </group>
  );
};

// crack decal: canvas 512 px = 1.0 m on the skin (512 px/m); the window is 0.34 x 0.30 m, centred. Origin at its top-left corner.
const CRACK: [number, number][] = [[0, 0], [-9, -7], [-14, -19], [-27, -24], [-33, -38], [-47, -42], [-53, -56], [-70, -61], [-76, -75], [-92, -80]];
const BRANCH: [number, number][] = [[-27, -24], [-40, -20], [-50, -28], [-66, -27]];
function drawCrack(c: CanvasRenderingContext2D, p: number) {
  if (p <= 0.001) return;
  const ox = 256 - 0.17 * 512, oy = 256 - 0.15 * 512;
  const line = (pts: [number, number][], from: number, to: number) => {
    const n = pts.length - 1;
    const f0 = clamp01(from) * n, f1 = clamp01(to) * n;
    if (f1 <= f0) return;
    const at = (f: number): [number, number] => { const i = Math.min(n - 1, Math.floor(f)), k = f - i; return [lerp(pts[i][0], pts[i + 1][0], k) + ox, lerp(pts[i][1], pts[i + 1][1], k) + oy]; };
    c.beginPath();
    let [x, y] = at(f0); c.moveTo(x, y);
    for (let f = Math.ceil(f0 + 1e-6); f < f1; f++) { [x, y] = at(f); c.lineTo(x, y); }
    [x, y] = at(f1); c.lineTo(x, y);
    c.stroke();
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[34, 'rgba(243,122,146,0.35)'], [17, '#1E1448'], [6, '#ffffff']] as const) {
    c.strokeStyle = col; c.lineWidth = w;
    line(CRACK, 0, p);
    line(BRANCH, 0, clamp01((p - 0.35) / 0.5));
  }
}
