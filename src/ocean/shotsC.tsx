// OVERBOARD_SURVIVOR takes 21 - 28b: the ship turns around, the tiny dot, the cargo ship, the helicopter and the rescue, the trophy, the end.
// MOTION (searched 2026-11-17: hoist rescue = the rescuer rides the cable down, the swimmer is brought into a strop and the two are lifted together, rescuer behind him; no frame counts anywhere, so all
// durations are estimates, untested). Binocular pose = both hands on the barrels in front of the eyes. A weak wave = one raised forearm swinging slowly.
import React from 'react';
import {V3} from '../kit/kit';
import {CX} from '../kit/rickRig';
import {Ctx, START, sm, ramp, mix, swimXZ, Sea, rippleSrc, idleExtra, WarmPoint} from './base';
import {Person, poseOf, dirTo, handPos, headPos} from './cast';
import {Swimmer, SWIM_S, swimP, Binoculars, binoAnchors, Splash, HIP_DROP, Rod, Sling, SLING} from './fx';
import {CruiseShip, ArcWake, CargoShip, Heli, CARGO_DECK, CARGO_RAIL_Z, HELI_HOOK, heliWorld} from './ships';
import {Stage, Trophy} from './interiors';
import {ringsFor} from './ocean';
import {handTo} from '../shop/shots';
import {B, Sp} from '../cobra/common';
import {Glow} from '../kit/finish';

