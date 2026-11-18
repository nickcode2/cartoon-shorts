// ZUMBIS_PARTE_10: the shot bodies. Each body is a function of its local frame f (0 .. n-1) and the global start frame g of the shot (t = (g + f) / 30 = seconds of the trimmed narration).
// MOTION SOURCES (searched 2026-11-17, see STYLE_NOTES "ZUMBIS_PARTE_10"): panicked run = distance-driven gait (kit rule), forward body lean, arms driving; stumble + catch = loss of balance (lean, flailing
// arms, one foot hooked), the helper stops, turns, grips the forearm and pulls (weight shift back); bat flap = downstroke leads, the tip lags the root (travelling wave). Frame counts are estimates, untested.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Pose, V3, hash, makeTex} from '../kit/kit';
import {BounceEvent, bounceAt} from '../kit/bounce';
import {CX, FaceName, RickPose, worldToCardLocal, yawTo} from '../kit/rickRig';
import {S, blendDir, clamp, gaitR, handTo, kf, mix, seg, stepBounce, sway} from '../shop/shots';
import {CROWD, Person, dirTo, handPos, poseOf} from './cast';
import {C} from './common';
import {City, DOOR_Z, HALL, HALL_X, Hall, SPOTS, TOWER_Z} from './sets';
import {DustCloud, GlassBurst, Radio, RADIO_GRIPS, RADIO_H, Sparks, doorHandle, radioGrip} from './props';
import {MAX_ZOMBIES, ZState, ZombieSwarm, bodyWorld, norm3} from './zombie';
import {FLAP, Path, WALL, chasers, faller, stateOf, wallState, wallStates, SWIRL_C} from './swarm';
import {FORM, FOUR_T0, OTHERS_STOP_Z, BRUNO_STOP_Z, RUN_BACK_T, STOP_T, T_STOP_B, T_STOP_O, brunoBack, brunoDist, cutT, fourPos, groupDist, groupPos, runK, sstep, tStop} from './story';

export type Ctx = {f: number; n: number; c: Pose; ss: number; g: number};
export const tOf = (x: Ctx) => (x.g + x.f) / 30;
const PH: Record<string, number> = {caio: 0, ana: 0.3, bruno: 0.55, davi: 0.15, lia: 0.7};
const lerp3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ---------------------------------------------------------------- helpers
const leanOf = (p: V3, c: Pose, dir: [number, number]) => { const yaw = yawTo(c.p, p); return dir[0] * Math.cos(yaw) - dir[1] * Math.sin(yaw); };
/** A running pose: distance-driven gait (k scales the swing), the body leans into the run, arms drive, step bounce. */
export function runPose(role: string, p: V3, dir: [number, number], c: Pose, dist: number, k: number, f: number, n: number, face: FaceName, extra: Partial<RickPose> = {}): RickPose {
  return poseOf(p, c.p, {fwd: dir, torsoFwd: dir, headFwd: dir, ...gaitR(role, dist, 0.55, k, PH[role] ?? 0), lean: 0.13 * leanOf(p, c, dir) * k, face, bounce: stepBounce(f, 0, n, 11, role), ...extra});
}
/** Card slot (0 = card-left hand, 1 = card-right hand) that is nearer to a world point. */
export const slotFor = (role: string, p: V3, c: Pose, w: V3): number => (worldToCardLocal(w, p, yawTo(c.p, p), S)[0] < CX ? 0 : 1);
/** hands array with one hand on a world point (the other hangs). */
export function oneHand(role: string, p: V3, c: Pose, w: V3, slot?: number): Pick<RickPose, 'hands' | 'handsZ'> {
  const sl = slot ?? slotFor(role, p, c, w), h = handTo(role, sl, p, c, w);
  return sl === 0 ? {hands: [h.xy, null], handsZ: [h.z, null]} : {hands: [null, h.xy], handsZ: [null, h.z]};
}
export const Walker: React.FC<{role: string; p: V3; pose: RickPose; c: Pose}> = ({role, p, pose, c}) => <Person role={role} p={p} s={S} cam={c.p} pose={pose} noCane />;
/** Standing character: weight shift, breathing sway, arms hang with a small elbow bend; faces a point. */
export const Stand: React.FC<{role: string; p: V3; c: Pose; f: number; face?: FaceName; look?: V3; fwd?: [number, number]; ph?: number; extra?: Partial<RickPose>; hands?: RickPose['hands']; handsZ?: RickPose['handsZ']}> = ({role, p, c, f, face = 'deadpan', look, fwd, ph = 0, extra, hands, handsZ}) => {
  const d = fwd ?? (look ? dirTo(p, look) : dirTo(p, c.p));
  const pose = poseOf(p, c.p, {fwd: d, torsoFwd: d, headFwd: look ? dirTo(p, look) : d, headDx: sway(f, ph), lean: 0.012 * Math.sin(f * 0.05 + ph), face, hands, handsZ, armSw: [0.035 * Math.sin(f * 0.045 + ph), -0.035 * Math.sin(f * 0.045 + ph + 1.3)], ...extra});
  return <Person role={role} p={p} s={S} cam={c.p} pose={pose} />;
};
const World: React.FC<{x: Ctx; rain?: number; at?: V3}> = ({x, rain = 0, at}) => <City f={x.g + x.f} t={tOf(x)} rain={rain} at={at ?? [0, 0, groupPos('caio', tOf(x))[2]]} ss={x.ss} />;
const Z: React.FC<{states: ZState[]; x: Ctx}> = ({states, x}) => <ZombieSwarm states={states} t={tOf(x)} cam={x.c.p} />;
/** The five runners (some of them), position and run pose from the shared story paths. */
const Runners: React.FC<{x: Ctx; roles?: string[]; xShift?: number; faces?: Record<string, FaceName>; skip?: string[]}> = ({x, roles = ['caio', 'ana', 'bruno', 'davi', 'lia'], xShift = 0, faces = {}, skip = []}) => {
  const t = tOf(x);
  return (<>{roles.filter((r) => !skip.includes(r)).map((r) => {
    const p = groupPos(r, t, xShift), k = runK(t, tStop(r)), pose = runPose(r, p, [0, -1], x.c, groupDist(r, t), k, x.f, x.n, faces[r] ?? (r === 'bruno' ? 'grimace' : r === 'davi' ? 'shock' : 'fear'), k < 0.05 ? {armSw: [0.04, -0.04]} : {});
    return <Walker key={r} role={r} p={p} pose={pose} c={x.c} />;
  })}</>);
};
const cum = (fn: (f: number) => V3, f: number): number => { let d = 0, p = fn(0); for (let i = 1; i <= f; i++) { const q = fn(i); d += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; } return d; };

