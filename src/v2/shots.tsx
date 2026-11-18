// The 33 shots of CrisisShortV2: same timing table and shot order as CrisisShort, new look.
import React from 'react';
import * as THREE from 'three';
import {Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {LiveTex, Pose, ShotSpec, V3, clamp01, lerp, move, smooth} from '../kit/kit';
import {PopLabel} from '../kit/PopLabel';
import {Cast, CastPose, Mood} from './cast';
import {Aisle, AisleDisplays, BeltItems, Cart, Checkout} from './market';
import {Vehicle2, StreetEnv, Win} from './street';
import {Desk, Home, Kitchen} from './rooms';
import {MapRoom, SwedenStreet} from './world';
import {CityNight, FireSet, HospitalSet, Rain, Bolt, OFF0} from './city';
import {STARTS, TOTAL} from '../short/data';

const FPS = 30;
const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const pulse = (t: number, a: number, b: number) => (t > a && t < b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
const m = (p: V3, l: V3, fov = 50, roll = 0): Pose => ({p, l, fov, roll});
const v = (p: V3) => new THREE.Vector3(...p);

const RealPost: React.FC<{pose: Pose; focus: THREE.Vector3; range: number; bokeh: number}> = ({pose, focus, range, bokeh}) => (
  <EffectComposer multisampling={4}>
    <Bloom intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.8} />
    <DepthOfField worldFocusDistance={new THREE.Vector3(...pose.p).distanceTo(focus)} worldFocusRange={range} bokehScale={bokeh} />
    <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    <Vignette offset={0.32} darkness={0.4} />
  </EffectComposer>
);

// location changes get a quick dip (shots that start in a new place)
const DIP_SHOTS = new Set([4, 9, 11, 13, 14, 15, 16, 18, 19, 21, 22, 23, 25, 28, 29, 31, 33]);

type Def = {
  cam: ReturnType<typeof move>;
  focus: V3;
  range?: number;
  bokeh?: number;
  render: (t: number, u: number, a: number, cam: ReturnType<typeof move>) => React.ReactNode;
};

const P = (who: CastPose['who'], a: number, o: Partial<CastPose> = {}): CastPose => ({who, t: a, ...o});
const label = (text: string, cam: ReturnType<typeof move>, t: number, u: number, focus: V3, start: number, hold?: number, cy = 330) => (
  <PopLabel text={text} pose={cam(u, t)} f={Math.round(t * FPS)} start={start} ready focus={v(focus)} hold={hold} cy={cy} />
);
// hands on hips / belly (laughing)
const HIPS: Pick<CastPose, 'hL' | 'hR'> = {hL: [236, 600], hR: [364, 600]};

export function buildShots(speak: number): ShotSpec[] {
  const D: Record<number, Def> = {};

  // ============================================================ SUPERMARKET
  D[1] = {
    cam: move(m([0.3, 1.0, 3.9], [0, 0.95, -1.0]), m([0.1, 1.0, 3.3], [0, 0.95, -0.4]), (x) => x),
    focus: [0, 0.9, -1.0], range: 5, bokeh: 1.6,
    render: (t, _u, a) => (
      <>
        <Aisle t={a} ready extras={false} />
        <AisleDisplays ready jugsLeft={12} cansLeft={10} />
        <Cast pose={P('man', a, {mood: 'calm', walk: 1})} p={[0, 0, lerp(-3.6, -0.3, smooth(t / 2.4))]} />
      </>
    ),
  };
  D[2] = {
    cam: move(m([-0.6, 0.7, 1.3], [-0.2, 0.95, -2.5], 52), m([0.5, 0.8, 1.1], [0.2, 0.95, -2.5], 52)),
    focus: [0, 0.9, -2.4], range: 2.6,
    render: (t, _u, a) => {
      const mx = lerp(-0.7, 0.7, ramp(t, 0.8, 1.5));
      const g1 = ramp(t, 0.3, 0.75), g1b = ramp(t, 0.75, 1.0), g2 = ramp(t, 1.15, 1.6), g2b = ramp(t, 1.6, 1.9);
      const jugs = t > 1.0 ? 4 : 0, cans = t > 1.9 ? 8 : 0;
      const hL: [number, number] | null = t > 0.3 && t < 1.05 ? [lerp(lerp(210, 150, g1), 290, g1b), lerp(lerp(656, 690, g1), 560, g1b)] : null;
      const hR: [number, number] | null = t > 1.15 && t < 1.95 ? [lerp(lerp(390, 450, g2), 320, g2b), lerp(lerp(656, 680, g2), 560, g2b)] : null;
      return (
        <>
          <Aisle t={a} ready extras={false} />
          <AisleDisplays ready jugsLeft={12 - jugs} cansLeft={10 - Math.min(cans, 8)} />
          <Cart p={[0, 0, -3.25]} yaw={Math.PI / 2 + 0.2} jugs={jugs} cans={cans} />
          <Cast pose={P('man', a, {mood: 'calm', walk: ramp(t, 0.8, 1.5) > 0.05 && ramp(t, 0.8, 1.5) < 0.95 ? 1 : 0, hL, hR, propL: t > 0.5 && t < 1.0 ? 'jug' : 'none', propR: t > 1.35 && t < 1.9 ? 'can' : 'none'})} p={[mx, 0, -2.5]} />
        </>
      );
    },
  };
  D[3] = {
    cam: move(m([0.9, 2.0, 4.8], [-0.5, 0.9, 0.5], 52), m([0.5, 1.8, 4.2], [-0.5, 0.95, 0.5], 52)),
    focus: [-0.4, 0.9, 0.5], range: 3,
    render: (t, _u, a) => {
      const scan = [0.05, 0.5, 0.95, 1.4].some((t0) => { const x = -1.2 + (t - t0) * 1.5; return t > t0 && Math.abs(x - 0.55) < 0.14; });
      const k = pulse(t, 0.0, 0.45) + pulse(t, 0.45, 0.9) + pulse(t, 0.9, 1.35) + pulse(t, 1.35, 1.8);
      return (
        <>
          <Checkout t={a} beep={scan ? 1 : 0} belt={t} ready />
          <BeltItems t={t} />
          <Cart p={[-2.3, 0, 1.0]} yaw={Math.PI / 2} jugs={0} cans={0} extra={0} />
          <Cast pose={P('man', a, {mood: 'calm', hL: [lerp(215, 130, k), lerp(640, 520, k)]})} p={[-0.85, 0, 0.95]} />
        </>
      );
    },
  };

  // ============================================================ STREET (day): man, neighbor, booklet
  const street = (children: React.ReactNode) => (<><StreetEnv mode="day" />{children}</>);
  D[4] = {
    cam: move(m([1.9, 0.6, 6.6], [0.0, 1.0, 2.2]), m([1.1, 0.7, 5.7], [0.0, 1.0, 2.2])),
    focus: [0, 0.9, 2.2], range: 3.2,
    render: (t, _u, a) => street(
      <>
        <Cast pose={P('man', a, {mood: 'smile', propR: 'bag', hR: [430, 600]})} p={[-0.85, 0, 2.2]} />
        <Cast pose={P('neighbor', a, {mood: t < 1.3 ? 'laugh' : 'smirk', turn: -0.5, ...HIPS})} p={[0.9, 0, 2.2]} />
      </>,
    ),
  };
  D[5] = {
    cam: move(m([-2.0, 1.1, 6.1], [0, 0.95, 2.2]), m([0.9, 1.1, 5.6], [0, 0.95, 2.2])),
    focus: [0.5, 0.9, 2.2], range: 3.2,
    render: (t, _u, a) => street(
      <>
        <Cast pose={P('man', a, {mood: 'calm', propR: 'bag', hR: [430, 600]})} p={[-0.85, 0, 2.2]} />
        <Cast pose={P('neighbor', a, {mood: t < 1.35 ? 'smirk' : 'shock', turn: -0.5, speak, hL: [200, 560], hR: [440, 560]})} p={[0.9, 0, 2.2]} />
      </>,
    ),
  };
  D[6] = {
    cam: move(m([-0.3, 1.1, 6.4], [0, 0.95, 2.2], 48), m([0.1, 1.1, 5.7], [0, 0.95, 2.2], 48)),
    focus: [0, 0.9, 2.2], range: 3,
    render: (t, _u, a) => {
      const ext = ramp(t, 0.1, 0.8), given = t > 0.95;
      return street(
        <>
          <Cast pose={P('man', a, {mood: 'calm', hR: [lerp(390, 520, ext), lerp(656, 570, ext)], propR: given ? 'none' : 'booklet'})} p={[-0.6, 0, 2.2]} />
          <Cast pose={P('neighbor', a, {mood: 'smirk', turn: -0.4, hL: [lerp(210, 80, ext), lerp(656, 570, ext)], propL: given ? 'booklet' : 'none'})} p={[0.6, 0, 2.2]} />
        </>,
      );
    },
  };
  D[7] = {
    cam: move(m([0.5, 1.2, 4.6], [0.5, 1.05, 2.3]), m([0.5, 1.2, 3.7], [0.5, 1.1, 2.3], 48, -2)),
    focus: [0.5, 1.0, 2.3], range: 2,
    render: (t, _u, a) => street(
      <>
        <Cast pose={P('neighbor', a, {mood: t < 0.9 ? 'smirk' : 'shock', turn: 0, hL: [235, 520], hR: [365, 520]})} p={[0.5, 0, 2.2]} />
        <BookletPlane p={[0.5, 0.98, 2.33]} />
        <Cast pose={P('man', a, {mood: 'smile'})} p={[-0.85, 0, 2.3]} />
      </>,
    ),
  };
  D[8] = {
    cam: move(m([-0.6, 1.0, 5.4], [-0.6, 0.95, 2.2]), m([-0.6, 1.35, 6.5], [-0.6, 1.0, 2.2])),
    focus: [-0.6, 0.9, 2.2], range: 3,
    render: (t, _u, a) => street(
      <Cast pose={P('man', a, {mood: t < 0.9 ? 'calm' : 'smile', hoodUp: true, turn: 0.3})} p={[-0.6, 0, 2.2]} />,
    ),
  };

  // ============================================================ MAP
  const mapShot = (cam: ReturnType<typeof move>, dotR: number, extra?: (t: number, u: number, a: number) => React.ReactNode): Def => ({
    cam, focus: [0.5, 0, 0.2], range: 7, bokeh: 1.8,
    render: (t, u, a) => (<><MapRoom t={t} absT={a} dotR={dotR} />{extra?.(t, u, a)}</>),
  });
  D[9] = mapShot(move(m([-3.4, 6.2, 7.8], [0.4, 0, 0.4], 56), m([-1.8, 5.0, 5.2], [0.6, 0, 0.2], 54, -2)), 0.075);
  D[10] = mapShot(move(m([3.6, 3.4, 3.8], [0.6, 0, 0.0], 58, 3), m([0.6, 2.8, 3.0], [0.8, 0, -0.2], 56, -2)), 0.075);
  const c16 = move(m([-2.8, 3.0, 3.6], [-0.7, 0, 0.2], 58, 2), m([-1.4, 1.8, 2.0], [-0.7, 0, 0.25], 54, -2));
  D[16] = mapShot(c16, 0.06, (t, u) => label('UK', c16, t, u, [-0.7, 0, 0.2], 31, 34));
  const c17 = move(m([8.2, 3.2, 4.6], [9, 0, 0.3], 58), m([-0.6, 17, 20], [-0.6, 0, 0], 78));
  D[17] = mapShot(c17, 0.09, (t, u) => (
    <>
      {label('JAPAN', c17, t, u, [9, 0, 0.3], 1, 24)}
      {label('CANADA', c17, t, u, [9, 0, 0.3], 30, 40)}
    </>
  ));

  // ============================================================ HOME / BACKPACK
  const flyItems = (t: number) => ['bottle', 'can', 'torch', 'radio', 'cash', 'blanket'].map((kind, i) => ({kind, u: (t - [0.3, 0.7, 1.1, 1.5, 1.9, 2.2][i]) / 0.5}));
  D[11] = {
    cam: move(m([0.9, 2.5, 3.8], [-1.4, 0.7, -0.3], 55), m([0.3, 2.2, 3.1], [-1.4, 0.7, -0.3], 54)),
    focus: [-1.5, 0.6, -0.2], range: 3.4,
    render: (t, _u, a) => (
      <>
        <Home t={a} zip={0.5} items={flyItems(t)} packOpen={1} lift={0} />
        <Cast pose={P('man', a, {mood: 'calm', hR: [lerp(450, 560, Math.abs(Math.sin(t * 5))), 520]})} p={[-1.6, 0, -0.1]} />
      </>
    ),
  };
  D[12] = {
    cam: move(m([0.5, 0.6, 1.9], [-0.85, 0.85, -0.9], 52), m([0.1, 0.75, 1.3], [-0.85, 0.9, -0.9], 50, 3)),
    focus: [-0.85, 0.8, -0.9], range: 2.4,
    render: (t, _u, a) => {
      const zip = ramp(t, 1.5, 1.95), open = 1 - ramp(t, 1.25, 1.55);
      const lift = t > 1.95 ? 0.05 * Math.sin(clamp01((t - 1.95) / 0.3) * Math.PI) : 0;
      return (
        <>
          <Home t={a} zip={zip} items={[]} packOpen={open} lift={lift} />
          <Cast pose={P('man', a, {mood: t > 1.9 ? 'smile' : 'serious', hL: [250, 600], hR: [345, 600]})} p={[-0.85, 0, -1.25]} />
        </>
      );
    },
  };
  const c15: ReturnType<typeof move> = (u, t) => {
    const e = smooth(u / 0.65);
    return {p: [lerp(0.2, 1.6, e), lerp(0.45, 1.5, e), lerp(1.9, 1.7, e)] as V3, l: [lerp(0.9, 1.7, e), lerp(0.45, 1.3, e), lerp(-2.0, -2.8, e)] as V3, fov: lerp(56, 48, e), roll: lerp(0, -1, e)};
  };
  void c15;
  D[15] = {
    cam: c15,
    focus: [1.0, 0.4, -2.2], range: 2.4,
    render: (t, u) => (
      <>
        <Home t={t} zip={1} items={[]} packOpen={0} lift={0} pack={[1.0, 0, -2.25]} showItems={false} />
        {label('FRANCE', c15, t, u, [1.0, 0.4, -2.2], 23, 38)}
      </>
    ),
  };

  // ============================================================ MAILBOXES + BOOKLET
  const c13 = move(m([-6.6, 0.9, 6.2], [-4.2, 1.2, 2.9], 58), m([2.8, 1.0, 5.4], [4.8, 1.2, 2.9], 58, 2));
  D[13] = {
    cam: c13, focus: [-1, 1, 2.9], range: 9, bokeh: 1.2,
    render: (t, u) => (<><SwedenStreet t={t} />{label('SWEDEN', c13, t, u, [-1, 1, 2.9], 0, 40)}</>),
  };
  D[14] = {
    cam: move(m([0.2, 1.7, 2.7], [0, 0.55, 0.15], 52), m([0.05, 1.2, 1.9], [0, 0.55, 0.15], 50, -3)),
    focus: [0, 0.5, 0.2], range: 1.6, bokeh: 3,
    render: (t) => <Desk t={t} />,
  };

  // ============================================================ KITCHEN (man)
  const kit = (n: number, cam: ReturnType<typeof move>, focus: V3, render: (t: number, u: number, a: number) => React.ReactNode, range = 2.8): void => {
    D[n] = {cam, focus, range, render};
  };
  const c18 = move(m([1.3, 1.2, 2.9], [-1.1, 1.0, -0.9]), m([0.6, 1.2, 2.5], [-1.1, 1.0, -0.9]));
  kit(18, c18, [-1.1, 0.9, -0.9], (t, u, a) => (
    <>
      <Kitchen t={a} variant="man" lamp={1} clock />
      <Cast pose={P('man', a, {mood: 'worry', turn: -0.6, hR: [345, 305], hL: [250, 640]})} p={[-1.1, 0, -0.9]} />
      {label('72 HOURS', c18, t, u, [-1.1, 0.9, -0.9], 11, 45)}
    </>
  ));
  const lampOn25 = (t: number) => t < 1.5 && !(t > 1.0 && Math.floor(t * 14) % 2 === 0);
  kit(25, move(m([-1.8, 1.2, 3.5], [0.1, 0.95, -0.3]), m([1.8, 1.2, 3.6], [0.1, 0.95, -0.3])), [0.1, 0.9, -0.3], (t, _u, a) => {
    const on = lampOn25(t);
    return (
      <>
        <Kitchen t={a} variant="man" lamp={on ? 1 : 0} phoneGlow={1} sky={0.45} />
        <Cast pose={P('man', a, {mood: on ? 'calm' : 'worry', propR: 'phone', hR: [440, 540], glow: 1, look: 0.4})} p={[0.1, 0, -0.3]} />
      </>
    );
  });
  kit(26, move(m([2.0, 1.95, 1.0], [2.0, 0.86, 0.7], 50), m([2.0, 1.4, 0.9], [2.0, 0.86, 0.7], 48, -4)), [2.0, 0.86, 0.7], (t, _u, a) => {
    const glow = t < 1.2 ? (t > 0.9 && Math.floor(t * 18) % 2 === 0 ? 0 : 1) : 0;
    return (
      <>
        <Kitchen t={a} variant="man" lamp={0} phoneGlow={glow} sky={0.45} />
        <group position={[2.0, 0.862, 0.7]} rotation={[0, 0.3, 0]}>
          <mesh position={[0, 0.005, 0]} castShadow><boxGeometry args={[0.078, 0.01, 0.16]} /><meshStandardMaterial color="#262b38" roughness={0.4} metalness={0.5} /></mesh>
          {glow > 0 ? (
            <LiveTex w={128} h={256} size={[0.068, 0.145]} p={[0, 0.0115, 0]} rot={[-Math.PI / 2, 0, 0]} draw={(c) => {
              c.fillStyle = '#0d2a3a'; c.fillRect(0, 0, 128, 256);
              for (let i = 0; i < 4; i++) { c.fillStyle = i < 1 ? '#bfefff' : '#3a5666'; c.fillRect(30 + i * 20, 130 - i * 14, 12, 30 + i * 14); }
              c.strokeStyle = '#ff5a5a'; c.lineWidth = 8; c.beginPath(); c.moveTo(20, 60); c.lineTo(108, 150); c.moveTo(108, 60); c.lineTo(20, 150); c.stroke();
            }} />
          ) : (
            <mesh position={[0, 0.0115, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.068, 0.145]} /><meshStandardMaterial color="#05060a" roughness={0.1} metalness={0.6} /></mesh>
          )}
        </group>
        {glow > 0 && <pointLight position={[2.0, 1.1, 0.7]} color="#8fe3ff" intensity={2.2} distance={3} decay={2} />}
      </>
    );
  }, 1.6);
  const DRIPS = [0.45, 0.95, 1.55];
  kit(27, move(m([1.45, 1.3, -0.55], [0.9, 1.15, -2.1], 44), m([1.05, 1.25, -1.1], [0.9, 1.1, -2.1], 40, 3)), [0.9, 1.1, -2.1], (t, _u, a) => (
    <>
      <Kitchen t={a} variant="man" lamp={0} sky={0.5} />
      <pointLight position={[1.4, 1.6, -1.2]} color="#9fb8ff" intensity={4} distance={5} decay={2} />
      {DRIPS.map((d, i) => {
        const u = (t - d) / 0.28;
        if (u < 0 || u > 1) return null;
        return <mesh key={i} position={[0.9, lerp(1.19, 0.94, u * u), -2.07]}><sphereGeometry args={[0.012, 10, 10]} /><meshStandardMaterial color="#bfe9ff" emissive="#8fd8ff" emissiveIntensity={0.8} roughness={0.05} /></mesh>;
      })}
      {t > 1.4 && <mesh position={[0.9, 1.205 - 0.012 * clamp01((t - 1.4) / 0.5), -2.07]}><sphereGeometry args={[0.009 + 0.006 * clamp01((t - 1.4) / 0.5), 10, 10]} /><meshStandardMaterial color="#bfe9ff" emissive="#8fd8ff" emissiveIntensity={0.8} roughness={0.05} /></mesh>}
    </>
  ), 1.2);
  const c29 = move(m([-0.6, 0.9, 3.3], [1.0, 0.95, -0.2]), m([0.4, 1.0, 2.9], [1.0, 0.95, -0.2]));
  kit(29, c29, [1.0, 0.9, -0.2], (t, u, a) => (
    <>
      <Kitchen t={a} variant="man" lamp={0} sky={0.55} />
      <Cast pose={P('man', a, {mood: 'calm', hL: [120, 330], fingers: t > 0.15 ? 3 : 0, propR: 'lantern', hR: [470, 600], glow: 1})} p={[1.0, 0, -0.2]} />
      <pointLight position={[1.4, 0.95, 0.0]} color="#ffd180" intensity={14} distance={7} decay={2} />
      {label('3 DAYS', c29, t, u, [1.0, 0.9, -0.2], 1, 50)}
    </>
  ));
  kit(30, move(m([1.6, 1.3, 1.3], [0.4, 1.3, -1.8]), m([1.2, 1.35, 0.5], [0.4, 1.3, -1.8])), [0.2, 1.0, -1.2], (_t, u, a) => (
    <>
      <Kitchen t={a} variant="man" lamp={0} sky={0.1 + u * 1.0} />
      <pointLight position={[0.9, 1.9, -1.4]} color={u < 0.3 || u > 0.8 ? '#ffe9b0' : '#8fa8ff'} intensity={5} distance={5} decay={2} />
      <Cast pose={P('man', a, {mood: 'calm', hoodUp: true, turn: 0.6})} p={[0.0, 0, -1.2]} />
    </>
  ));

  // ============================================================ CITY
  D[19] = {
    cam: move(m([10, 48, 36], [0, 0, -6], 55), m([4, 36, 26], [0, 0, -6], 55, 2)),
    focus: [0, 0, -6], range: 400, bokeh: 0.3,
    render: (_t, _u, a) => <CityNight absT={a} />,
  };
  D[20] = {
    cam: move(m([-6, 9, 96], [0, 16, -8], 52), m([0, 12, 82], [0, 16, -8], 50, 2)),
    focus: [0, 14, -8], range: 400, bokeh: 0.3,
    render: (t, _u, a) => {
      const flash = [0.35, 0.95, 1.55].some((x) => (t > x && t < x + 0.2) || (t > x + 0.26 && t < x + 0.34));
      return (
        <>
          <CityNight absT={a} storm={flash ? 1 : 0.0001} bright={flash ? 2.0 : 1} />
          <Rain t={t} />
          <Bolt p={[-6, 36, 10]} on={t > 0.3 && t < 0.55} />
          <Bolt p={[9, 36, 6]} on={t > 0.95 && t < 1.2} />
          <Bolt p={[-12, 36, 4]} on={t > 1.55 && t < 1.8} />
          {flash && <pointLight position={[0, 40, 40]} color="#cfd8ff" intensity={4000} distance={400} decay={1.2} />}
        </>
      );
    },
  };
  D[28] = {
    cam: move(m([1, 6, 26], [0, 12, 9], 56), m([0, 14, 58], [0, 13, 9], 56, -2)),
    focus: [0, 14, 8], range: 400, bokeh: 0.3,
    render: (_t, _u, a) => <CityNight absT={a} hero />,
  };

  // ============================================================ DUSK STREET: ambulance
  D[21] = {
    cam: (u, t) => {
      const x = lerp(-9, 11, ramp(t, 0.0, 2.2));
      return {p: [-1.8, 1.2, 8.4] as V3, l: [lerp(-3, x, 0.45), 1.0, 4.4] as V3, fov: 52, roll: 1.2};
    },
    focus: [-3, 1, 3.4], range: 6,
    render: (t, _u, a) => {
      const x = lerp(-9, 11, ramp(t, 0.0, 2.2));
      return (
        <>
          <StreetEnv mode="dusk" />
          <Vehicle2 p={[x, 0, 6.5]} kind="ambulance" t={t} />
          <Cast pose={P('man', a, {mood: 'worry', turn: lerp(-0.8, 1, ramp(t, 0.6, 1.9)), hR: [410, 640]})} p={[-3.0, 0, 2.4]} />
        </>
      );
    },
  };

  // ============================================================ HOSPITAL + FIRE
  const run = (t: number, len: number) => smooth(t / len);
  D[22] = {
    cam: move(m([-2.8, 1.1, 8.4], [-2.2, 1.1, 2.8]), m([0.6, 1.3, 6.4], [-0.8, 1.2, 0.6])),
    focus: [-2, 1, 2], range: 5,
    render: (t, _u, a) => (
      <>
        <HospitalSet t={t} />
        <Cast pose={P('rescue', a, {walk: 2, mood: 'serious'})} p={[lerp(-4.0, -0.9, run(t, 1.7)), 0, lerp(4.4, 0.2, run(t, 1.7))]} s={0.86} />
        <Cast pose={P('rescue', a, {walk: 2, mood: 'serious'})} p={[lerp(-5.4, -1.9, run(t, 1.7)), 0, lerp(4.9, 0.8, run(t, 1.7))]} s={0.86} />
      </>
    ),
  };
  D[23] = {
    cam: move(m([-2.5, 0.7, 9.4], [0, 2.6, -2.0], 56), m([0.5, 1.3, 7.6], [0, 3.0, -2.0], 54, -3)),
    focus: [0, 1.4, 3.5], range: 6,
    render: (t, _u, a) => (
      <>
        <FireSet t={t} hose />
        <Cast pose={P('rescue', a, {walk: 2, mood: 'serious'})} p={[lerp(-4.2, 1.2, run(t, 1.6)), 0, lerp(5.0, 2.8, run(t, 1.6))]} s={0.86} />
        <Cast pose={P('rescue', a, {walk: 2, mood: 'serious'})} p={[lerp(-5.6, -0.4, run(t, 1.6)), 0, lerp(5.6, 3.2, run(t, 1.6))]} s={0.86} />
      </>
    ),
  };
  D[24] = {
    cam: move(m([0.2, 1.3, 8.2], [0.4, 1.2, 4.5], 50), m([0.4, 1.35, 7.4], [0.4, 1.2, 4.5], 48, -2)),
    focus: [0.4, 1.0, 4.5], range: 3,
    render: (t, _u, a) => (
      <>
        <FireSet t={t} hose={false} />
        <Cast pose={P('rescue', a, {mood: t < 0.8 ? 'serious' : 'sad', propR: 'clip', hR: [440, 640]})} p={[0.4, 0, 4.5]} />
      </>
    ),
  };

  // ============================================================ NEIGHBOR KITCHEN
  kit(31, move(m([0.5, 1.2, 3.4], [0.1, 0.95, -0.3]), m([0.2, 1.2, 2.8], [0.1, 0.95, -0.3])), [0.1, 0.9, -0.3], (t, _u, a) => (
    <>
      <Kitchen t={a} variant="neighbor" lamp={1} />
      <Cast pose={P('neighbor', a, {mood: t < 0.5 ? 'laugh' : t < 0.9 ? 'smirk' : 'sad', turn: 0.2, ...(t < 0.5 ? HIPS : {})})} p={[0.1, 0, -0.3]} />
    </>
  ));
  kit(32, move(m([1.0, 1.3, 1.5], [-0.9, 1.0, -1.5], 52), m([-0.1, 1.2, 0.7], [-1.0, 1.0, -1.5], 52)), [-0.9, 1.0, -1.2], (t, _u, a) => {
    const open = ramp(t, 0.3, 1.0);
    const hold = t > 0.25 && t < 1.05;
    return (
      <>
        <Kitchen t={a} variant="neighbor" lamp={1} fridgeOpen={open} />
        <Cast pose={P('neighbor', a, {mood: t < 1.1 ? 'smirk' : 'shock', turn: -0.9, hL: hold ? [lerp(125, 60, ramp(t, 0.5, 1.0)), 392] : null})} p={[-0.75, 0, -0.95]} />
      </>
    );
  });

  // ============================================================ NEIGHBOR DRIVES OFF
  D[33] = {
    cam: (u) => {
      const e = smooth(u);
      return {p: [lerp(1.0, 7.5, e), lerp(1.3, 1.5, e), lerp(10.4, 10.8, e)] as V3, l: [lerp(3.2, 12, e), lerp(1.1, 1.0, e), lerp(3.5, 5.5, e)] as V3, fov: 54, roll: lerp(0, -2, e)};
    },
    focus: [4, 1, 4.5], range: 7,
    render: (t, _u, a) => {
      const reach = ramp(t, 0.15, 1.0);
      const inCar = t > 1.05;
      const carX = t < 1.4 ? 5.4 : 5.4 + Math.pow((t - 1.4) / 1.15, 2) * 20;
      return (
        <>
          <StreetEnv mode="day" />
          <Vehicle2 p={[carX, 0, 4.7]} kind="car" color="#d94b52" lightsOn={false} doorOpen={t > 0.9 && t < 1.25 ? 0.9 : 0} />
          {!inCar && <Cast pose={P('neighbor', a, {walk: 2, mood: 'worry', hR: [420, 600], propR: 'keys'})} p={[lerp(2.4, 5.6, reach), 0, lerp(2.2, 5.9, reach)]} s={0.84} />}
        </>
      );
    },
  };

  return STARTS.map((_, i) => {
    const n = i + 1;
    const def = D[n];
    const from = STARTS[i];
    const to = n < STARTS.length ? STARTS[n] : TOTAL;
    const spec: ShotSpec = {
      from,
      to,
      light: 'indoor',
      ownLights: true,
      cam: def.cam,
      render: (t, u, a) => def.render(t, u, a, def.cam),
      post: (_f, pose) => <RealPost pose={pose} focus={v(def.focus)} range={def.range ?? 2.6} bokeh={def.bokeh ?? 2.4} />,
    };
    if (DIP_SHOTS.has(n)) spec.dip = {frames: 8, color: '#000000'};
    return spec;
  });
}

// the booklet held up by the neighbor in shot 7: cover text fitted inside the cover
import {ctex} from './street';
import {fitCover} from './gfx';
const BookletPlane: React.FC<{p: V3}> = ({p}) => {
  const cover = ctex('plane7cover', 640, 900, (c, w, h) => fitCover(c, w, h));
  return (
    <group position={p} rotation={[-0.12, 0, 0]}>
      <mesh castShadow><boxGeometry args={[0.42, 0.58, 0.015]} /><meshBasicMaterial color="#fffdf2" toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.009]}><planeGeometry args={[0.4, 0.56]} /><meshBasicMaterial map={cover} toneMapped={false} /></mesh>
    </group>
  );
};
void Win;
