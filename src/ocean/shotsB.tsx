// OVERBOARD_SURVIVOR takes 10 - 20b: the night in the water (tread, jellyfish, current, shark fin), the imagined huge shape (shots 15-18: deeper teal tint, clear water, vignette), sunrise, cabin, reception.
// MOTION: treading water = slow alternating sculling circles of the hands at the waterline + bicycle legs under the surface (estimate); paddling = alternating arm strokes (estimate); a flinch = a quick leg
// pull + a lean away + the face cut to shock (estimates). No source gives frame counts (RESEARCH BEFORE MOTION: none found, marked "estimate, untested").
import React from 'react';
import {V3} from '../kit/kit';
import {CX} from '../kit/rickRig';
import {Ctx, START, sm, ramp, mix, clamp, swimXZ, finState, Sea, rippleSrc, idleExtra, shipPos} from './base';
import {Person, poseOf, dirTo} from './cast';
import {Swimmer, SWIM_S, CurrentStreaks} from './fx';
import {Jelly, UnderWorld, SharkFin, Beast, ringsFor} from './ocean';
import {CruiseShip} from './ships';
import {Cabin, Reception} from './interiors';
import {handTo} from '../shop/shots';
import {WarmPoint} from './base';
import * as THREE from 'three';

const S = SWIM_S;
const scan = (f: number, a: number, b: number): [number, number] => { const t = mix(a, b, sm(f / 40)) + 0.5 * Math.sin(f * 0.12); return [Math.sin(t), Math.cos(t)]; };
// 10a/b/c "No boat. No lights. Nothing." three quick takes of one 270 degree arc around the tiny man in the empty ocean (the camera does the arc: see ENTRIES)
const tread = (id: string, face: 'sad' | 'fear' | 'confused', a: number, b: number): React.FC<Ctx> => ({f, c, ss}) => {
  const g = START[id] + f;
  return (<><Sea mode="night" g={g} ripples={rippleSrc(g)} focus={[0, 0.5, 0]} ss={ss} amp={0.8} /><Swimmer g={g} xz={swimXZ(g)} wl={470} cam={c.p} arms="tread" face={f > 18 ? face : 'sad'} amp={0.8} look={scan(f, a, b)} extra={{headFwd: scan(f, a, b)}} /></>);
};
export const E10A = tread('10a', 'sad', 0.2, 2.0), E10B = tread('10b', 'fear', 2.0, 3.8), E10C = tread('10c', 'sad', 3.8, 5.2);
// 11 "So, he treads water." medium at water level, arms moving (rounded elbows), calm determined face
export const E11: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['11'] + f;
  return (<><Sea mode="night" g={g} ripples={rippleSrc(g)} focus={[0, 0.5, 0]} ss={ss} amp={0.8} /><Swimmer g={g} xz={swimXZ(g)} wl={470} cam={c.p} arms="tread" face={f < 20 ? 'annoyed' : 'deadpan'} amp={0.8} roll={0.03} extra={{headFwd: dirTo([0, 0, 0], c.p)}} /></>);
};
// underwater world: bright underside of the surface above, light rays from the surface, particles; the swimmer's legs hang below the surface
const UW: React.FC<{g: number; ss: number; top?: string; bot?: string; mode?: 'night' | 'imagine'}> = ({g, ss, top = '#2B93A8', bot = '#0A4863', mode = 'night'}) => (<><Sea mode={mode} g={g} ripples={rippleSrc(g)} focus={[0, -2, 0]} ss={ss} amp={0.7} dome={false} fogNear={6} fogFar={50} /><UnderWorld f={g} top={top} bot={bot} center={[0, -8, 0]} /></>);
export const jellyPos = (id: string, k: number, g: number): V3 => { const t = g / 30, o = k === 0 ? [1.5, -2.3, 0.7, 0.5] : k === 1 ? [-1.6, -3.0, -0.6, 0.42] : [2.4, -3.6, 1.0, 0.35]; return [o[0] + 0.25 * Math.sin(t * 0.7 + k), o[1] + 0.18 * (g - START[id]) / 30 + 0.12 * Math.sin(t * 1.3 + k), o[2] + 0.2 * Math.cos(t * 0.5 + k)]; };
// 12a "Jellyfish drift by, glowing in the dark," glowing jellyfish drifting in the dark water (underwater low angle)
export const E12A: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['12a'] + f, t = g / 30;
  return (
    <>
      <UW g={g} ss={ss} />
      {[0, 1, 2].map((k) => <Jelly key={k} p={jellyPos('12a', k, g)} s={[0.62, 0.5, 0.42][k]} t={t} ph={k * 1.9} rot={[0, k, 0.1 * Math.sin(t + k)]} glow={1} />)}
      <Swimmer g={g} xz={swimXZ(g)} wl={470} cam={c.p} arms="tread" face="deadpan" amp={0.7} extra={{shade: {color: '#2B93A8', k: 0.22}}} />
    </>
  );
};
export const jelly12b = (g: number): V3 => [-1.3 + 0.1 * Math.sin(g / 30), -1.55 + 0.1 * Math.sin(g / 30), 0.42];
// 12b "their tentacles brushing his legs." tentacles reach his legs from below, he flinches and swims away scared
export const E12B: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['12b'] + f, t = g / 30, fl = ramp(f, 24, 34), away = ramp(f, 32, 70), xz = swimXZ(g), back = away * 0.6;
  const jp = jelly12b(g);
  return (
    <>
      <UW g={g} ss={ss} />
      <Jelly p={jp} s={0.6} t={t} ph={0.7} rot={[0, 0, 2.19]} reach={0.03 + 0.04 * ramp(f, 0, 24)} glow={1.1} />
      <Jelly p={jellyPos('12a', 1, g)} s={0.5} t={t} ph={1.9} glow={0.9} />
      <Swimmer g={g} xz={xz} wl={470} cam={c.p} arms={away > 0.05 ? 'paddle' : 'tread'} armK={0.5 + 0.5 * away} face={f < 22 ? 'confused' : f < 40 ? 'shock' : 'fear'} amp={0.7} kick={0.5 + 0.9 * fl} lean={-0.12 * fl + 0.1 * back} extra={{shade: {color: '#2B93A8', k: 0.22}}} />
    </>
  );
};
// 13a "A strong current drags him..." swirling streaks pull him sideways; he paddles hard against it
export const E13A: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['13a'] + f, xz = swimXZ(g);
  return (
    <>
      <Sea mode="night" g={g} ripples={ringsFor(g / 30, (t0) => swimXZ(t0 * 30), 0.35, 1.2)} focus={[xz[0], 0.5, 0]} ss={ss} amp={1.0} />
      <CurrentStreaks c={[xz[0], 0, xz[1]]} g={g} dir={[1, 0.15]} speed={4.2} />
      <Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="paddle" face={f < 20 ? 'confused' : 'teeth'} amp={1.0} kick={0.9} lean={-0.14} look={[-0.3, 0.9]} />
    </>
  );
};
// 13b "...farther and farther from the ship," wide: the ship's lights getting smaller in the distance
export const E13B: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['13b'] + f, xz = swimXZ(g), sp: V3 = [300 + 0.5 * (g - 1100), 0, -30];
  return (
    <>
      <Sea mode="night" g={g} ripples={ringsFor(g / 30, (t0) => swimXZ(t0 * 30), 0.4, 1.0)} focus={[xz[0], 0.5, 0]} ss={ss} amp={1.0} fogNear={140} fogFar={330} />
      <CruiseShip p={sp} yaw={0.15} deck={false} />
      <CurrentStreaks c={[xz[0], 0, xz[1]]} g={g} dir={[1, 0.1]} speed={4.2} />
      <Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="paddle" face="sad" amp={1.0} kick={0.9} lean={-0.1} look={[1, 0]} />
    </>
  );
};
// 14a / 14b "...and every shadow in the water could be a shark." a cartoon fin circles him (never an attack: it stays >= 2.2 m away)
const Fin: React.FC<{g: number}> = ({g}) => { const s = finState(g); return <SharkFin p={s.p} yaw={s.yaw} size={1.7} />; };
export const E14A: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['14a'] + f, xz = swimXZ(g), s = finState(g), look = dirTo([xz[0], 0, xz[1]], s.p);
  return (
    <>
      <Sea mode="night" g={g} ripples={[...rippleSrc(g).slice(0, 2), {x: s.p[0], z: s.p[2], t0: g / 30 - 0.2, k: 0.6}]} focus={[xz[0], 0.5, 0]} ss={ss} amp={0.8} />
      <Fin g={g} />
      <Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" face={f < 14 ? 'confused' : 'fear'} amp={0.8} look={look} extra={{headFwd: look}} />
    </>
  );
};
export const E14B: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['14b'] + f, xz = swimXZ(g), s = finState(g), run = ramp(f, 10, 24), look = dirTo([xz[0], 0, xz[1]], s.p);
  return (
    <>
      <Sea mode="night" g={g} ripples={[...ringsFor(g / 30, (t0) => swimXZ(t0 * 30), 0.3, 1.0).slice(0, 3), {x: s.p[0], z: s.p[2], t0: g / 30 - 0.2, k: 0.6}]} focus={[xz[0], 0.5, 0]} ss={ss} amp={0.9} />
      <Fin g={g} />
      <Swimmer g={g} xz={xz} wl={470} cam={c.p} arms={run > 0.05 ? 'paddle' : 'tread'} armK={0.4 + 0.6 * run} face="fear" amp={0.9} kick={0.5 + 0.8 * run} lean={0.1 * run} look={run > 0.3 ? [1, 0.2] : look} />
    </>
  );
};
// ---------------------------------------------------------------- the imagined sequence: deeper teal, clear water, a vignette (see gradeImagine in OverboardSurvivor.tsx)
// 15 "Now imagine something even bigger," close on his face: he feels something, slowly looks down
export const E15: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['15'] + f, down = ramp(f, 26, 58), xz = swimXZ(g);
  return (<><Sea mode="imagine" g={g} ripples={rippleSrc(g)} focus={[xz[0], 0.5, xz[1]]} ss={ss} amp={0.7} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" armK={1 - 0.5 * down} face={f < 24 ? 'deadpan' : f < 46 ? 'confused' : 'fear'} amp={0.7} pitch={-0.62 * down} roll={0.04} extra={{headFwd: dirTo([xz[0], 0, xz[1]], c.p)}} /></>);
};
const Backdrop: React.FC<{y: number; r?: number}> = ({y, r = 120}) => { const map = React.useMemo(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d')!, g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, '#46C2BC'); g.addColorStop(0.6, '#23A0A8'); g.addColorStop(1, '#127F94'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 120; i++) { x.strokeStyle = `rgba(210,250,245,${0.05 + 0.07 * ((i * 37) % 10) / 10})`; x.lineWidth = 2; x.beginPath(); const cx = (i * 71) % 256, cy = (i * 113) % 256; x.ellipse(cx, cy, 6 + (i % 7) * 4, 3 + (i % 5) * 2, i, 0, 7); x.stroke(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }, []); return <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[r * 2, r * 2]} /><meshBasicMaterial map={map} toneMapped={false} /></mesh>; };
export const beastPos = (f: number): V3 => [mix(-13, 13, ramp(f, 0, 56)), -15, 0];
// 16 "something enormous sliding silently..." top-down: a huge pitch-dark mass passing slowly under the tiny man (clear water, the shape unclear)
export const E16: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['16'] + f, xz = swimXZ(g);
  return (<><Sea mode="imagine" g={g} ripples={rippleSrc(g)} focus={[xz[0], 0, xz[1]]} ss={ss} amp={0.5} clear={0.5} dome={false} /><Backdrop y={-32} /><Beast p={beastPos(f)} yaw={0.15} scale={1.3} sway={0.25 * Math.sin(f * 0.05)} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" face="fear" amp={0.5} /></>);
};
// 17 "...far below him." underwater camera below the man looking UP: he looks down at the camera with wide eyes, light rays behind him (low push-up)
export const E17: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['17'] + f, xz = swimXZ(g);
  return (<><UW g={g} ss={ss} mode="imagine" top="#2C9DB0" bot="#0C5A72" /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" face="shock" amp={0.5} lift={-1.3} pitch={-0.6} kick={0.25} extra={{shade: {color: '#2B93A8', k: 0.18}, headFwd: dirTo([xz[0], 0, xz[1]], c.p)}} /></>);
};
// 18 "Dark. Massive. Gone." the slow pull-back, far and deep: the huge dark silhouette fills the frame below, the man a tiny dot above it
export const beast18 = (f: number): V3 => [mix(-40, 52, ramp(f, 0, 100)), -17, 4];
export const E18: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['18'] + f, xz = swimXZ(g);
  return (<><UW g={g} ss={ss} mode="imagine" top="#35B5B2" bot="#1A92A4" /><Beast p={beast18(f)} yaw={0.1} scale={1.9} sway={0.3 * Math.sin(f * 0.06)} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" face="shock" amp={0.5} lift={-1.0} kick={0.2} extra={{shade: {color: '#2B93A8', k: 0.15}}} /></>);
};
// 19 "The sun comes up, and he's still swimming." sunrise reveal, push-in on his tired but determined face
export const E19: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['19'] + f, xz = swimXZ(g);
  return (<><Sea mode="dawn" g={g} ripples={rippleSrc(g)} focus={[xz[0], 0.5, xz[1]]} ss={ss} amp={0.6} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" armK={0.8} face={f < 40 ? 'annoyed' : 'deadpan'} amp={0.6} roll={0.05} lean={0.03} extra={{headFwd: dirTo([xz[0], 0, xz[1]], c.p)}} /></>);
};
// 20a "Back on the ship," cabin: the empty bunk, the sister worried
export const E20A: React.FC<Ctx> = ({f, c}) => {
  const g = START['20a'] + f, p: V3 = [0.35, 0, 0.1], bunk: V3 = [-1.45, 1.0, -0.8], look = dirTo(p, bunk);
  return (
    <>
      <hemisphereLight args={['#FFE9D0', '#9A7A5A', 2.3]} /><directionalLight color="#FFE2B0" intensity={0.9} position={[2, 4, 5]} /><WarmPoint p={[1.3, 1.6, -1.1]} i={10} d={7} />
      <Cabin />
      <Person role="sister" p={p} s={S} cam={c.p} pose={poseOf(p, c.p, {...idleExtra(g, 5, 0.6), hands: [[CX - 70, 470], [CX + 70, 470]], handsZ: [50, 50], face: f < 30 ? 'confused' : 'sad', headFwd: look, headPitch: 0.1, torsoFwd: dirTo(p, [p[0] - 1, 0, p[2] + 1.2]), lean: 0.03 * Math.sin(f * 0.2)})} />
    </>
  );
};
// 20b "...his sister realizes he never came back." reception: she talks to a crew member (arc)
export const E20B: React.FC<Ctx> = ({f, c}) => {
  const g = START['20b'] + f, sis: V3 = [-1.0, 0, 0.55], crew: V3 = [0.5, 0, -1.15], toCrew = dirTo(sis, [crew[0], 0, crew[2]]), toSis = dirTo(crew, [sis[0], 0, sis[2]]), hand = handTo('crew', 1, crew, {p: c.p, l: crew}, [0.62, 1.1, -0.62]);
  return (
    <>
      <hemisphereLight args={['#FFE9D0', '#9A7A5A', 2.3]} /><directionalLight color="#FFE2B0" intensity={0.9} position={[2, 4, 5]} /><WarmPoint p={[0, 2.2, 0.4]} i={10} d={7} />
      <Reception />
      <Person role="sister" p={sis} s={S} cam={c.p} pose={poseOf(sis, c.p, {...idleExtra(g, 2, 0.5), fwd: toCrew, torsoFwd: toCrew, headFwd: toCrew, face: 'fear', hands: [null, [CX + 120, 380 + 20 * Math.sin(f * 0.2)]], handsZ: [null, 60], headPitch: 0.05})} />
      <Person role="crew" p={crew} s={S} cam={c.p} pose={poseOf(crew, c.p, {...idleExtra(g, 7, 0.4), fwd: toSis, torsoFwd: toSis, headFwd: toSis, face: 'confused', hands: [null, hand.xy], handsZ: [null, hand.z], headDy: 4 * Math.sin(f * 0.14)})} />
    </>
  );
};
void clamp; void shipPos;