// ================================================================= 1 (avenue A, low front angle): the group runs toward the camera, the sky full of zombies diving behind them
export const E1: React.FC<Ctx> = (x) => {
  const t = tOf(x), anchor = (tt: number) => groupPos('caio', tt), ch = chasers(t, 30, 3, anchor, {behind: 16, height: 10, dive: 6}),
    pass: ZState[] = [0, 1, 2].map((i) => stateOf({pos: (tt) => [(i - 1) * 4.2 + Math.sin(tt * 0.7 + i), 7.5 + i * 1.3, anchor(tt)[2] + 18 - 13.5 * (tt - 0.5 - i * 0.6)], aim: (tt) => [(i - 1) * 4.2, 1, anchor(tt)[2] - 30], s: 1.05, ph: i * 2, amp: 0.6}, t));
  return (<><World x={x} /><Runners x={x} /><Z states={[...ch, ...pass]} x={x} /></>);
};

// ================================================================= 2 (avenue B): claws scrape the asphalt, sparks fly (low push-in)
const SCRAPER_S = 1.5, SCRAPE_PITCH = 0.3;
export const scraper = (t: number): ZState => { const s = stateOf({pos: (tt) => [0.5 + 0.25 * Math.sin(tt * 0.8), 0.61, 6 - 9.2 * (tt - cutT('2'))], aim: (tt) => [0.5, 0, 6 - 9.2 * (tt - cutT('2')) - 5], s: SCRAPER_S, ph: 1.3, amp: 0.45, freq: 11}, t); const f = norm3([s.fwd[0], s.fwd[1] - Math.sin(SCRAPE_PITCH), s.fwd[2]]); return {...s, fwd: f}; };
/** Gouges left on the asphalt by a scraping claw: a thin pale line from the claw tip back along the path (additive gradient). */
const Scratch: React.FC<{x: number; z: number; len: number}> = ({x, z, len}) => { const tex = useMemo(() => makeTex(16, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(w * 0.3, 0, w * 0.4, h); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 1, 5 + hash(i, 3) * 12); } }), []); return <mesh position={[x, 0.012, z + len / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.16, Math.max(0.1, len)]} /><meshBasicMaterial map={tex} color={C.lav} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>; };
export const E2: React.FC<Ctx> = (x) => {
  const t = tOf(x), z0 = scraper(t), tip = bodyWorld(z0, [0.0, -0.2, 0.72]), back = [0, 1] as [number, number], others = chasers(t, 6, 9, (tt) => [0.5, 0, 6 - 9.2 * (tt - cutT('2'))], {behind: 14, height: 8, dive: 2, wide: 6});
  return (<><World x={x} at={[0, 0, tip[2]]} /><Z states={[z0, ...others]} x={x} /><Sparks p={[tip[0] - 0.2, 0.03, tip[2]]} dir={back} t={t} on={1} /><Sparks p={[tip[0] + 0.2, 0.03, tip[2]]} dir={back} t={t + 0.2} on={1} n={60} />{[-0.17, 0.17].map((sx) => { const w = bodyWorld(z0, [sx, -0.2, 0.7]); return <Scratch key={sx} x={w[0]} z={w[2]} len={Math.min(9, 6 - w[2])} />; })}</>);
};

// ================================================================= 3 (avenue C): glass bursts out of the windows beside the runners (a zombie smashes out of the hero window), crane
export const WIN3 = {x: -11.88, y: 4.7, z: -46.5, t0: cutT('3') + 0.9};
const HeroWindow: React.FC<{t: number}> = ({t}) => {
  const broken = t >= WIN3.t0;
  return (<group position={[WIN3.x, WIN3.y, WIN3.z]}>
    <mesh position={[-0.02, 0, 0]}><boxGeometry args={[0.4, 3.9, 3.7]} /><meshToonMaterial color="#4A2B8F" /></mesh>
    <mesh position={[0.2, 0, 0]}><boxGeometry args={[0.2, 3.3, 3.1]} /><meshBasicMaterial color={broken ? '#0F0D2E' : '#6C42B8'} /></mesh>
    {!broken && [-0.78, 0.78].map((z) => <mesh key={z} position={[0.32, 0, z]}><boxGeometry args={[0.06, 3.3, 0.1]} /><meshToonMaterial color="#4A2B8F" /></mesh>)}
    {broken && Array.from({length: 7}, (_, i) => <mesh key={i} position={[0.3, -1.45, -1.3 + i * 0.43]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.1, 0.5 + 0.3 * hash(i, 5), 4]} /><meshToonMaterial color="#C9C4EE" /></mesh>)}
    {broken && <mesh position={[0.26, 0, 0]}><boxGeometry args={[0.04, 2.8, 2.6]} /><meshBasicMaterial color="#F28A3C" transparent opacity={0.35} /></mesh>}
  </group>);
};
export const E3: React.FC<Ctx> = (x) => {
  const t = tOf(x), sh = -4.6, ch = chasers(t, 8, 5, (tt) => groupPos('caio', tt, sh), {behind: 22, height: 9, dive: 3});
  const burst: Path = {pos: (tt) => { const u = Math.max(0, tt - WIN3.t0) / 1.6, e = Math.min(1, u), px = WIN3.x + 7.4 * (1 - (1 - e) * (1 - e)), pz = WIN3.z - 9 * e * e * 1.4, py = WIN3.y - 1.6 * e + 0.5 * Math.sin(Math.PI * e); return [px, py, pz]; }, aim: [-4, 3, -52], s: 1.1, ph: 0.5, amp: 0.7, vis: (tt) => (tt >= WIN3.t0 - 0.02 ? 1 : 0)};
  const zb = stateOf(burst, t);
  return (<><World x={x} at={[-6, 0, -46]} /><HeroWindow t={t} /><Runners x={x} xShift={sh} /><GlassBurst p={[WIN3.x + 0.3, WIN3.y, WIN3.z]} dir={[1, -0.3]} t={t} t0={WIN3.t0} n={80} seed={4} /><Z states={[...ch, zb]} x={x} /></>);
};