const S = SWIM_S;
// 21 "The ship turns around and retraces its route," high wide: the ship carving a curved wake
export const ARC = {c: [0, -70] as [number, number], r: 60};
export const ARC_SHIP = 0.4;
export const arcAngle = (f: number) => mix(1.9, 3.6, sm(f / 84));
export const arcShip = (f: number): {p: V3; yaw: number; a: number} => { const a = arcAngle(f); return {p: [ARC.c[0] + ARC.r * Math.cos(a), 0, ARC.c[1] + ARC.r * Math.sin(a)], yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), a}; };
export const E21: React.FC<Ctx> = ({f, ss}) => {
  const g = START['21'] + f, s = arcShip(f);
  return (<><Sea mode="dawn" g={g} focus={[s.p[0], 3, s.p[2]]} ss={ss} amp={0.5} fogNear={110} fogFar={260} /><ArcWake c={ARC.c} r={ARC.r} a0={s.a - 0.02} a1={s.a - 1.5} w={3.2} /><CruiseShip p={s.p} yaw={s.yaw} deck={false} scale={ARC_SHIP} /></>);
};
// 22 "...but one person in a huge ocean is just a tiny dot." a very high push-DOWN toward the tiny man until he is centred
export const E22: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['22'] + f, xz = swimXZ(g);
  return (<><Sea mode="dawn" g={g} ripples={ringsFor(g / 30, (t0) => swimXZ(t0 * 30), 0.8, 1.0)} focus={[xz[0], 0, xz[1]]} ss={ss} amp={0.6} fogNear={170} fogFar={440} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" armK={0.7} face="deadpan" amp={0.6} /></>);
};
// ---------------------------------------------------------------- cargo ship
export const CARGO_P: V3 = [0, 0, -8];
export const sailorBase = (k: number): V3 => [CARGO_P[0] - 1.7 + 0.85 * k, CARGO_DECK + 0.1, CARGO_P[2] + CARGO_RAIL_Z - 1.2];
const SAILORS = ['sailor1', 'sailor2', 'sailor3'];
/** a sailor at the rail raising binoculars: both hands on the barrels (grip anchors), head turned toward `to` */
export function sailorPose(k: number, cam: V3, g: number, to: V3, up = 1) {
  const p = sailorBase(k), role = SAILORS[k], hd = headPos(role, p, S), d = dirTo(p, to), eye: V3 = [hd[0] + d[0] * 0.14, hd[1] - 0.07, hd[2] + d[1] * 0.14], anchors = binoAnchors(eye, d);
  const cm = {p: cam, l: p}, l = handTo(role, 0, p, cm, anchors[0]), r = handTo(role, 1, p, cm, anchors[1]);
  return {p, role, eye, d, anchors, pose: poseOf(p, cam, {...idleExtra(g, k * 3, 0.5), fwd: d, torsoFwd: d, headFwd: d, face: k === 1 ? 'deadpan' : 'confused', hands: up > 0.5 ? [l.xy, r.xy] : undefined, handsZ: up > 0.5 ? [l.z, r.z] : undefined, headPitch: -0.05})};
}
export const CargoStage: React.FC<{g: number; ss: number; cam: V3; sailors: number[]; to: V3; mode?: 'day'}> = ({g, ss, cam, sailors, to}) => (
  <>
    <Sea mode="day" g={g} focus={[0, 4, 0]} ss={ss} amp={0.55} />
    <CargoShip p={CARGO_P} />
    {sailors.map((k) => { const s = sailorPose(k, cam, g, to); return (<React.Fragment key={k}><Person role={s.role} p={s.p} s={S} cam={cam} pose={s.pose} /><Binoculars p={s.eye} d={s.d} /></React.Fragment>); })}
  </>
);
const DOT: V3 = [0, 0, 36];
// 23a "Almost 20 hours later," cargo ship side view, sailors at the rail with binoculars (truck)
export const E23A: React.FC<Ctx> = ({f, c, ss}) => <CargoStage g={START['23a'] + f} ss={ss} cam={c.p} sailors={[0, 1, 2]} to={DOT} />;
// 23b "a cargo ship crew spots" close on a sailor's face behind the binoculars
export const E23B: React.FC<Ctx> = ({f, c, ss}) => <CargoStage g={START['23b'] + f} ss={ss} cam={c.p} sailors={[1, 0, 2]} to={DOT} />;
// 23c "a person," a push to the dot waving weakly
export const E23C: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['23c'] + f, xz = swimXZ(g);
  return (<><Sea mode="day" g={g} ripples={rippleSrc(g)} focus={[xz[0], 0.5, xz[1]]} ss={ss} amp={0.5} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="wave" face="deadpan" amp={0.5} lean={0.04} /></>);
};
// 24 "still alive." close on his tired face, relief
export const E24: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['24'] + f, xz = swimXZ(g);
  return (<><Sea mode="day" g={g} ripples={rippleSrc(g)} focus={[xz[0], 0.5, xz[1]]} ss={ss} amp={0.5} /><Swimmer g={g} xz={xz} wl={470} cam={c.p} arms="tread" armK={0.6} face={f < 16 ? 'annoyed' : f < 28 ? 'deadpan' : 'happyArc'} amp={0.5} roll={0.05} extra={{headFwd: dirTo([xz[0], 0, xz[1]], c.p)}} /></>);
};
// ---------------------------------------------------------------- the rescue
export const HELI_P = (g: number): V3 => [0.5 + 0.12 * Math.sin(g * 0.05), 17.5 + 0.18 * Math.sin(g * 0.07), 0.3];
export const hookWorld = (g: number, cable: number): V3 => { const h = HELI_P(g); return [h[0] + HELI_HOOK[0], h[1] + HELI_HOOK[1] - cable, h[2] + HELI_HOOK[2]]; };
const wash = (g: number) => ringsFor(g / 30, () => [0.5, 0.3], 0.3, 1.8);
// 25 "A helicopter lowers a rescuer" the helicopter arrives (low angle, rotor), the rescuer descends on the rope (crane)
export const HELI_YAW = 0.3;
export const rescuerRide = (f: number) => ({cable: mix(4.2, 14.6, sm(f / 56))});
/** The rescuer HANGS FROM the rope: the cable runs from the winch tip straight down to a carabiner on a short strap clipped to his chest D-ring; the carabiner sits 0.26 m to the card-right of his chest centre,
 *  so the rope passes right next to his body (clear of his face). Right hand grips the rope just above the carabiner, left hand the D-ring of the harness. Legs hang. */
