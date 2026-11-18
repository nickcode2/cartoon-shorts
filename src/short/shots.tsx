import React from 'react';
import {Box, CamFn, Cyl, LightMode, LiveTex, Plane, Vehicle, clamp01, lerp, lerp3, move, smooth, V3, useTex} from './kit';
import {Person} from './kit';
import {PO} from './people';
import {STARTS, FPS} from './data';
import {Supermarket, Houses, Kitchen, Home} from './sets_a';
import {MapSet, BookletSet, Mailboxes, CityNight, Rain, Bolt, FireSet, HospitalSet, coverDraw} from './sets_b';

export interface ShotDef {
  light: LightMode | ((t: number) => LightMode);
  ambBoost?: number;
  cam: CamFn;
  render: (t: number, u: number, absT: number) => React.ReactNode;
}

const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const pulse = (t: number, a: number, b: number) => (t > a && t < b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
const m = (p: V3, l: V3, fov = 60, roll = 0) => ({p, l, fov, roll});
const MAN = (t: number, o: Partial<PO> = {}): PO => ({who: 'man', t, ...o});
const NEI = (t: number, o: Partial<PO> = {}): PO => ({who: 'neighbor', t, ...o});
const RES = (t: number, o: Partial<PO> = {}): PO => ({who: 'rescue', t, ...o});

// =================================================================== SUPERMARKET
const s1: ShotDef = {
  light: 'indoor',
  cam: move(m([0.5, 1.5, 7.2], [0, 1.2, -4], 62), m([0.2, 1.35, 4.9], [0, 1.2, -4], 62)),
  render: (t) => (
    <>
      <Supermarket t={t} cartX={-5} cartZ={-5} jugs={0} cans={0} belt={t} beep={0} />
      <Person po={MAN(t, {walk: 1, expr: 'calm'})} p={[0.2, 0, lerp(-5.5, -1.0, smooth(t / 2.4))]} />
    </>
  ),
};

const s2: ShotDef = {
  light: 'indoor',
  cam: move(m([0.2, 0.55, -0.1], [-0.2, 1.1, -3.2], 66), m([1.1, 0.75, -0.5], [0.7, 1.1, -3.2], 66)),
  render: (t) => {
    const x = lerp(-1.15, 1.15, ramp(t, 0.75, 1.5));
    const grab1 = pulse(t, 0.3, 1.0);
    const grab2 = pulse(t, 1.15, 1.9);
    const jugs = Math.floor(clamp01((t - 0.55) / 0.5) * 4);
    const cans = Math.floor(clamp01((t - 1.2) / 0.8) * 8);
    return (
      <>
        <Supermarket t={t} cartX={x + 0.1} cartZ={-1.9} jugs={jugs} cans={cans} belt={0} beep={0} />
        <Person
          po={MAN(t, {
            expr: 'calm',
            walk: ramp(t, 0.75, 1.5) > 0.05 && ramp(t, 0.75, 1.5) < 0.95 ? 1 : 0,
            hL: grab1 > 0 ? [lerp(200, 40, grab1), lerp(738, 440, grab1)] : null,
            propL: grab1 > 0.2 ? 'jug' : 'none',
            hR: grab2 > 0 ? [lerp(400, 560, grab2), lerp(738, 460, grab2)] : null,
            propR: grab2 > 0.2 ? 'can' : 'none',
          })}
          p={[x, 0, -2.7]}
        />
      </>
    );
  },
};

const s3: ShotDef = {
  light: 'indoor',
  cam: move(m([1.9, 3.4, -6.8], [0.3, 1.0, -10.8], 60), m([1.3, 2.9, -7.9], [0.3, 1.0, -10.8], 58)),
  render: () => null,
};
s3.render = (t) => {
  const item = (t0: number) => {
    const age = t - t0;
    if (age < 0) return null;
    const x = Math.max(-0.9, 1.2 - age * 1.7);
    return {x, scan: Math.abs(x - 0.2) < 0.12};
  };
  const r = item(0.22), f = item(1.12);
  const beep = r?.scan || f?.scan ? 1 : 0;
  const k = pulse(t, 0.1, 0.5) + pulse(t, 1.0, 1.4);
  return (
    <>
      <Supermarket t={t} cartX={2.0} cartZ={-9.0} jugs={4} cans={8} belt={t} beep={beep} />
      {r && <Box s={[0.34, 0.2, 0.12]} p={[r.x, 1.14, -10.8]} c="#c0392b" ink={0.012} />}
      {f && <Cyl r={0.04} h={0.3} p={[f.x, 1.1, -10.8]} c="#f2c53d" rot={[0, 0, Math.PI / 2]} ink={0.01} seg={8} />}
      <Person po={MAN(t, {expr: 'calm', hR: [lerp(400, 470, k), lerp(738, 590, k)]})} p={[1.0, 0, -9.7]} />
    </>
  );
};

// =================================================================== HOUSES
const housesShot = (cam: CamFn, render: (t: number) => React.ReactNode): ShotDef => ({
  light: 'day',
  cam,
  render: (t) => (
    <>
      <Houses mode="day" t={t} />
      {render(t)}
    </>
  ),
});

const s4 = housesShot(move(m([3.8, 0.45, 8.0], [1.0, 1.5, 2.6], 62), m([2.3, 0.6, 5.6], [1.0, 1.5, 2.6], 60)), (t) => (
  <>
    <Person po={MAN(t, {expr: 'smile', propR: 'bag', hR: [430, 600]})} p={[-1.0, 0, 2.4]} />
    <Person po={NEI(t, {expr: t < 0.1 ? 'smirk' : 'laugh', hL: [150, 650], hR: [470, 620]})} p={[1.05, 0, 2.7]} flip />
  </>
));

const s5 = housesShot(move(m([-2.8, 1.2, 6.8], [0, 1.35, 2.6], 60), m([0.9, 1.35, 6.3], [0, 1.35, 2.6], 58)), (t) => (
  <>
    <Person po={MAN(t, {expr: 'calm', propR: 'bag', hR: [430, 600]})} p={[-0.8, 0, 2.5]} />
    <Person po={NEI(t, {expr: t < 1.2 ? 'talk' : 'shock', tilt: 4, hR: [480, 560], look: -0.8})} p={[0.9, 0, 2.7]} flip />
  </>
));

const s6 = housesShot(move(m([-0.3, 1.15, 4.0], [0, 1.0, 2.6], 52), m([0.15, 1.15, 3.7], [0, 1.0, 2.6], 52)), (t) => {
  const ext = ramp(t, 0.1, 0.8);
  const given = t > 0.95;
  return (
    <>
      <Person
        po={MAN(t, {expr: 'calm', hR: [lerp(400, 560, ext), lerp(738, 520, ext)], propR: given ? 'none' : 'booklet', hL: [200, 738]})}
        p={[-0.5, 0, 2.6]}
      />
      <Person po={NEI(t, {expr: 'smirk', hL: [lerp(200, 40, ext), lerp(738, 520, ext)], propL: given ? 'booklet' : 'none', look: -0.5})} p={[0.5, 0, 2.6]} flip />
    </>
  );
});

const s7 = housesShot(move(m([0.5, 1.3, 5.2], [0.5, 1.15, 2.6], 54), m([0.5, 1.2, 3.9], [0.5, 1.1, 2.6], 50, -2)), (t) => {
  const cover = useTexCover();
  return (
    <>
      <Person po={NEI(t, {expr: t < 0.9 ? 'smirk' : 'shock', hL: [250, 540], hR: [350, 540], look: 0})} p={[0.5, 0, 2.5]} flip />
      <Plane w={0.3} h={0.42} p={[0.5, 0.76, 2.62]} rot={[0.1, 0, 0]} map={cover} basic />
      <Person po={MAN(t, {expr: 'smile'})} p={[-1.1, 0, 2.7]} />
    </>
  );
});
function useTexCover() {
  return useTex('cover', 640, 900, coverDraw);
}

const s8 = housesShot(move(m([-0.6, 1.2, 5.0], [-0.6, 1.1, 2.6], 54), m([-0.6, 1.55, 6.6], [-0.6, 1.2, 2.6], 56)), (t) => (
  <Person po={MAN(t, {expr: t < 0.9 ? 'calm' : 'smile', hoodUp: true, hR: [400, 738], look: 0.3})} p={[-0.6, 0, 2.6]} />
));

// =================================================================== MAP
const s9: ShotDef = {
  light: 'indoor',
  cam: move(m([-3.4, 6.2, 7.8], [0.4, 0, 0.4], 56), m([-1.8, 5.0, 5.2], [0.6, 0, 0.2], 54, -2)),
  render: (t, _u, a) => <MapSet t={t} absT={a} />,
};
const s10: ShotDef = {
  light: 'indoor',
  cam: move(m([3.6, 3.4, 3.8], [0.6, 0, 0.0], 58, 3), m([0.6, 2.8, 3.0], [0.8, 0, -0.2], 56, -2)),
  render: (t, _u, a) => <MapSet t={t} absT={a} />,
};
const s16: ShotDef = {
  light: 'indoor',
  cam: move(m([-2.8, 3.0, 3.6], [-0.7, 0, 0.2], 58, 2), m([-1.4, 1.8, 2.0], [-0.7, 0, 0.25], 54, -2)),
  render: (t, _u, a) => <MapSet t={t} absT={a} dotR={0.06} />,
};
const s17: ShotDef = {
  light: 'indoor',
  cam: move(m([8.2, 3.2, 4.6], [9, 0, 0.3], 58), m([-0.6, 17, 20], [-0.6, 0, 0], 78)),
  render: (t, _u, a) => <MapSet t={t} absT={a} dotR={0.09} />,
};

// =================================================================== HOME (backpack)
const flyItems = (t: number) =>
  [
    {kind: 'bottle', t0: 0.3}, {kind: 'can', t0: 0.7}, {kind: 'torch', t0: 1.1}, {kind: 'radio', t0: 1.5}, {kind: 'cash', t0: 1.9}, {kind: 'blanket', t0: 2.2},
  ].map((i) => ({kind: i.kind, u: (t - i.t0) / 0.5, from: [-2.0, 1.1, 0.2] as V3}));

const s11: ShotDef = {
  light: 'indoor',
  cam: move(m([1.3, 3.5, 2.6], [-1.2, 0.4, -0.7], 62), m([0.3, 3.1, 1.7], [-1.2, 0.4, -0.7], 60)),
  render: (t) => (
    <>
      <Home t={t} zip={0.5} items={flyItems(t)} packOpen={1} lift={0} />
      <Person po={MAN(t, {expr: 'calm', hR: [lerp(470, 560, Math.abs(Math.sin(t * 5))), 600], hL: [200, 738]})} p={[-2.2, 0, 0.2]} />
    </>
  ),
};

const s12: ShotDef = {
  light: 'indoor',
  cam: move(m([0.4, 0.4, 1.6], [-0.7, 0.75, -1.0], 62), m([0.0, 0.6, 1.0], [-0.7, 0.8, -1.0], 58, 3)),
  render: (t) => {
    const zip = ramp(t, 1.5, 1.95);
    const open = 1 - ramp(t, 1.25, 1.55);
    const lift = t > 1.95 ? 0.05 * Math.sin(clamp01((t - 1.95) / 0.3) * Math.PI) : 0;
    return (
      <>
        <Home t={t} zip={zip} items={[]} packOpen={open} lift={lift} />
        <Person po={MAN(t, {expr: t > 1.9 ? 'smile' : 'serious', hL: [220, 640], hR: [380, 640]})} p={[-0.2, 0, -1.3]} />
      </>
    );
  },
};

const s15: ShotDef = {
  light: 'indoor',
  cam: (u) => {
    const e = smooth(u / 0.65);
    return {p: lerp3([0.3, 0.3, 2.3], [1.2, 1.55, 1.4], e), l: lerp3([-0.8, 0.5, -1.0], [1.3, 1.6, -2.1], e), fov: lerp(62, 46, e), roll: lerp(0, -1, e)};
  },
  render: (t) => <Home t={t} zip={1} items={[]} packOpen={0} lift={0} />,
};

// =================================================================== MAILBOXES + BOOKLET
const s13: ShotDef = {
  light: 'day',
  cam: move(m([-6.6, 0.9, 6.2], [-4.2, 1.2, 2.9], 58), m([2.8, 1.0, 5.4], [4.8, 1.2, 2.9], 58, 2)),
  render: (t) => <Mailboxes t={t} />,
};
const s14: ShotDef = {
  light: 'indoor',
  cam: move(m([0.2, 1.7, 2.7], [0, 0.55, 0], 52, 0), m([0.05, 1.2, 1.75], [0, 0.55, 0], 50, -3)),
  render: (t) => <BookletSet t={t} />,
};

// =================================================================== CITY
const s18: ShotDef = {
  light: 'indoor',
  cam: move(m([2.8, 1.5, 2.3], [-1.0, 1.5, -1.5], 58), m([2.0, 1.55, 1.1], [-1.0, 1.5, -1.5], 56)),
  render: (t) => (
    <>
      <Kitchen t={t} lamp={1} variant="man" clock />
      <Person po={MAN(t, {expr: 'worry', hR: [330, 330], look: -0.6, tilt: -3})} p={[-1.2, 0, -0.9]} />
    </>
  ),
};

const s19: ShotDef = {
  light: 'night',
  cam: move(m([10, 48, 36], [0, 0, -6], 55), m([4, 36, 26], [0, 0, -6], 55, 2)),
  render: (t, _u, a) => <CityNight absT={a} />,
};
const s20: ShotDef = {
  light: 'night',
  ambBoost: 2.2,
  cam: move(m([-6, 9, 96], [0, 16, -8], 52), m([0, 12, 82], [0, 16, -8], 50, 2)),
  render: (t, _u, a) => {
    const flash = [0.35, 0.95, 1.55].some((x) => (t > x && t < x + 0.2) || (t > x + 0.26 && t < x + 0.34));
    return (
      <>
        <CityNight absT={a} storm={flash ? 1 : 0.0001} bright={flash ? 4.5 : 2.2} />
        <Rain t={t} />
        <Bolt p={[-6, 30, -20]} on={t > 0.3 && t < 0.55} />
        <Bolt p={[9, 30, -24]} on={t > 0.95 && t < 1.2} />
        <Bolt p={[-12, 30, -26]} on={t > 1.55 && t < 1.8} />
        {flash && <pointLight position={[0, 20, 20]} color="#cfd8ff" intensity={80} distance={120} decay={1} />}
      </>
    );
  },
};
const s28: ShotDef = {
  light: 'night',
  cam: move(m([1, 6, 26], [0, 12, 9], 56), m([0, 14, 58], [0, 13, 9], 56, -2)),
  render: (t, _u, a) => <CityNight absT={a} hero />,
};

// =================================================================== HOUSES AT DUSK: ambulance passes
const s21: ShotDef = {
  light: 'dusk',
  cam: (_u, t) => {
    const x = lerp(-9, 11, ramp(t, 0.0, 2.2));
    return {p: [-1.5, 1.5, 11.5] as V3, l: [lerp(x, -3, 0.15), 1.3, 6.6] as V3, fov: 64, roll: 1.5};
  },
  render: (t) => {
    const x = lerp(-9, 11, ramp(t, 0.0, 2.2));
    return (
      <>
        <Houses mode="dusk" t={t} />
        <Vehicle p={[x, 0, 6.6]} kind="ambulance" t={t} />
        <Person po={MAN(t, {expr: 'worry', look: lerp(-0.8, 1, ramp(t, 0.6, 1.9)), hR: [400, 738]})} p={[-3.0, 0, 3.0]} />
      </>
    );
  },
};

// =================================================================== HOSPITAL + FIRE
const s22: ShotDef = {
  light: 'night',
  ambBoost: 1.8,
  cam: move(m([-2, 1.4, 10], [-1.5, 1.5, 2], 62), m([1.5, 1.9, 9.2], [0, 1.8, -2], 60, 2)),
  render: (t) => (
    <>
      <HospitalSet t={t} />
      <Person po={RES(t, {walk: 2, expr: 'serious'})} p={[lerp(-7, -1.2, smooth(t / 1.7)), 0, lerp(4.8, -1.8, smooth(t / 1.7))]} s={0.86} />
      <Person po={RES(t, {walk: 2, expr: 'serious'})} p={[lerp(-9, -2.2, smooth(t / 1.7)), 0, lerp(5.6, -1.4, smooth(t / 1.7))]} s={0.86} />
    </>
  ),
};
const s23: ShotDef = {
  light: 'dusk',
  ambBoost: 1.1,
  cam: move(m([-3, 0.5, 9], [0, 3.5, -2], 64), m([0.3, 1.3, 6.8], [0, 4, -2], 62, -3)),
  render: (t) => (
    <>
      <FireSet t={t} hose />
      <Person po={RES(t, {walk: 2, expr: 'serious'})} p={[lerp(-5, 1.6, smooth(t / 1.6)), 0, lerp(5.5, 2.8, smooth(t / 1.6))]} s={0.86} />
      <Person po={RES(t, {walk: 2, expr: 'serious'})} p={[lerp(-7, -0.4, smooth(t / 1.6)), 0, lerp(6.2, 3.2, smooth(t / 1.6))]} s={0.86} />
    </>
  ),
};
const s24: ShotDef = {
  light: 'dusk',
  ambBoost: 1.1,
  cam: move(m([0.2, 1.5, 7.4], [0.4, 1.5, 4.5], 54), m([0.4, 1.55, 6.3], [0.4, 1.5, 4.5], 52, -2)),
  render: (t) => (
    <>
      <FireSet t={t} hose={false} />
      <Person po={RES(t, {expr: t < 0.8 ? 'serious' : 'sad', propR: 'clip', hR: [440, 660], tilt: 3})} p={[0.4, 0, 4.5]} s={1.0} />
    </>
  ),
};

// =================================================================== KITCHEN (dark)
const s25: ShotDef = {
  light: (t) => (t < 1.5 && !(t > 1.0 && Math.floor(t * 14) % 2 === 0) ? 'indoor' : 'dark'),
  cam: move(m([-2.4, 1.6, 2.8], [0, 1.2, -0.8], 60), m([2.4, 1.6, 2.9], [0, 1.2, -0.8], 60)),
  render: (t) => {
    const on = t < 1.5 && !(t > 1.0 && Math.floor(t * 14) % 2 === 0);
    return (
      <>
        <Kitchen t={t} lamp={on ? 1 : 0} variant="man" phoneGlow={1} />
        <Person po={MAN(t, {expr: on ? 'calm' : 'worry', propR: 'phone', hR: [430, 560], glow: 1, look: 0.4})} p={[0.2, 0, -0.2]} />
        {!on && <pointLight position={[1.0, 1.3, 0.6]} color="#8fe3ff" intensity={2} distance={4} decay={2} />}
      </>
    );
  },
};
const s26: ShotDef = {
  light: 'dark',
  cam: move(m([1.15, 1.95, 0.6], [1.1, 0.84, 0.4], 50), m([1.15, 1.4, 0.5], [1.1, 0.84, 0.4], 48, -4)),
  render: (t) => {
    const glow = t < 1.2 ? (t > 0.9 && Math.floor(t * 18) % 2 === 0 ? 0 : 1) : 0;
    return (
      <>
        <Kitchen t={t} lamp={0} variant="man" phoneGlow={glow} />
        {glow > 0 && (
          <LiveTex
            w={128}
            h={256}
            size={[0.09, 0.16]}
            p={[1.1, 0.858, 0.4]}
            rot={[-Math.PI / 2, 0, 0]}
            draw={(c) => {
              c.fillStyle = '#0d2a3a'; c.fillRect(0, 0, 128, 256);
              for (let i = 0; i < 4; i++) { c.fillStyle = i < 1 ? '#bfefff' : '#3a5666'; c.fillRect(30 + i * 20, 130 - i * 14, 12, 30 + i * 14); }
              c.strokeStyle = '#ff5a5a'; c.lineWidth = 8; c.beginPath(); c.moveTo(20, 60); c.lineTo(108, 150); c.moveTo(108, 60); c.lineTo(20, 150); c.stroke();
            }}
          />
        )}
        {glow > 0 && <pointLight position={[1.1, 1.1, 0.4]} color="#8fe3ff" intensity={2} distance={3} decay={2} />}
      </>
    );
  },
};
const DRIPS = [0.45, 0.95, 1.55];
const s27: ShotDef = {
  light: 'dark',
  cam: move(m([1.45, 1.35, -0.9], [0.9, 1.2, -2.15], 48), m([1.05, 1.28, -1.3], [0.9, 1.2, -2.15], 46, 3)),
  render: (t) => {
    const flow = t < 0.3 ? 0 : 1;
    return (
      <>
        <Kitchen t={t} lamp={0} variant="man" tapDrip={flow} />
        <pointLight position={[1.4, 1.6, -1.2]} color="#9fb8ff" intensity={3} distance={5} decay={2} />
        {DRIPS.map((d, i) => {
          const u = (t - d) / 0.28;
          if (u < 0 || u > 1) return null;
          return <mesh key={i} position={[0.9, lerp(1.3, 0.97, u * u), -2.05]}><sphereGeometry args={[0.014, 8, 8]} /><meshBasicMaterial color="#8fd8ff" toneMapped={false} /></mesh>;
        })}
        {/* last drop swells and never falls */}
        {t > 1.9 - 0.5 && <mesh position={[0.9, 1.31 - 0.01 * clamp01((t - 1.4) / 0.5), -2.05]}><sphereGeometry args={[0.012 + 0.006 * clamp01((t - 1.4) / 0.5), 8, 8]} /><meshBasicMaterial color="#8fd8ff" toneMapped={false} /></mesh>}
      </>
    );
  },
};
const s29: ShotDef = {
  light: 'dark',
  cam: move(m([-0.9, 0.7, 2.3], [1.2, 1.2, 0], 56), m([0.4, 0.95, 2.7], [1.2, 1.2, 0], 54, -3)),
  render: (t) => (
    <>
      <Kitchen t={t} lamp={0} variant="man" sky={0.55} />
      <Person po={MAN(t, {expr: 'calm', hoodUp: false, hL: [100, 400], fingers: t > 0.15 ? 3 : 0, propR: 'lantern', hR: [470, 600], glow: 1})} p={[1.2, 0, -0.2]} />
      <pointLight position={[1.8, 1.2, 0.3]} color="#ffd180" intensity={9} distance={7} decay={2} />
    </>
  ),
};
const s30: ShotDef = {
  light: 'dark',
  cam: move(m([0.9, 1.7, 0.4], [0.9, 1.9, -2.3], 56), m([0.9, 1.78, -0.5], [0.9, 1.9, -2.3], 52, 2)),
  render: (t, u) => (
    <>
      <Kitchen t={t} lamp={0} variant="man" sky={0.1 + u * 1.0} />
      <pointLight position={[0.9, 1.9, -1.0]} color={u < 0.3 || u > 0.8 ? '#ffe9b0' : '#8fa8ff'} intensity={3} distance={5} decay={2} />
      <Person po={MAN(t, {expr: 'calm', hoodUp: true, look: 0.6})} p={[-0.7, 0, -1.2]} />
    </>
  ),
};

// =================================================================== NEIGHBOR KITCHEN
const s31: ShotDef = {
  light: 'indoor',
  cam: move(m([0.3, 1.6, 2.0], [0, 1.45, -0.4], 52), m([0.1, 1.55, 1.3], [0, 1.45, -0.4], 48, -2)),
  render: (t) => (
    <>
      <Kitchen t={t} lamp={1} variant="neighbor" />
      <Person po={NEI(t, {expr: t < 0.5 ? 'laugh' : t < 0.9 ? 'smirk' : 'sad', look: 0.2})} p={[0, 0, -0.4]} />
    </>
  ),
};
const s32: ShotDef = {
  light: 'indoor',
  cam: move(m([1.3, 1.5, 0.9], [-0.4, 1.1, -1.7], 58), m([-0.35, 1.15, -0.55], [-0.4, 1.0, -1.9], 54, 3)),
  render: (t) => {
    const open = ramp(t, 0.3, 1.0);
    return (
      <>
        <Kitchen t={t} lamp={1} variant="neighbor" fridgeOpen={open} />
        <Person po={NEI(t, {expr: t < 1.1 ? 'smirk' : 'shock', hL: open > 0 && open < 1 ? [60, 520] : null, look: -0.9})} p={[0.65, 0, -0.9]} />
      </>
    );
  },
};

// =================================================================== NEIGHBOR DRIVES OFF
const s33: ShotDef = {
  light: 'day',
  cam: (u, t) => {
    const e = smooth(u);
    return {p: [lerp(1.0, 7.5, e), lerp(1.3, 1.5, e), lerp(10.8, 11.5, e)] as V3, l: [lerp(3.2, 12, e), lerp(1.2, 1.0, e), lerp(2.5, 6.2, e)] as V3, fov: 62, roll: lerp(0, -2, e) * (t > 0 ? 1 : 1)};
  },
  render: (t) => {
    const reach = ramp(t, 0.15, 1.0);
    const inCar = t > 1.05;
    const door = pulse(t, 0.95, 1.3) > 0 ? 0.9 : 0;
    const carX = t < 1.4 ? 5.4 : 5.4 + (Math.pow((t - 1.4) / 1.15, 2)) * 20;
    return (
      <>
        <Houses mode="day" t={t} />
        <Vehicle p={[carX, 0, 6.3]} kind="car" t={t} body="#e5484d" lightsOn={false} doorOpen={t > 0.9 && t < 1.25 ? 0.9 : door} />
        {!inCar && <Person po={NEI(t, {walk: 2, expr: 'worry', hR: [400, 640], propR: 'keys'})} p={[lerp(2.4, 5.0, reach), 0, lerp(2.4, 5.4, reach)]} s={0.84} />}
      </>
    );
  },
};

export const SHOTS: Record<number, ShotDef> = {
  1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9, 10: s10, 11: s11, 12: s12, 13: s13, 14: s14, 15: s15, 16: s16, 17: s17, 18: s18,
  19: s19, 20: s20, 21: s21, 22: s22, 23: s23, 24: s24, 25: s25, 26: s26, 27: s27, 28: s28, 29: s29, 30: s30, 31: s31, 32: s32, 33: s33,
};
export const absOf = (n: number, t: number) => STARTS[n - 1] / FPS + t;