// ================================================================= 4 (avenue D): Ana trips, Caio stops, turns back and grabs her right arm, pulls her up, they run on (side truck)
const T4 = cutT('4');
const f4 = (f: number) => (f / 30) + T4;
export const AC = {a: (f: number): V3 => { const t = f4(f), z0 = groupPos('ana', T4)[2], run = 5.2, tT = 26 / 30; const u = Math.min(f, 26) / 30, zRun = z0 - run * u, after = kf(f, [[26, 0], [48, 1.1], [200, 1.1]]), go = kf(f, [[84, 0], [104, 1.0], [300, 1.0]]), zGo = Math.max(0, f - 84) / 30; void t; void tT; return [-1.05 + 0.1 * Math.sin(Math.min(1, Math.max(0, (f - 26) / 20)) * Math.PI), 0, zRun - after - 5.2 * go * (zGo - 0.2 * (1 - go))]; },
  c: (f: number): V3 => { const z0 = groupPos('caio', T4)[2], u = Math.min(f, 26) / 30, zRun = z0 - 5.2 * u, brake = kf(f, [[26, 0], [44, 1.25], [300, 1.25]]), back = kf(f, [[48, 0], [60, 0.55], [300, 0.55]]), go = kf(f, [[84, 0], [104, 1.0], [300, 1.0]]), zGo = Math.max(0, f - 84) / 30, x = kf(f, [[0, 0], [30, 0], [62, -0.62], [84, -0.62], [110, -0.1]]); return [x, 0, zRun - brake + back - 5.2 * go * (zGo - 0.2 * (1 - go))]; }};
export function poses4(f: number, n: number, c: Pose) {
  const pa = AC.a(f), pc = AC.c(f);
  const trip = seg(f, 24, 36), slump = seg(f, 36, 50) * (1 - seg(f, 62, 84)), go = seg(f, 84, 104), turn = seg(f, 40, 56) * (1 - seg(f, 80, 92));
  const mvA = f < 26 ? 1 : 1 - seg(f, 36, 52) + 0.9 * go, mvC = f < 26 ? 1 : (f < 60 ? Math.max(0.0, 1 - seg(f, 28, 46)) : 0) + go;
  const distA = cum(AC.a, f), distC = cum(AC.c, f), grab = seg(f, 52, 62) * (1 - seg(f, 90, 100));
  const H: V3 = [(pa[0] + pc[0]) / 2, 1.0 + 0.1 * Math.sin(Math.min(1, seg(f, 62, 84)) * Math.PI), (pa[2] + pc[2]) / 2];
  const slotA = slotFor('ana', pa, c, H), slotC = slotFor('caio', pc, c, H);
  const ana = runPose('ana', pa, [0, -1], c, distA, Math.min(1, mvA), f, n, f < 24 ? 'fear' : f < 100 ? 'shock' : 'fear', {
    lean: 0.3 * trip * (1 - seg(f, 60, 84)), crouch: 0.45 * slump, headRoll: 0.2 * trip * (1 - seg(f, 70, 90)), headDy: 6 * slump,
    ...(grab > 0.05 ? oneHand('ana', pa, c, H, slotA) : trip > 0.05 && f < 62 ? {hands: [[CX - 160, 330 + 30 * Math.sin(f * 0.6)], [CX + 150, 340 - 25 * Math.sin(f * 0.6)]] as RickPose['hands'], handsZ: [30, 30] as RickPose['handsZ']} : {})});
  const caio = runPose('caio', pc, turn > 0.5 ? [0, 1] : [0, -1], c, distC, Math.min(1, mvC), f, n, f < 30 ? 'fear' : 'shock', {
    torsoFwd: blendDir([0, -1], [0, 1], turn), headFwd: blendDir([0, -1], dirTo(pc, pa), seg(f, 30, 46)), lean: 0.1 * go - 0.18 * grab * (leanOf(pc, c, [0, 1]) >= 0 ? 1 : -1), headRoll: 0.06 * grab,
    ...(grab > 0.05 ? oneHand('caio', pc, c, H, slotC) : {})});
  return {ana, caio, pa, pc, H, grab, slotA, slotC};
}
export const E4: React.FC<Ctx> = (x) => {
  const t = tOf(x), f = x.f, n = x.n, {ana, caio, pa, pc} = poses4(f, n, x.c);
  const bruno = runPose('bruno', [1.5, 0, pa[2] - 6.2 - 5.2 * Math.max(0, f - 40) / 30 * 0.4], [0, -1], x.c, groupDist('bruno', t), 1, f, n, 'grimace'), davi = runPose('davi', [-2.2, 0, pa[2] + 3.4], [0, -1], x.c, groupDist('davi', t), 1, f, n, 'shock'), lia = runPose('lia', [2.4, 0, pa[2] + 4.4], [0, -1], x.c, groupDist('lia', t), 1, f, n, 'fear');
  const ch = chasers(t, 10, 11, () => [0, 0, pc[2] + 6], {behind: 20, height: 9, dive: 3});
  return (<><World x={x} at={[0, 0, pc[2]]} />
    <Walker role="ana" p={pa} pose={ana} c={x.c} /><Walker role="caio" p={pc} pose={caio} c={x.c} />
    <Walker role="bruno" p={[1.5, 0, pa[2] - 6.2 - 5.2 * Math.max(0, f - 40) / 30 * 0.4]} pose={bruno} c={x.c} /><Walker role="davi" p={[-2.2, 0, pa[2] + 3.4]} pose={davi} c={x.c} /><Walker role="lia" p={[2.4, 0, pa[2] + 4.4]} pose={lia} c={x.c} />
    <Z states={ch} x={x} /></>);
};