export function rescuerSetup(g: number, f: number, cam: V3) {
  const hp = HELI_P(g), tip = heliWorld(hp, HELI_YAW, HELI_HOOK), cable = rescuerRide(f).cable, cw: V3 = [tip[0], tip[1] - cable, tip[2]];
  let yaw = Math.atan2(cam[0] - cw[0], cam[2] - cw[2]), p: V3 = cw;
  for (let k = 0; k < 2; k++) { const rt: [number, number] = [Math.cos(yaw), -Math.sin(yaw)], tw: [number, number] = [Math.sin(yaw), Math.cos(yaw)]; p = [cw[0] - rt[0] * 0.26 - tw[0] * 0.07, cw[1] - 1.26, cw[2] - rt[1] * 0.26 - tw[1] * 0.07]; yaw = Math.atan2(cam[0] - p[0], cam[2] - p[2]); }
  const rt: [number, number] = [Math.cos(yaw), -Math.sin(yaw)], tw: [number, number] = [Math.sin(yaw), Math.cos(yaw)], dring: V3 = [p[0] + tw[0] * 0.07, p[1] + 1.2, p[2] + tw[1] * 0.07], rope: V3 = [cw[0], cw[1] + 0.12, cw[2]], sc = {p: cam, l: p};
  const R = handTo('rescuer', 1, p, sc, rope), L = handTo('rescuer', 0, p, sc, dring);
  return {hp, tip, cable, cw, p, yaw, dring, rope, pose: poseOf(p, cam, {hands: [L.xy, R.xy], handsZ: [L.z, R.z], face: 'deadpan', legSw: [0.1 * Math.sin(f * 0.12), -0.1 * Math.sin(f * 0.12)], bend: [0.3, 0.1], lean: 0.02 * Math.sin(f * 0.1)})};
}
export const E25: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['25'] + f, r = rescuerSetup(g, f, c.p);
  return (
    <>
      <Sea mode="day" g={g} ripples={wash(g)} focus={[0, 5, 0]} ss={ss} amp={0.7} />
      <Heli p={r.hp} yaw={HELI_YAW} f={g} cable={r.cable} />
      <Person role="rescuer" p={r.p} s={S} cam={c.p} pose={r.pose} noCane />
      <group position={r.p} rotation={[0, r.yaw, 0]}><mesh position={[0, SLING.chest, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]}><torusGeometry args={[0.2, 0.032, 8, 24]} /><meshToonMaterial color="#F2A31A" /></mesh></group>
      <Rod a={r.dring} b={[r.cw[0], r.cw[1] - 0.05, r.cw[2]]} r={0.022} c="#F2A31A" />
      <mesh position={r.cw}><boxGeometry args={[0.05, 0.12, 0.04]} /><meshToonMaterial color="#E8B23A" /></mesh>
    </>
  );
};
// 26 "and pulls him out." the man hangs INSIDE the sling (shoulder straps over his shoulders, seat loop under him), the hook above his head, the rescuer beside him with both hands on the sling anchors
export const liftOf = (f: number) => 1.25 * sm(f / 36);
export function liftSetup(g: number, f: number, cam: V3) {
  const lift = liftOf(f), xz: [number, number] = [swimXZ(g)[0], 0], base = swimP(g, xz, 470, 0.5, 0), m: V3 = [base[0], base[1] + lift + 0.34, base[2]], r: V3 = [m[0] + 0.4, m[1] + 0.1, m[2] - 0.12];
  const yaw = Math.atan2(cam[0] - m[0], cam[2] - m[2]), ch = m[1] + SLING.chest, scm = {p: cam, l: m}, scr = {p: cam, l: r}, ring: V3 = [m[0], m[1] + SLING.ring, m[2] - 0.07];
  const anc: V3[] = [[m[0] - 0.12, ch, m[2] + 0.115], [m[0] + 0.12, ch, m[2] + 0.115]], ranc: V3[] = [[m[0] + 0.08, ch + 0.1, m[2] + 0.1], [m[0] + 0.22, ch, m[2] + 0.08]];
  const hm = [handTo('survivor', 0, m, scm, anc[0]), handTo('survivor', 1, m, scm, anc[1])], hr = [handTo('rescuer', 0, r, scr, ranc[0]), handTo('rescuer', 1, r, scr, ranc[1])];
  return {m, r, yaw, ring, anc, ranc, ch, lift, mPose: poseOf(m, cam, {hands: [hm[0].xy, hm[1].xy], handsZ: [hm[0].z, hm[1].z], face: 'happyArc', legSw: [0.15 * Math.sin(f * 0.2), -0.15 * Math.sin(f * 0.2)], bend: [0.4, 0.2], lean: 0.03 * Math.sin(f * 0.15)}), rPose: poseOf(r, cam, {hands: [hr[0].xy, hr[1].xy], handsZ: [hr[0].z, hr[1].z], face: 'deadpan', legSw: [0.1, -0.1]})};
}
export const E26: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['26'] + f, t = liftSetup(g, f, c.p), rd: V3 = [t.r[0], t.r[1] + 1.26, t.r[2] + 0.07];
  return (
    <>
      <Sea mode="day" g={g} ripples={wash(g)} focus={[t.m[0], 1, t.m[2]]} ss={ss} amp={0.5} />
      <Person role="rescuer" p={t.r} s={S} cam={c.p} pose={t.rPose} noCane />
      <Person role="survivor" p={t.m} s={S} cam={c.p} pose={t.mPose} />
      <Sling p={t.m} yaw={t.yaw} />
      <Rod a={t.ring} b={[t.ring[0], t.ring[1] + 16, t.ring[2]]} r={0.022} />
      <Rod a={rd} b={[t.ring[0] + 0.02, t.ring[1] + 0.02, t.ring[2]]} r={0.02} c="#F2A31A" />
      <Splash p={[t.m[0], 0, t.m[2]]} age={f / 30 - 0.05} size={0.5} />
    </>
  );
};
// 27 "The guy who vanished after winning an air guitar contest" the hero trophy close-up, a truck along it
export const E27: React.FC<Ctx> = ({f}) => {
  const g = START['27'] + f;
  return (
    <>
      <hemisphereLight args={['#FFE9D0', '#7A5A6A', 1.5]} /><directionalLight color="#FFD9B0" intensity={0.9} position={[-4, 8, 6]} /><WarmPoint p={[0.4, 3.2, -4]} color="#FFD9A0" i={6} d={9} />
      <Stage f={g} />
      <B p={[0, 1.25, -4.7]} s={[0.56, 0.9, 0.56]} c="#F2EEE6" /><B p={[0, 1.72, -4.7]} s={[0.64, 0.06, 0.64]} c="#E8B23A" cast={false} /><B p={[0, 0.83, -4.7]} s={[0.64, 0.06, 0.64]} c="#E8B23A" cast={false} />
      <Trophy p={[0, 1.75, -4.7]} s={1.2} spin={0.35 * Math.sin(f * 0.04)} />
    </>
  );
};
// 28a "survived almost a day alone" final wide of the calm daytime ocean with the helicopter tiny
export const heliAway = (f: number): V3 => [mix(-4, 6, sm(f / 63)), mix(18, 26, sm(f / 63)), mix(-30, -95, sm(f / 63))];
export const E28A: React.FC<Ctx> = ({f, ss}) => {
  const g = START['28a'] + f;
  return (<><Sea mode="day" g={g} focus={[0, 5, -40]} ss={ss} amp={0.45} /><Heli p={heliAway(f)} yaw={Math.PI / 2} f={g} tilt={0.05} /></>);
};
// 28b "in the Gulf of Mexico." last close on his smile, hard hold: he stands in the helicopter door wrapped in a foil blanket
export const E28B: React.FC<Ctx> = ({f, c}) => {
  const g = START['28b'] + f, p: V3 = [0, 0.02, 0], chest = (975 - 380) * 0.0021 * S;
  return (
    <>
      <hemisphereLight args={['#FFF3D6', '#8A6A50', 2.6]} /><directionalLight color="#FFE2B0" intensity={1.2} position={[-3, 5, 6]} />
      <B p={[0, 1.2, -1.2]} s={[4.6, 3.2, 0.1]} c="#5E7C8A" cast={false} /><B p={[-1.9, 1.2, -0.2]} s={[0.4, 3.2, 2.2]} c="#6F8C98" /><B p={[1.9, 1.2, -0.2]} s={[0.4, 3.2, 2.2]} c="#6F8C98" /><B p={[0, 2.8, -0.2]} s={[4.6, 0.3, 2.2]} c="#E4E6E0" cast={false} /><B p={[0, 0.0, -0.2]} s={[4.6, 0.1, 2.4]} c="#8A9AA4" cast={false} />
      <mesh position={[0, 1.7, -1.14]}><circleGeometry args={[0.55, 24]} /><meshBasicMaterial color="#9ADBEE" toneMapped={false} /></mesh><B p={[0, 1.7, -1.13]} s={[1.2, 1.2, 0.02]} c="#B9C9CE" cast={false} basic />
      <B p={[1.2, 0.5, -0.6]} s={[0.1, 1.0, 0.8]} c="#E0302A" cast={false} /><B p={[-1.2, 0.5, -0.6]} s={[0.1, 1.0, 0.8]} c="#E0302A" cast={false} />
      <Person role="survivor" p={p} s={S} cam={c.p} pose={poseOf(p, c.p, {...idleExtra(g, 4, 0.5), face: f < 14 ? 'happyArc' : 'thrilled', hands: [[CX - 90, 470], [CX + 90, 470]], handsZ: [60, 60], headRoll: 0.05, lean: 0.015 * Math.sin(f * 0.1)})} />
      <Glow p={[0.5, 1.6, 0.5]} size={2.2} color="#FFE2B0" intensity={0.5} />
    </>
  );
};
void CruiseShip; void HIP_DROP; void handPos;