// ================================================================= 5 (tower A): reveal of the golden tower (tilt up + crane), the wall of zombies already hovering round its base (tiny)
export const E5: React.FC<Ctx> = (x) => <><World x={x} at={[0, 0, TOWER_Z + 30]} /><Z states={wallStates(tOf(x))} x={x} /></>;

// ================================================================= 6 (tower B): a wall of zombies hovering round the base of the tower, facing outward
export const E6: React.FC<Ctx> = (x) => <><World x={x} at={[0, 0, TOWER_Z + 30]} /><Z states={wallStates(tOf(x))} x={x} /></>;

// ================================================================= 7 (march A): Bruno stops mid-run, the others run on one more step
export const E7: React.FC<Ctx> = (x) => <><World x={x} at={[0, 0, groupPos('bruno', tOf(x))[2]]} /><Runners x={x} faces={{bruno: 'deadpan'}} /><Z states={wallStates(tOf(x)).filter((_, i) => i % 3 === 0)} x={x} /></>;

// ================================================================= 8 (march B): close push-in on Bruno's face, calm and determined, he looks at the group
export const E8: React.FC<Ctx> = (x) => {
  const t = tOf(x), p = groupPos('bruno', cutT('7') + 0.75 + 0.0), face: FaceName = x.f < 14 ? 'deadpan' : 'annoyed', look = seg(x.f, 6, 20) * (1 - seg(x.f, 38, 56));
  const g = groupPos('davi', t), pose = poseOf(p, x.c.p, {fwd: dirTo(p, x.c.p), torsoFwd: dirTo(p, x.c.p), headFwd: blendDir(dirTo(p, x.c.p), dirTo(p, [g[0] - 3, 1.4, g[2] + 6]), 0.7 * look), headDx: sway(x.f), headRoll: 0.04 * look, face, lean: 0.01, hands: [[CX - 62, 590], [CX + 62, 590]], handsZ: [0, 0]});
  const z = groupPos('davi', cutT('7') + 0.75);
  return (<><World x={x} at={[0, 0, p[2]]} /><Walker role="bruno" p={p} pose={pose} c={x.c} /><Stand role="davi" p={[z[0] - 0.2, 0, p[2] - 3.5]} c={x.c} f={x.f} face="fear" look={[p[0], 1.3, p[2]]} /></>);
};

// ================================================================= 9a (march C): the old radio, hero close-up: a hand turns the knob, sound-wave rings
export const BRUNO9 = (): V3 => [FORM.bruno[0], 0, BRUNO_STOP_Z];
export const radioPose9 = (c: Pose): {p: V3; ry: number} => { const b = BRUNO9(), ry = yawTo(c.p, [b[0], 0, b[2] + 0.4]); return {p: [b[0] - 0.02, 0.8, b[2] + 0.26], ry}; };
export function pose9a(f: number, c: Pose) {
  const b = BRUNO9(), {p: rp, ry} = radioPose9(c), hh = radioGrip(rp, ry, 'handle'), hk = radioGrip(rp, ry, 'knob');
  const a = handTo('bruno', 0, b, c, hh), k = handTo('bruno', 1, b, c, hk), turn = 0.02 * Math.sin(f * 0.5) * seg(f, 14, 48);
  const pose = poseOf(b, c.p, {fwd: dirTo(b, c.p), torsoFwd: dirTo(b, c.p), headFwd: dirTo(b, c.p), hands: [a.xy, k.xy], handsZ: [a.z, k.z], headDx: sway(f), headDy: 8 * seg(f, 10, 30), face: f < 40 ? 'deadpan' : 'annoyed', lean: 0.01 + turn, bounce: bounceAt([{kind: 'reach', f0: 10, k: 0.5}, {kind: 'reach', f0: 22, k: 0.3}], f, 30, 1)});
  return {pose, b, rp, ry, handle: hh, knob: hk};
}
export const E9A: React.FC<Ctx> = (x) => {
  const t = tOf(x), {pose, b, rp, ry} = pose9a(x.f, x.c), knob = 2.4 * seg(x.f, 14, 48), level = x.f >= 24 ? 1 : 0, o = groupPos('davi', cutT('7') + 1.0);
  return (<><World x={x} at={[0, 0, b[2]]} /><Walker role="bruno" p={b} pose={pose} c={x.c} /><Radio p={rp} ry={ry} knob={knob} level={level} t={t} />
    <Stand role="davi" p={[o[0] - 0.3, 0, b[2] - 3.8]} c={x.c} f={x.f} face="fear" look={[b[0], 1.2, b[2]]} /><Stand role="lia" p={[o[0] + 1.4, 0, b[2] - 4.6]} c={x.c} f={x.f} face="shock" look={[b[0], 1.2, b[2]]} ph={2} />
    <Z states={wallStates(t).filter((_, i) => i % 4 === 0)} x={x} /></>);
};

// ================================================================= 9b (march D): arc-in to Bruno running the other way (+z), the radio swinging from his hand
export const BRUNO_RADIO_HANG = (hand: V3, ry: number): V3 => { const g = RADIO_GRIPS.handle; return [hand[0] - g[0] * Math.cos(ry) - g[2] * Math.sin(ry), hand[1] - g[1], hand[2] + g[0] * Math.sin(ry) - g[2] * Math.cos(ry)]; };
export function pose9b(f: number, n: number, g: number, c: Pose) {
  const t = (g + f) / 30, p = brunoBack(t), prev = brunoBack(t - 0.05), dir = norm3([p[0] - prev[0], 0, p[2] - prev[2]]), d2: [number, number] = [dir[0], dir[2]], ry = yawTo(c.p, p);
  const slot = slotFor('bruno', p, c, [p[0] + 0.3, 1.1, p[2]]), dist = brunoDist(t), k = Math.min(1, (t - RUN_BACK_T) / 0.6 + 0.2);
  const hang: V3 = [p[0] + (slot === 1 ? 0.3 : -0.3), 0.9, p[2] + 0.05 * Math.sin(dist * 4.0)], hnd = handTo('bruno', slot, p, c, hang);
  const pose = runPose('bruno', p, d2, c, dist, k, f, n, 'grimace', {headFwd: blendDir(d2, dirTo(p, [FORM.bruno[0] - 6, 1.4, BRUNO_STOP_Z - 14]), 0.35 * (1 - seg(f, 10, 40))), ...(slot === 0 ? {hands: [hnd.xy, null], handsZ: [hnd.z, null]} : {hands: [null, hnd.xy], handsZ: [null, hnd.z]})});
  return {pose, p, ry, slot, hang, rad: BRUNO_RADIO_HANG(hang, ry), t};
}
export const E9B: React.FC<Ctx> = (x) => {
  const {pose, p, ry, rad, t} = pose9b(x.f, x.n, x.g, x.c);
  return (<><World x={x} at={[0, 0, p[2]]} /><Walker role="bruno" p={p} pose={pose} c={x.c} /><Radio p={rad} ry={ry} knob={2.4} level={1} t={t} />
    <Z states={wallStates(t).filter((_, i) => i % 3 === 0)} x={x} /></>);
};

// ================================================================= 10 (march E): the whole swarm turns on Bruno like a flock, wings flaring, red eyes
export const E10: React.FC<Ctx> = (x) => { const t = tOf(x); return <><World x={x} at={[0, 0, TOWER_Z + 30]} /><Z states={wallStates(t)} x={x} /></>; };
export const flockCentre = (t: number): V3 => { const s = wallStates(t), c: V3 = [0, 0, 0]; for (const z of s) { c[0] += z.p[0]; c[1] += z.p[1]; c[2] += z.p[2]; } return [c[0] / s.length, c[1] / s.length, c[2] / s.length]; };

// ================================================================= 11 (crossing A): crane-down on Bruno running small into the avenue, swallowed by the swarm and the dust
export const E11: React.FC<Ctx> = (x) => {
  const t = tOf(x), p = brunoBack(t), dist = brunoDist(t), dust = sstep(cutT('11') + 0.7, cutT('11') + 2.0, t), d2: [number, number] = [0.15, 1];
  const pose = runPose('bruno', p, d2, x.c, dist, 1 - 0.0 * dust, x.f, x.n, 'grimace', {hands: [null, [CX + 80, 520]], handsZ: [null, 20]});
  return (<><World x={x} at={[0, 0, p[2]]} /><Walker role="bruno" p={p} pose={pose} c={x.c} /><DustCloud p={[p[0], 0.5, p[2]]} t={t} k={dust} r={5} n={34} /><Z states={wallStates(t)} x={x} /></>);
};

// ================================================================= 12 (march F): "e o caminho abre": the wall is empty, low truck along the cleared path, the four start to run
/** Drop the zombies that fly through the line of sight between the camera and the focus (a flyer passing in front of the lens would hide the narrated thing). */
const offRay = (states: ZState[], a: V3, b: V3, r: number): ZState[] => states.filter((z) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1, t = Math.max(0, Math.min(1, ((z.p[0] - a[0]) * d[0] + (z.p[1] - a[1]) * d[1] + (z.p[2] - a[2]) * d[2]) / l2)); return Math.hypot(a[0] + d[0] * t - z.p[0], a[1] + d[1] * t - z.p[1], a[2] + d[2] * t - z.p[2]) > r; });
export const E12: React.FC<Ctx> = (x) => {
  const t = tOf(x), roles = ['caio', 'ana', 'davi', 'lia'];
  return (<><World x={x} at={[0, 0, -112]} />{roles.map((r) => { const p = fourPos(r, t), prev = fourPos(r, t - 0.05), dist = Math.hypot(p[2] - fourPos(r, FOUR_T0)[2], 0), k = Math.min(1, (t - FOUR_T0) / 0.5 + 0.3); return <Walker key={r} role={r} p={p} c={x.c} pose={runPose(r, p, [0, -1], x.c, dist, k, x.f, x.n, 'fear', {})} />; })}
    <Z states={offRay(wallStates(t).filter((_, i) => i % 5 === 0), x.c.p, x.c.l, 8)} x={x} /></>);
};

// ================================================================= 13 (tower C): follow camera on the four running to the base of the tower
export const E13: React.FC<Ctx> = (x) => {
  const t = tOf(x), roles = ['caio', 'ana', 'davi', 'lia'];
  return (<><World x={x} at={[0, 0, fourPos('caio', t)[2]]} />{roles.map((r) => { const p = fourPos(r, t), dist = Math.abs(p[2] - fourPos(r, FOUR_T0)[2]), k = runK(t, cutT('13') + 2.4, 0.5) * 0.0 + (t < cutT('13') + 2.2 ? 1 : Math.max(0.0, 1 - (t - cutT('13') - 2.2) / 0.4)); return <Walker key={r} role={r} p={p} c={x.c} pose={runPose(r, p, [0, -1], x.c, dist, k, x.f, x.n, r === 'ana' ? 'shock' : 'fear', {})} />; })}</>);
};

// ================================================================= 14 (tower D): Caio understands (face close-up, looking up at the water line)
export const CAIO14: V3 = [0, 0, -126];
export const E14: React.FC<Ctx> = (x) => {
  const f = x.f, p = CAIO14, face: FaceName = f < 30 ? 'confused' : f < 72 ? 'shock' : 'thrilled', up = seg(f, 20, 44);
  const pose = poseOf(p, x.c.p, {fwd: dirTo(p, x.c.p), torsoFwd: dirTo(p, x.c.p), headFwd: dirTo(p, x.c.p), headDx: sway(f), headDy: -9 * up, headRoll: -0.1 * up, face, lean: 0.01, hands: [[CX - 70, 585], [CX + 70, 585]], handsZ: [0, 0], bounce: bounceAt([{kind: 'reach', f0: 30, k: 0.6}], f, 30, 1)});
  return (<><World x={x} at={[0, 0, p[2]]} /><Walker role="caio" p={p} pose={pose} c={x.c} /><Stand role="ana" p={[-1.5, 0, -124.5]} c={x.c} f={f} face="fear" look={[0, 8, TOWER_Z]} ph={1} /><Stand role="lia" p={[1.6, 0, -124]} c={x.c} f={f} face="shock" look={[0, 8, TOWER_Z]} ph={2} /></>);
};

// ================================================================= 15 (base A): crane up the podium wall to the roof where giant sprinklers start to pour
export const E15: React.FC<Ctx> = (x) => <><World x={x} rain={sstep(6, 52, x.f)} at={[0, 0, TOWER_Z + 24]} /></>;

// ================================================================= 16 (base B): the whole water curtain lit gold / orange over the tower
export const E16: React.FC<Ctx> = (x) => {
  const t = tOf(x), far: ZState[] = Array.from({length: 14}, (_, i) => stateOf({pos: (tt) => { const a = i * 0.45 + tt * 0.16, r = 44 + 6 * Math.sin(i * 2.1), y = 16 + (i % 4) * 4; return [Math.sin(a) * r, y, TOWER_Z + Math.cos(a) * r * 0.95 + 20]; }, s: 1, ph: i, amp: 0.6}, t));
  return <><World x={x} rain={1} at={[0, 0, TOWER_Z + 24]} /><Z states={far} x={x} /></>;
};

// ================================================================= 17 (base C): a zombie wing soaked in the curtain: it droops
export const Z17 = (t: number, t0: number): ZState => { const w = sstep(t0, t0 + 1.4, t); return {p: [-3.6, 4.4 - 0.5 * w, -128.8], fwd: norm3([0.0, -0.15 * w, -1]), s: 1.45, ph: 0.6, wet: w, amp: 0.55 * (1 - 0.7 * w), freq: 12.5 - 5 * w, roll: 0.06}; };
export const E17: React.FC<Ctx> = (x) => { const t = tOf(x), z = Z17(t, cutT('17') + 0.2); return <><World x={x} rain={1} at={[0, 0, TOWER_Z + 24]} /><Z states={[z]} x={x} /></>; };

// ================================================================= 18 (base D): the four run through the water (arc, streaks, splash)
export const E18: React.FC<Ctx> = (x) => {
  const t = tOf(x), roles = ['caio', 'ana', 'davi', 'lia'], c0 = fourPos('caio', t);
  const splash = Math.sin(Math.PI * clamp((t - cutT('18') - 0.2) / 1.9));
  return (<><World x={x} rain={1} at={[0, 0, c0[2]]} />{roles.map((r) => { const p = fourPos(r, t), dist = Math.abs(p[2] - fourPos(r, FOUR_T0)[2]) + 10, k = 1; return <Walker key={r} role={r} p={p} c={x.c} pose={runPose(r, p, [0, -1], x.c, dist, k, x.f, x.n, r === 'ana' ? 'teeth' : 'thrilled', {})} />; })}
    <DustCloud p={[0, 0.6, TOWER_Z + 19.8]} t={t} k={splash * 0.8} r={4} n={24} /></>);
};

// ================================================================= 19 (base E): the zombies hit the water and fall, one by one (wings heavy)
export const FALLERS: Path[] = (() => { const o: Path[] = []; for (let k = 0; k < 10; k++) { const xk = (k - 4.5) * 2.9, yk = k % 2 ? 8.5 : 3.6, tHit = cutT('19') + 0.45 + 0.34 * k + hash(k, 3) * 0.1, from: V3 = [xk + (hash(k, 4) - 0.5) * 0.6, yk + 1.5, TOWER_Z + 46], tg: V3 = [xk, yk, TOWER_Z + 20.4 + (k % 2) * 2.4]; o.push(faller(k, from, tg, tHit, 11 + hash(k, 6) * 2, 7)); } return o; })();
export const E19: React.FC<Ctx> = (x) => { const t = tOf(x), zs = FALLERS.map((p) => stateOf(p, t)); return <><World x={x} rain={1} at={[0, 0, TOWER_Z + 24]} /><Z states={zs} x={x} /></>; };
export const FALL_HIT = (k: number) => cutT('19') + 0.45 + 0.34 * k;

// ================================================================= 20a / 20b / 21: the shelter hall (crowd, sleeping children, the heavy door)
const SLEEP_FACE: FaceName = 'happyArc';
const SLEEPERS: {role: string; b: number}[] = ['kidA', 'kidB', 'kidC', 'fc1', 'fc2', 'fc3', 'fc4', 'fc5', 'fc6', 'elderLady', 'fc7', 'fc8', 'fc9', 'fc10', 'fc11', 'fc12'].map((role, b) => ({role, b}));
export const sleeperPos = (b: number): V3 => { const q = SPOTS[b], c = Math.cos(q.ry), sn = Math.sin(q.ry), k = q.kid ? 0.7 : 1; return [q.p[0] + (-(-0.82 * k)) * 0 + (0 * c + (-0.82 * k) * sn), 0, q.p[2] + (-0 * sn + (-0.82 * k) * c)]; };
const Sleepers: React.FC<{x: Ctx; max?: number}> = ({x, max = 16}) => (<>{SLEEPERS.slice(0, max).map((s, i) => {
  const p = sleeperPos(s.b), br = Math.sin(x.f * 0.07 + i) * 0.02, pose = poseOf(p, x.c.p, {fwd: dirTo(p, x.c.p), torsoFwd: dirTo(p, x.c.p), headFwd: dirTo(p, x.c.p), crouch: 0.82, headRoll: 0.55 * (i % 2 ? 1 : -1), headDy: 8 + 40 * br, lean: 0.2 * (i % 2 ? 1 : -1), face: SLEEP_FACE, hands: [[CX - 60, 640], [CX + 60, 640]], handsZ: [10, 10]});
  return <Person key={s.role} role={s.role} p={p} s={S} cam={x.c.p} pose={pose} noCane />; })}</>);
export const E20A: React.FC<Ctx> = (x) => <><Hall f={x.g + x.f} t={tOf(x)} ss={x.ss} cam={x.c.p} /><Sleepers x={x} /></>;
export const E20B: React.FC<Ctx> = (x) => <><Hall f={x.g + x.f} t={tOf(x)} ss={x.ss} cam={x.c.p} /><Sleepers x={x} /></>;
export const DOOR_ANG0 = 1.0, doorAt = (f: number) => DOOR_ANG0 * (1 - seg(f, 16, 78));
export const DOOR_SC = 1.5;
export const doorHandleS = (ang: number): V3 => { const h = doorHandle([0, 0, 0], 0, ang); return [HALL_X + h[0] * DOOR_SC, h[1] * DOOR_SC, -13.5 + h[2] * DOOR_SC]; };
export const DOORMAN_P = (ang: number): V3 => { const h = doorHandleS(ang); return [h[0] - Math.sin(ang) * 0.26, 0, h[2] + Math.cos(ang) * 0.26]; };
export function pose21(f: number, n: number, c: Pose) {
  const ang = doorAt(f), p = DOORMAN_P(ang), hh = doorHandleS(ang), q = DOORMAN_P(doorAt(Math.max(0, f - 2))), mv = Math.hypot(p[0] - q[0], p[2] - q[2]) * 30 > 0.2 ? 1 : 0;
  const slot = slotFor('doorMan', p, c, hh), hand = oneHand('doorMan', p, c, hh, slot);
  const fd: [number, number] = [Math.sin(ang), -Math.cos(ang)], pose = poseOf(p, c.p, {fwd: fd, torsoFwd: fd, headFwd: blendDir(fd, dirTo(p, c.p), 0.45), ...gaitR('doorMan', cumDoor(f), 0.25, mv, 0), ...hand, lean: 0.06, face: 'deadpan', bounce: stepBounce(f, 0, n, 18, 'doorMan')});
  return {pose, p, ang, handle: hh, slot};
}
export const E21: React.FC<Ctx> = (x) => {
  const f = x.f, {pose, p, ang} = pose21(f, x.n, x.c);
  return (<><Hall f={x.g + x.f} t={tOf(x)} ss={x.ss} doorAng={ang} cam={x.c.p} /><Walker role="doorMan" p={p} pose={pose} c={x.c} />
    <Stand role="caio" p={[HALL_X - 3.4, 0, -9.6]} c={x.c} f={f} face="happyArc" look={[HALL_X, 1.4, -13]} /><Stand role="ana" p={[HALL_X - 4.5, 0, -9.0]} c={x.c} f={f} face="sad" look={[HALL_X, 1.4, -13]} ph={1} /><Stand role="davi" p={[HALL_X + 3.5, 0, -9.4]} c={x.c} f={f} face="deadpan" look={[HALL_X, 1.4, -13]} ph={2} /><Stand role="lia" p={[HALL_X + 4.7, 0, -8.8]} c={x.c} f={f} face="happyArc" look={[HALL_X, 1.4, -13]} ph={3} />
    <Sleepers x={x} max={6} /></>);
};
const cumDoor = (f: number): number => { let d = 0, p = DOORMAN_P(doorAt(0)); for (let i = 1; i <= f; i++) { const q = DOORMAN_P(doorAt(i)); d += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; } return d; };

// ================================================================= 22 / 23 / 24: the roof terrace at night
export const CAIO_T: V3 = [-4.35, 22.02, TOWER_Z + 16.2]; // between two sprinklers (they stand every 30 degrees on the parapet)
export const E22: React.FC<Ctx> = (x) => {
  const f = x.f, p = CAIO_T, look: V3 = [0, 20, TOWER_Z + 80], hand: V3 = [p[0] + 0.28, p[1] + 1.02, p[2] + 0.62], pose = poseOf(p, x.c.p, {fwd: [0, 1], torsoFwd: [0, 1], headFwd: [0, 1], headDx: sway(f), headDy: 2 * Math.sin(f * 0.04), lean: 0.01 * Math.sin(f * 0.04), face: 'deadpan', ...oneHand('caio', p, x.c, hand, 1), armSw: [0.03, -0.03], bounce: bounceAt([{kind: 'stop', f0: 6, k: 0.4}], f, 30, 1)});
  void look;
  return <><World x={x} rain={1} at={[0, 22, TOWER_Z + 8]} /><Walker role="caio" p={p} pose={pose} c={x.c} /><Z states={circlers(tOf(x), 8, 31)} x={x} /></>;
};
/** Zombies circling the curtain: ring orbit (head leads along the circle) with a lunge toward the water and a veer-off, never crossing. */
export function circlers(t: number, n: number, seed: number, rIn = 30): ZState[] {
  return Array.from({length: n}, (_, i) => stateOf({pos: (tt) => { const a = (i / n) * Math.PI * 2 + tt * 0.2 + hash(i, seed) * 0.15, r = rIn + (i % 3) * 5 + 4.5 * Math.sin(tt * 0.9 + i * 1.7), y = 14 + (i % 4) * 4.5 + 1.5 * Math.sin(tt * 0.7 + i); return [Math.sin(a) * r, y, TOWER_Z + Math.cos(a) * r]; }, s: 0.95 + hash(i, seed + 1) * 0.15, ph: i * 1.3, amp: 0.6, freq: 12 + (i % 3)}, t));
}
export const E23: React.FC<Ctx> = (x) => { const t = tOf(x); return <><World x={x} rain={1} at={[0, 22, TOWER_Z + 8]} /><Z states={[...circlers(t, 16, 5, 28), ...circlers(t, 12, 9, 52)]} x={x} /></>; };

export const Z24A = (t: number): ZState => stateOf({pos: (tt) => { const a = 1.2 + tt * 0.5, r = 24; return [Math.sin(a) * r, 21 + 1.2 * Math.sin(tt * 1.3), TOWER_Z + Math.cos(a) * r]; }, s: 1.2, ph: 0.4, amp: 0.65}, t);
export const E24A: React.FC<Ctx> = (x) => { const t = tOf(x); return <><World x={x} rain={1} at={[0, 22, TOWER_Z + 20]} /><Z states={[Z24A(t), ...circlers(t, 6, 17, 40)]} x={x} /></>; };
export const Z24B = (t: number): ZState => { const t0 = cutT('24b'), p = (tt: number): V3 => [3.2 + 0.4 * Math.sin(tt * 1.2), 0.62, -118 + 11.5 * (tt - t0)]; const a = p(t - 0.05), b = p(t + 0.05), v = norm3([b[0] - a[0], b[1] - a[1] + 0.06, b[2] - a[2]]); return {p: p(t), fwd: v, s: 1.15, ph: 0.3, wet: 0, amp: -0.9, freq: 15, roll: 0}; };
export const E24B: React.FC<Ctx> = (x) => <><World x={x} at={[0, 0, Z24B(tOf(x)).p[2]]} /><Z states={[Z24B(tOf(x))]} x={x} /></>;
export const Z24C = (t: number): ZState => { const t0 = cutT('24c'), turn = sstep(t0, t0 + 1.6, t); return {p: [-9.8, 6.75, -78.0], fwd: norm3([mix(0.55, 0.62, turn), mix(-0.15, -0.05, turn), mix(-0.6, 0.78, turn)]), s: 1.1, ph: 0.2, wet: 0, amp: -0.0001, freq: 4, roll: 0.05}; };
export const E24C: React.FC<Ctx> = (x) => <><World x={x} at={[-6, 0, -78]} /><Z states={[Z24C(tOf(x))]} x={x} /></>;
export const CAIO_FACE: V3 = [-4.35, 22.02, TOWER_Z + 15.0];
export const E24D: React.FC<Ctx> = (x) => {
  const f = Math.min(x.f, x.n - 31), p = CAIO_FACE, smile = seg(f, 40, 96), face: FaceName = smile > 0.4 ? 'smug' : 'deadpan';
  const pose = poseOf(p, x.c.p, {fwd: dirTo(p, x.c.p), torsoFwd: dirTo(p, x.c.p), headFwd: dirTo(p, x.c.p), headDx: sway(f), headDy: -3 * smile, headRoll: 0.05 * smile, face, lean: 0.01, hands: [[CX - 66, 585], [CX + 66, 585]], handsZ: [0, 0]});
  return <><World x={{...x, f}} rain={1} at={[0, 22, TOWER_Z + 8]} /><Walker role="caio" p={p} pose={pose} c={x.c} /></>;
};

export const BODIES: Record<string, {Body: React.FC<Ctx>; hero: number}> = {
  '1': {Body: E1, hero: 120}, '2': {Body: E2, hero: 30}, '3': {Body: E3, hero: 36}, '4': {Body: E4, hero: 60}, '5': {Body: E5, hero: 70}, '6': {Body: E6, hero: 50}, '7': {Body: E7, hero: 20}, '8': {Body: E8, hero: 26},
  '9a': {Body: E9A, hero: 40}, '9b': {Body: E9B, hero: 26}, '10': {Body: E10, hero: 30}, '11': {Body: E11, hero: 40}, '12': {Body: E12, hero: 20}, '13': {Body: E13, hero: 36}, '14': {Body: E14, hero: 50},
  '15': {Body: E15, hero: 80}, '16': {Body: E16, hero: 60}, '17': {Body: E17, hero: 60}, '18': {Body: E18, hero: 36}, '19': {Body: E19, hero: 60}, '20a': {Body: E20A, hero: 40}, '20b': {Body: E20B, hero: 60},
  '21': {Body: E21, hero: 50}, '22': {Body: E22, hero: 50}, '23': {Body: E23, hero: 60}, '24a': {Body: E24A, hero: 20}, '24b': {Body: E24B, hero: 20}, '24c': {Body: E24C, hero: 30}, '24d': {Body: E24D, hero: 120},
};
void THREE; void DOOR_Z; void HALL; void WALL; void MAX_ZOMBIES; void CROWD; void RADIO_H; void FLAP; void OTHERS_STOP_Z; void T_STOP_B; void T_STOP_O; void STOP_T; void wallState; void SWIRL_C; void handPos; void FOUR_T0;
