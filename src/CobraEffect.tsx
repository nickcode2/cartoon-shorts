// COBRA_EFFECT, PHASE 2: the full animated video. Compositions: CobraEffect (same video, for the Studio preview) and CobraEffectSilent (render this one:
// 1080x1920, 30 fps, 73.0 s = 2190 frames, no audio, 300-frame chunks). Audio lives in COBRA_EFFECT/ (narration.mp3, sfx.wav, ambience.wav).
// Timing: src/cobra/timeline.json (beats of the trimmed narration measured with ffmpeg silencedetect). Looks come from the approved stills (src/cobra/shots.tsx).
// Motion sources: kit refMotion (5.8-frame step, bob, idle sway 13 % / 10 f, anticipation rise 25 % of the head width, depth walk 100 % -> 58 % in 25 f), kit bounce
// on every movement. Everything else (hop height 0.3 m, throw 4 + 5 frames, run speed 0.06 m/f, snake slither amplitude) is an estimate, untested.
// Camera: locked or one slow straight push along the camera axis, hard cuts only. Render stability: all snakes are instanced and updated in place, characters
// redraw their canvases, nothing allocates GPU resources per frame, every entry is its own shot so the kit disposes it.
import React, {useMemo} from 'react';
import {EffectComposer} from '@react-three/postprocessing';
import {MoveV3, moveV3} from './kit/camera';
import {LightFx} from './kit/LightFx';
import {gradeEffects} from './kit/Grade';
import {Pose, ShotSpec, SingleCanvasVideo, V3} from './kit/kit';
import {easeInOut} from './kit/motion';
import {FocusDof} from './kit/Dof';
import {LABEL_PX, Label3D, upperThirdAnchor} from './kit/Label3D';
import {BounceEvent, bounceAt} from './kit/bounce';
import {anticipationDy, depthProgress, depthSpeed, idleSwayDx, WALK_STEP_FRAMES} from './kit/refMotion';
import {CX, RickPose, build, yawTo} from './kit/rickRig';
import {sitPose} from './kit/sit';
import {B, Coin, CoinBag, CoinStack, Cy, HEAD_FWD, HEAD_HALF, LiveSnake, Sp, snakeRings, snakeYaw} from './cobra/common';
import {KIND, Person, Role, handPos, poseOf} from './cobra/cast';
import {Desk, Garage, Lights, Office, Poster, Street} from './cobra/sets';
import {ANGLES, useFredoka} from './cobra/shots';
import TL from './cobra/timeline.json';

export const CE_FPS = TL.fps;
export const CE_FRAMES = Math.round(TL.videoSec * TL.fps); // 2190
const S = 0.9, STEP = WALK_STEP_FRAMES, TAU = Math.PI * 2;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (f: number, a: number, b: number) => easeInOut(clamp((f - a) / (b - a)));
const tri = (s: number) => (2 / Math.PI) * Math.asin(Math.sin(Math.PI * s));
function kf(f: number, keys: [number, number][]): number {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], easeInOut((f - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
}
const kf2 = (f: number, keys: [number, [number, number]][]): [number, number] => [kf(f, keys.map((k) => [k[0], k[1][0]] as [number, number])), kf(f, keys.map((k) => [k[0], k[1][1]] as [number, number]))];
const hw = (r: Role) => 2 * build(KIND[r]).rx;
const REST_L: [number, number] = [CX - 62, 580], REST_R: [number, number] = [CX + 62, 580];
const faceWin = (f: number, wins: [number, number, RickPose['face']][], base: RickPose['face']): RickPose['face'] => { for (const [a, b, fc] of wins) if (f >= a && f < b) return fc; return base; };
const shake = (f: number, a: number, b: number, amp = 0.13) => (f >= a && f < b ? amp * Math.sin((f - a) * 1.25) * Math.min(1, (b - f) / 8) : 0);
const dirCam = (a: number): [number, number] => [Math.sin(a), Math.cos(a)]; // a = 0 faces the camera, + toward world +x
type Ctx = {f: number; n: number; c: Pose; ready: boolean; ss: number};

// ---------------------------------------------------------------- shared stable snake data (module level)
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const ring = (n: number, o: {x0: number; x1: number; z0: number; z1: number; y?: number; sc?: number; t0: number; dt: number; shapes?: LiveSnake['shape'][]; wig?: number; vz?: number; vx?: number}): LiveSnake[] =>
  Array.from({length: n}, (_, i) => ({x: mix(o.x0, o.x1, rnd(i, 1)), z: mix(o.z0, o.z1, rnd(i, 2)), y: o.y ?? 0, yaw: rnd(i, 3) * TAU, shape: (o.shapes ?? ['S', 'tight', 'S', 'coil'])[i % (o.shapes ?? ['S', 'tight', 'S', 'coil']).length], s: (o.sc ?? 1) * (0.85 + 0.3 * rnd(i, 4)), t0: o.t0 + i * o.dt, wig: o.wig ?? 1, ph: rnd(i, 5) * 6, vx: o.vx, vz: o.vz}));
const heap = (n: number, cx: number, cz: number, rx: number, rz: number, hMax: number, t0: number, dt: number, dead: boolean, wig = 0.6): LiveSnake[] => Array.from({length: n}, (_, i) => {
  const a = (i * 2.399963) % TAU, r = Math.sqrt((i + 0.5) / n);
  return {x: cx + Math.cos(a) * rx * r, z: cz + Math.sin(a) * rz * r, y: (1 - r) * hMax * (0.6 + 0.4 * ((i * 5) % 6) / 5) + 0.03, yaw: a * 3.1, shape: dead ? 'limp' : (['S', 'tight', 'coil'] as const)[i % 3], dead, s: 0.9 + 0.25 * rnd(i, 7), t0: t0 + i * dt, wig: dead ? 0 : wig, ph: rnd(i, 8) * 6};
});
const SN2A: LiveSnake[] = [{x: 0.9, z: -0.7, shape: 'S', t0: 0, wig: 1, target: [0, -0.2], strike: 24}, {x: -0.3, z: -0.1, shape: 'up', t0: 6, wig: 1, s: 0.9, target: [0, -0.2], strike: 20}];
const SN2B: LiveSnake[] = [...SN2A, {x: 0.35, z: -0.15, shape: 'up', t0: 6, wig: 1, s: 0.9, target: [0, -0.2], strike: 26}];
const SN3A = heap(44, 0, 1.2, 1.5, 0.45, 0.95, 0, 0.45, false, 0.5);
const SN3B = ring(52, {x0: -2.4, x1: 2.4, z0: -14, z1: 2.5, t0: 0, dt: 0.5, sc: 1.6});
const SN3C = ring(40, {x0: -2.3, x1: 2.3, z0: -24, z1: 1.5, t0: 0, dt: 0.8, sc: 1.5, wig: 0.6}).concat(ring(12, {x0: -11, x1: 11, z0: -9.4, z1: -6.9, t0: 8, dt: 1.2, sc: 1.5, wig: 0.6}));
const SN5A = Array.from({length: 14}, (_, i): LiveSnake => ({x: -0.3 + i * 0.16, z: -0.9 - (i % 4) * 0.55, shape: i % 2 ? 'S' : 'tight', yaw: 0, s: 1, t0: -1, wig: 1, vx: 0.045, ph: i, die: 22 + i * 3.4}));
// crowd part 2 (ground-level front camera): snakes run TOWARD the camera between the people, then go limp
const SN5B = Array.from({length: 12}, (_, i): LiveSnake => ({x: -1.6 + i * 0.25, z: -3.4, shape: i % 2 ? 'S' : 'tight', s: 1, t0: 30 + i * 2.5, wig: 1, vz: 0.05, ph: i, die: 56 + i * 2.2}));
const SN6: LiveSnake[] = heap(34, -0.62, -1.3, 0.5, 0.35, 0.4, 4, 3.3, true).map((q) => ({...q, y: (q.y ?? 0) + 0.8})); // the dead pile in the foreground corner, in front of the desk
const SN7 = ring(62, {x0: -2.0, x1: 2.0, z0: -9, z1: 1.8, t0: -1, dt: 0, wig: 1}).filter((s) => Math.hypot(s.x - 0.2, s.z + 0.8) > 0.7);
const SN9A = (() => { const o: LiveSnake[] = []; let i = 0; for (const [z, hi] of [[-5.1, 2], [-4.1, 1], [-3.1, 1]] as [number, number][]) for (let k = 0; k < 9; k++) for (let l = 0; l < hi; l++, i++) if (i % 2 === 0) o.push({x: -3.2 + k * 0.8, z, y: 0.2 + l * 0.4 + 0.19, shape: 'coil', s: 0.7, yaw: i, t0: i * 2, wig: 0.7, ph: i}); return o; })();
const BOX9: {p: V3; c: string}[] = (() => { const o: {p: V3; c: string}[] = []; for (const [z, hi] of [[-5.1, 2], [-4.1, 1], [-3.1, 1]] as [number, number][]) for (let k = 0; k < 9; k++) for (let l = 0; l < hi; l++) o.push({p: [-3.2 + k * 0.8, 0.2 + l * 0.4, z], c: (k + l) % 2 ? '#C99A5B' : '#D6A96A'}); return o; })();
const SN11 = heap(60, 0, -2.0, 1.45, 0.95, 0.62, 0, 1.6, false, 0.5);
const SN12 = Array.from({length: 78}, (_, i): LiveSnake => { const x = (rnd(i, 1) * 2 - 1) * 1.6; return {x, z: 0.3 + rnd(i, 2) * 0.5, shape: (['S', 'tight', 'coil', 'S', 'up'] as const)[i % 5], yaw: Math.atan2(0.5 * x, 1) + 1.57 - 1.57, s: 1.0, t0: 74 + i * 0.5, wig: 1, vx: x * 0.012, vz: 0.07 + 0.03 * rnd(i, 3), ph: i}; });
const SN13B = ring(80, {x0: -2.7, x1: 2.7, z0: -16, z1: 3, t0: 0, dt: 0.6, sc: 1.7});
const SN14 = [[-0.55, -0.2], [0.7, 0.0], [-0.7, -1.5], [0.9, -1.7], [0.15, -2.6]] as const;
const THROW0 = 4, THROW_DT = 12;
const SN14S: LiveSnake[] = SN14.map(([x, z], i) => ({x, z: z + 0.15, shape: 'up', yaw: i, s: 0.95, t0: THROW0 + i * THROW_DT + 11, wig: 0.8, ph: i}));

// ---------------------------------------------------------------- small props
import {SnakeField} from './cobra/common';
const Broom: React.FC<{p: V3; ang: number; dir: number}> = ({p, ang, dir}) => (
  <group position={p} rotation={[0, 0, dir * ang]}>
    <Cy p={[0, 0.0, 0]} r={0.018} h={1.1} c="#8A5A3A" ink={0.006} />
    <B p={[0, -0.62, 0]} s={[0.24, 0.26, 0.1]} c="#D9B24A" ink={0.008} />
    <B p={[0, -0.5, 0]} s={[0.12, 0.05, 0.07]} c="#7A4A2A" />
  </group>
);
const Table: React.FC<{p: V3}> = ({p}) => (
  <group position={p}><B p={[0, 0.78, 0]} s={[1.5, 0.06, 0.8]} c="#8A5A3A" ink={0.01} />{[-0.65, 0.65].map((x) => [-0.3, 0.3].map((z) => <B key={`${x}${z}`} p={[x, 0.38, z]} s={[0.07, 0.76, 0.07]} c="#6B4A32" />))}</group>
);
const Stove: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <B p={[0, 0.42, 0]} s={[1.0, 0.84, 0.7]} c="#E9E1D0" ink={0.012} /><B p={[0, 0.86, 0]} s={[1.02, 0.05, 0.72]} c="#3E4A52" ink={0.008} />
    {[-0.25, 0.25].map((x) => <Cy key={x} p={[x, 0.9, 0.1]} r={0.1} h={0.02} c="#231A28" />)}
    <B p={[0, 0.5, 0.36]} s={[0.7, 0.4, 0.02]} c="#3E4A52" /><Cy p={[0, 1.02, -0.05]} r={0.21} h={0.26} c="#8A9AA8" ink={0.01} />
  </group>
);
const Paper: React.FC<{p: V3; rot?: [number, number, number]; w?: number}> = ({p, rot, w = 0.3}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}><B p={[0, 0, 0]} s={[w, w * 1.35, 0.01]} c="#F7F1E0" ink={0.004} cast={false} />{[0.3, 0.1, -0.1, -0.3].map((y) => <B key={y} p={[0, y * w, 0.007]} s={[w * 0.7, 0.01, 0.002]} c="#8A8A8A" basic cast={false} />)}</group>
);

// ---------------------------------------------------------------- locations
import {blockedBy, runQA, QAEntry} from './kit/qa';
import {DIRS, SetName} from './cobra/angles';
import {CENTER_BOX as _CB} from './kit/camera';
import {bandDistance, bandOf, focusGroup, followFocus, orbitPos} from './kit/camera';
const fanOK = (c: Pose) => blockedBy(c.p, [0, 1.2, -2], 'office').length === 0; // occlusion pass: the ceiling fan is hidden while it sits between the camera and the focus
const StreetSet: React.FC<{ss: number; f: number; c: Pose}> = ({ss, f, c}) => (<><Lights mode="street" ss={ss} /><Street /><LightFx mode="street" f={f} cam={c.p} /></>);
const lab = (text: string, c: Pose, focal: V3, f: number, start: number, ready: boolean, hold?: number) => <Label3D text={text} anchor={upperThirdAnchor(c, focal)} pose={c} f={f} start={start} hold={hold} ready={ready} px={LABEL_PX} lift={0} />;

// ---------------------------------------------------------------- SHOT 1 (STREET A): the man walks into depth, steps on a snake, freezes, screams
const E1_WALK = 36;
const B1_EV: BounceEvent[] = [{kind: 'step', f0: 0, f1: E1_WALK}, {kind: 'stop', f0: E1_WALK, k: 0.8}, {kind: 'turn', f0: 40, k: 0.5, dir: -1}, {kind: 'reach', f0: 44, k: 0.6}];
const SN1: LiveSnake[] = [{x: 0.04, z: -0.74, shape: 'S', s: 0.95, t0: E1_WALK, wig: 1, target: [0.1, -0.4], strike: E1_WALK + 16}]; // head points at the man, then a short lunge
const E1: React.FC<Ctx> = ({f, c, ss}) => {
  const prog = depthProgress(f, E1_WALK), p: V3 = [0.1, 0, mix(1.1, -0.4, prog)], sp = clamp(depthSpeed(f, E1_WALK) / depthSpeed(0, E1_WALK)), s = Math.min(f, E1_WALK) / STEP, walking = f < E1_WALK;
  const la = walking ? (0.15 + 0.4 * sp) * tri(s) : 0, land = seg(f, E1_WALK, E1_WALK + 6), up = seg(f, 42, 52), turn = seg(f, 40, 47), a = Math.PI * (1 - turn);
  const hands: RickPose['hands'] = up > 0 ? [[mix(REST_L[0], CX - 178, up), mix(REST_L[1], 150, up)], [mix(REST_R[0], CX + 178, up), mix(REST_R[1], 150, up)]] : undefined;
  const pose = poseOf(p, c.p, {fwd: [0, -1], torsoFwd: [0, -1], headFwd: dirCam(a), legSw: [mix(la, 0.5, land), mix(-la, -0.28, land)], bend: walking ? [Math.max(0, Math.cos(Math.PI * s)), Math.max(0, -Math.cos(Math.PI * s))] : [0, 0], toe: [0.35 * land, 0], hands, lean: -0.04 * up, face: f >= 44 ? 'shock' : 'deadpan', headRoll: shake(f, 50, 64), bounce: bounceAt(B1_EV, f, hw('man'), 1)});
  return (<><StreetSet ss={ss} f={f} c={c} /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN1} cam={c.p} f={f} /></>);
};

// ---------------------------------------------------------------- SHOT 2 (STREET A, two quick cuts): second snake under the other foot, hop, third pops, hop
const hopPose = (f: number, c: Pose, p0: V3, face: RickPose['face'], flip: number): {p: V3; pose: RickPose} => {
  const air = Math.abs(Math.sin((Math.PI * f) / 16)), y = 0.3 * air * (f < 36 ? 1 : 0.25), p: V3 = [p0[0], y, p0[2]];
  const ev: BounceEvent[] = [{kind: 'start', f0: 0, k: 0.8}, {kind: 'stop', f0: 16, k: 0.6}, {kind: 'stop', f0: 32, k: 0.6}];
  return {p, pose: poseOf(p, c.p, {legSw: [0.25 * flip, -0.25 * flip], legOut: [-0.1 - 0.4 * air, 0.1 + 0.4 * air], bend: [0.8 * air, 0.8 * air], hands: [[CX - 190, 300 + 50 * Math.sin(f * 0.5)], [CX + 190, 215 + 50 * Math.sin(f * 0.5 + 2)]], lean: 0.06 * Math.sin(f * 0.4), headRoll: 0.08 * Math.sin(f * 0.8), face, bounce: bounceAt(ev, f, hw('man'), 1)})};
};
const E2A: React.FC<Ctx> = ({f, c, ss}) => { const {p, pose} = hopPose(f, c, [0, 0, -0.2], 'shock', 1); return (<><StreetSet ss={ss} f={f} c={c} /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN2A} cam={c.p} f={f} /></>); };
const E2B: React.FC<Ctx> = ({f, c, ss}) => { const {p, pose} = hopPose(f + 6, c, [0, 0, -0.2], f > 20 ? 'fear' : 'shock', -1); return (<><StreetSet ss={ss} f={f} c={c} /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN2B} cam={c.p} f={f} /></>); };

// ---------------------------------------------------------------- SHOT 3 (house / street / town)
const E3A: React.FC<Ctx> = ({f, c, ss}) => {
  const p: V3 = [-1.15, 0, 4.3], lean = seg(f, 6, 22), pose = poseOf(p, c.p, {lean: 0.12 * lean, headDx: 14 * lean, headDy: 10 * lean, headRoll: 0.06 * Math.sin(f * 0.5) * lean, face: f > 18 ? 'fear' : 'confused', bounce: bounceAt([{kind: 'reach', f0: 4, k: 0.5}], f, hw('man'), 1)});
  return (<><Lights mode="garage" ss={ss} /><Garage open={0.5} /><LightFx mode="street" f={f} cam={c.p} /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN3A} cam={c.p} f={f} /></>);
};
const E3B: React.FC<Ctx> = ({f, c, ss}) => (<><StreetSet ss={ss} f={f} c={c} /><SnakeField snakes={SN3B} cam={c.p} f={f} /></>);
const E3C: React.FC<Ctx> = ({f, c, ss}) => (<><StreetSet ss={ss} f={f} c={c} /><SnakeField snakes={SN3C} cam={c.p} f={f} /></>);

// ---------------------------------------------------------------- SHOT 4 (OFFICE A): the official slaps ONE coin on the desk and points at the drawing
const OFF: V3 = [0, 0, -2.0], SLAM = 64;
const off4 = (f: number, c: Pose): RickPose => {
  const slam = kf2(f, [[50, REST_L], [58, [CX - 130, 250]], [SLAM, [CX - 100, 545]], [120, [CX - 100, 545]], [135, REST_L]]), z = kf(f, [[58, 0], [SLAM, 105], [120, 105], [135, 0]]);
  const point = kf2(f, [[66, REST_R], [80, [CX + 195, 215]]]);
  const hd = f >= 52 && f < 62 ? anticipationDy(f - 52, hw('official')) * (f < 58 ? 1 : 1 - (f - 58) / 4) : 0;
  return poseOf(OFF, c.p, {hands: [slam, point], handsZ: [z, null], headDy: hd, headDx: idleSwayDx(f, hw('official')), lean: -0.03 * seg(f, 62, 70), headRoll: 0.06 * seg(f, 70, 84), headFwd: dirCam(0.5 * seg(f, 66, 80)), face: f >= 24 ? 'smug' : 'deadpan', bounce: bounceAt([{kind: 'reach', f0: SLAM - 1, k: 0.8}, {kind: 'reach', f0: 80, k: 0.4, dir: -1}], f, hw('official'), 1)});
};
const E4: React.FC<Ctx> = ({f, c, ready, ss}) => {
  const h = handPos('official', off4(SLAM + 6, c), OFF, c.p, S, 0), foc: V3 = [0, 1.5, -2];
  return (<><Lights mode="office" ss={ss} /><LightFx mode="office" f={f} cam={c.p} /><Office fan={fanOK(c)} /><Person role="official" p={OFF} s={S} cam={c.p} pose={off4(f, c)} />{f >= SLAM && <Coin p={[h[0], 0.81, h[2]]} r={0.085} />}<CoinStack p={[-0.65, 0.8, -1.35]} n={4} /><CoinStack p={[0.7, 0.8, -1.5]} n={2} />{lab('1 COIN', c, foc, f, SLAM, ready)}</>);
};

// ---------------------------------------------------------------- SHOT 5: crowd with brooms chases snakes (STREET A), then OFFICE B: the official hugs the bag, thumbs up
const CROWD: {role: Role; z: number; x0: number}[] = [{role: 'man', z: -1.0, x0: -1.2}, {role: 'b1', z: -1.7, x0: -1.8}, {role: 'b2', z: -2.3, x0: -2.4}, {role: 'b3', z: -1.3, x0: -3.0}];
const E5A: React.FC<Ctx> = ({f, c, ss}) => (
  <><StreetSet ss={ss} f={f} c={c} />
    {CROWD.map((m, i) => {
      const x = m.x0 + 0.062 * f, p: V3 = [x, 0, m.z], s = f / STEP + i * 0.37, t = tri(s) * 0.55, cs = Math.cos(Math.PI * s), swing = Math.sin((TAU * (f + i * 5)) / 18);
      const pose = poseOf(p, c.p, {fwd: [1, 0], torsoFwd: [1, 0], headFwd: [1, 0], legSw: [t, -t], bend: [Math.max(0, cs), Math.max(0, -cs)], toe: [0.5 * Math.max(0, cs), 0.5 * Math.max(0, -cs)], armSw: [-0.5 * tri(s - 0.45), 0.5 * tri(s - 0.45)], hands: [null, [CX + 150, 380 + 60 * swing]], lean: 0.12, face: 'teeth', bounce: bounceAt([{kind: 'step', f0: 0, f1: 75}], f, hw(m.role), 1)});
      const h = handPos(m.role, pose, p, c.p, S, 1);
      return (<React.Fragment key={m.role}><Person role={m.role} p={p} s={S} cam={c.p} pose={pose} /><Broom p={[h[0] + 0.1, h[1] - 0.05, h[2] + 0.04]} ang={0.9 + 0.5 * swing} dir={-1} /></React.Fragment>);
    })}
    <SnakeField snakes={SN5A} cam={c.p} f={f} /><SnakeField snakes={SN5B} cam={c.p} f={f} /></>
);
const E5B: React.FC<Ctx> = ({f, c, ss}) => {
  const grab = seg(f, 0, 14), put = seg(f, 48, 58), up = seg(f, 50, 62);
  const bag: V3 = [mix(mix(0, 0, grab), 0.5, put), mix(mix(0.8, 0.78, grab), 0.8, put), mix(mix(-1.4, -1.72, grab), -1.3, put)];
  const hugL = [mix(REST_L[0], CX - 50, grab * (1 - put)) + (REST_L[0] - 0) * 0 * put, mix(REST_L[1], 470, grab * (1 - put)) + (580 - 470) * 0 * put] as [number, number];
  const hugR = [mix(REST_R[0], CX + 50, grab * (1 - put)), mix(REST_R[1], 470, grab * (1 - put))] as [number, number];
  const hR2: [number, number] = up > 0 ? [mix(hugR[0], CX + 150, up), mix(hugR[1], 300, up)] : hugR;
  const pose = poseOf(OFF, c.p, {hands: [hugL, hR2], handsZ: [95 * grab * (1 - put), 95 * grab * (1 - put)], lean: 0.02, headRoll: -0.07 * (1 - put), headDx: idleSwayDx(f, hw('official')), face: faceWin(f, [[6, 51, 'teeth']], put > 0.5 ? 'happyArc' : 'smug'), bounce: bounceAt([{kind: 'reach', f0: 12, k: 0.6}, {kind: 'reach', f0: 56, k: 0.5, dir: -1}], f, hw('official'), 1)});
  const hr = handPos('official', pose, OFF, c.p, S, 1);
  return (<><Lights mode="office" ss={ss} /><LightFx mode="office" f={f} cam={c.p} /><Office fan={fanOK(c)} /><Person role="official" p={OFF} s={S} cam={c.p} pose={pose} /><CoinBag p={bag} size={0.17} /><CoinStack p={[-0.7, 0.8, -1.25]} n={5} /><CoinStack p={[0.75, 0.8, -1.3]} n={3} />
    {up > 0.5 && <Cy p={[hr[0] + 0.03, hr[1] + 0.07, hr[2]]} r={0.028} h={0.1} c="#231A28" basic />}</>);
};

// ---------------------------------------------------------------- SHOT 6 (OFFICE A, slow push): the pile of limp snakes and the coin bag grow, counter 10 / 100 / 1000
const E6: React.FC<Ctx> = ({f, c, ready, ss}) => {
  const p: V3 = [0.2, 0, -2.0], pose = poseOf(p, c.p, {hands: [[CX - 110, 520], [CX + 100, 520]], handsZ: [60, 60], headDx: idleSwayDx(f, hw('official')), headRoll: 0.02 * Math.sin(f * 0.1), face: f > 20 ? 'smug' : 'deadpan', bounce: bounceAt([{kind: 'reach', f0: 15, k: 0.3}, {kind: 'reach', f0: 88, k: 0.4, dir: -1}, {kind: 'reach', f0: 114, k: 0.5}], f, hw('official'), 1)}), foc: V3 = [0.2, 1.5, -2];
  return (<><Lights mode="office" ss={ss} /><LightFx mode="office" f={f} cam={c.p} /><Office fan={fanOK(c)} /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN6} cam={c.p} f={f} /><CoinBag p={[0.6, 0.8, -1.1]} size={mix(0.13, 0.24, clamp(f / 114))} /><CoinStack p={[-0.55, 0.8, -1.4]} n={3 + Math.floor(f / 18)} /><CoinStack p={[-0.2, 0.8, -1.0]} n={2 + Math.floor(f / 24)} />
    {lab('10', c, foc, f, 15, ready, 73)}{lab('100', c, foc, f, 88, ready, 26)}{lab('1000', c, foc, f, 114, ready)}</>);
};

// ---------------------------------------------------------------- SHOT 7 (STREET A): still full of snakes, the official looks out, "wait, what?" (record scratch)
const E7: React.FC<Ctx> = ({f, c, ss}) => {
  const p: V3 = [0.2, 0, -0.8], look = 0.8 * Math.sin(f / 22) * (1 - seg(f, 60, 70)), chin = seg(f, 55, 70);
  const pose = poseOf(p, c.p, {headFwd: dirCam(look), hands: chin > 0 ? [null, [mix(REST_R[0], CX + 215, chin), mix(REST_R[1], 200, chin)]] as RickPose['hands'] : undefined, headRoll: 0.3 * seg(f, 40, 66) + shake(f, 95, 115, 0.1), headDx: 12 * chin + idleSwayDx(f, hw('official')), face: faceWin(f, [[66, 112, 'confused']], 'deadpan'), bounce: bounceAt([{kind: 'reach', f0: 66, k: 0.5}, {kind: 'turn', f0: 100, k: 0.5, dir: 1}], f, hw('official'), 1)});
  return (<><StreetSet ss={ss} f={f} c={c} /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN7} cam={c.p} f={f} /></>);
};

// ---------------------------------------------------------------- SHOT 8: a man chases a snake, the snake chases him back (STREET A); GARAGE A: the same man sits calm, a snake nests in a box
const SN8: LiveSnake[] = [{x: 0.9, z: -0.9, shape: 'S', yaw: Math.PI, s: 1.1, t0: -1, wig: 1.2, vx: -0.05, off: 72, ph: 1}, {x: -2.0, z: -0.9, shape: 'S', yaw: 0, s: 1.1, t0: 66, wig: 1.2, vx: 0.078, ph: 3}];
const E8A: React.FC<Ctx> = ({f, c, ss}) => {
  const chase = f < 66, x = chase ? mix(1.4, -1.2, clamp(f / 60)) : f < 76 ? -1.2 : -1.2 + 0.035 * (f - 76), dir = chase ? -1 : 1, moving = chase ? f < 62 : f >= 76;
  const p: V3 = [x, 0, -0.9], s = (moving ? f : 0) / STEP, t = moving ? tri(s) * 0.6 : 0, cs = Math.cos(Math.PI * s), idle = !moving;
  const turnU = seg(f, 62, 76), fw = chase || f < 62 ? -1 : 1;
  const pose = poseOf(p, c.p, {fwd: [fw, 0], torsoFwd: [f < 62 ? -1 : f < 76 ? (turnU < 0.5 ? -1 : 1) : 1, 0], headFwd: f < 62 ? [-1, 0] : f < 70 ? [-0.2, 0.98] : [1, 0], legSw: [t, -t], bend: moving ? [Math.max(0, cs), Math.max(0, -cs)] : [0, 0], armSw: [-0.8 * tri(s - 0.45) * (moving ? 1 : 0), 0.8 * tri(s - 0.45) * (moving ? 1 : 0)], hands: f >= 62 && f < 76 ? [[CX - 150, 330 + 40 * Math.sin(f)], [CX + 150, 330 + 40 * Math.cos(f)]] : undefined, lean: moving ? 0.14 * (fw === 1 ? 1 : -1) : 0.05, face: f < 62 ? 'teeth' : 'fear', headRoll: shake(f, 62, 76, 0.1), bounce: bounceAt([{kind: 'step', f0: 0, f1: 62}, {kind: 'stop', f0: 62, k: 0.7}, {kind: 'turn', f0: 70, k: 0.6, dir: 1}, {kind: 'step', f0: 76, f1: 155}], f, hw('man'), 1)});
  void dir; void idle;
  return (<><StreetSet ss={ss} f={f} c={c} /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN8} cam={c.p} f={f} /></>);
};
const SN8B: LiveSnake[] = [{x: 0.85, z: -2.0, y: 0.42, yaw: 0.3, shape: 'coil', s: 0.9, t0: 0, wig: 0.4}];
const E8B: React.FC<Ctx> = ({f, c, ss}) => {
  const p0: V3 = [-0.2, 0, -2.0], sp = useMemo(() => sitPose('c12', {seat: 'bench', view: 'front', camYaw: yawTo(c.p, p0), scale: S}), []), p: V3 = [p0[0], sp.yOffset, p0[2]]; // eslint-disable-line react-hooks/exhaustive-deps
  return (<><Lights mode="garage" ss={ss} /><Garage /><LightFx mode="garage" f={f} cam={c.p} /><B p={[-0.2, 0.225, -2.2]} s={[0.9, 0.45, 0.5]} c="#8A5A3A" ink={0.012} /><Person role="man" p={p} s={S} cam={c.p} pose={{...sp.pose, face: f > 8 ? 'happyArc' : 'deadpan', headRoll: 0.03 * Math.sin(f * 0.15), bounce: bounceAt([{kind: 'sit', f0: 0, k: 0.5}], f, hw('man'), 1)}} /><B p={[0.85, 0.2, -2.0]} s={[0.6, 0.4, 0.5]} c="#C99A5B" ink={0.012} /><SnakeField snakes={SN8B} cam={c.p} f={f} /></>);
};

// ---------------------------------------------------------------- SHOT 9 (GARAGE A, gag cuts): boxes of snakes, snake in the stove pot, snake on the table, rows of boxes + a breeder counting coins
const GarageSet: React.FC<{ss: number; f: number; c: Pose}> = ({ss, f, c}) => (<><Lights mode="garage" ss={ss} /><Garage /><LightFx mode="garage" f={f} cam={c.p} /></>);
const E9A: React.FC<Ctx> = ({f, c, ss}) => (<><GarageSet ss={ss} f={f} c={c} />{BOX9.map((b, i) => <B key={i} p={b.p} s={[0.62, 0.38, 0.5]} c={b.c} ink={0.008} />)}<SnakeField snakes={SN9A} cam={c.p} f={f} /></>);
// KITCHEN GAG (shot 9b): a cook beside the stove holds a spoon, the lid is pushed aside, the snake rises out of the pot, the cook reacts
const SN9B: LiveSnake[] = [{x: 0, z: -1.85, y: 1.1, shape: 'up', s: 0.8, t0: 8, wig: 0.7}];
const E9B: React.FC<Ctx> = ({f, c, ss}) => {
  const p: V3 = [0.7, 0, -1.55], react = seg(f, 14, 20), hands: RickPose['hands'] = [kf2(f, [[0, [CX - 80, 470]], [14, [CX - 80, 470]], [22, [CX - 195, 190]]]), kf2(f, [[0, REST_R], [14, REST_R], [22, [CX + 195, 190]]])];
  const pose = poseOf(p, c.p, {hands, lean: -0.1 * react, headDy: -10 * react, headRoll: -0.1 * react, face: f >= 12 ? 'fear' : 'deadpan', bounce: bounceAt([{kind: 'reach', f0: 14, k: 0.8}], f, hw('b3'), 1)});
  const sp = handPos('b3', pose, p, c.p, S, 0), lid = seg(f, 2, 8);
  return (<><GarageSet ss={ss} f={f} c={c} /><Stove p={[0, 0, -1.8]} /><Cy p={[mix(0, 0.3, lid), mix(1.17, 1.2, lid), mix(-1.85, -1.75, lid)]} r={0.2} h={0.03} c="#6E7C88" rot={[0.2 * lid, 0, 0.5 * lid]} ink={0.006} />
    <Person role="b3" p={p} s={S} cam={c.p} pose={pose} /><Cy p={[sp[0] - 0.02, sp[1] + 0.12, sp[2]]} r={0.018} h={0.34} c="#8A5A3A" rot={[0, 0, 0.5 + 0.5 * react]} ink={0.004} /><SnakeField snakes={SN9B} cam={c.p} f={f} /></>);
};
const SN9C: LiveSnake[] = [{x: 0.1, z: -1.8, y: 0.8, shape: 'coil', s: 0.9, t0: 4, wig: 0.8}];
const E9C: React.FC<Ctx> = ({f, c, ss}) => (<><GarageSet ss={ss} f={f} c={c} /><Table p={[0, 0, -1.8]} /><Cy p={[-0.4, 0.82, -1.8]} r={0.17} h={0.02} c="#F4EFE0" ink={0.005} /><SnakeField snakes={SN9C} cam={c.p} f={f} /></>);
const E9D: React.FC<Ctx> = ({f, c, ss}) => {
  const p: V3 = [0, 0, -1.8], a = Math.sin(f * 0.5), pose = poseOf(p, c.p, {hands: [[CX - 100, 560 - 18 * Math.max(0, a)], [CX + 100, 560 - 18 * Math.max(0, -a)]], handsZ: [90, 90], lean: 0.04, headRoll: 0.05 + shake(f, 8, 38, 0.06), headDx: idleSwayDx(f, hw('b1')), face: faceWin(f, [[8, 38, 'teeth']], 'smug'), bounce: bounceAt([{kind: 'reach', f0: 6, k: 0.4}, {kind: 'reach', f0: 22, k: 0.4, dir: -1}, {kind: 'reach', f0: 40, k: 0.4}], f, hw('b1'), 1)});
  return (<><GarageSet ss={ss} f={f} c={c} /><Person role="b1" p={p} s={S} cam={c.p} pose={pose} />{BOX9.map((b, i) => <B key={i} p={b.p} s={[0.62, 0.38, 0.5]} c={b.c} ink={0.008} />)}<SnakeField snakes={SN9A} cam={c.p} f={f + 60} /><Table p={[0, 0, -1.15 + 0.65]} />
    <CoinStack p={[-0.45, 0.81, -0.5]} n={3 + Math.floor(f / 10)} /><CoinStack p={[-0.15, 0.81, -0.4]} n={2 + Math.floor(f / 14)} /><CoinStack p={[0.2, 0.81, -0.5]} n={4 + Math.floor(f / 9)} /><CoinStack p={[0.5, 0.81, -0.4]} n={2 + Math.floor(f / 16)} /></>);
};

// ---------------------------------------------------------------- SHOT 10 (OFFICE A): reads the report, red head + angry face, rips the drawing off the wall in half
const P_WALL: V3 = [0.8, 1.95, -3.08], RIP_A = 86, RIP_B = 100;
const E10: React.FC<Ctx> = ({f, c, ss}) => {
  const reading = f < 80, grab = seg(f, RIP_A, RIP_A + 8), pull = seg(f, RIP_B, RIP_B + 10), rest = (f < 78);
  const hl = kf2(f, [[0, [CX - 60, 430]], [70, [CX - 60, 430]], [RIP_A, [CX - 60, 260]], [RIP_B, [CX - 62, 262]], [RIP_B + 10, [CX - 170, 262]]]), hr = kf2(f, [[0, [CX + 60, 430]], [70, [CX + 60, 430]], [RIP_A, [CX + 60, 260]], [RIP_B, [CX + 62, 262]], [RIP_B + 10, [CX + 170, 262]]]);
  const pose = poseOf(OFF, c.p, {hands: [hl, hr], handsZ: [85, 85], headDy: reading ? 6 : 0, headRoll: reading ? 0.07 * Math.sin(f * 0.08) : -0.08, lean: -0.04 * seg(f, 78, 90), headFwd: dirCam(0.5 * seg(f, 80, 90)), face: f >= 78 ? 'teeth' : 'deadpan', bounce: bounceAt([{kind: 'reach', f0: 80, k: 0.7}, {kind: 'reach', f0: RIP_B, k: 0.8, dir: -1}, {kind: 'stop', f0: RIP_B + 10, k: 0.8}], f, hw('official'), 1)});
  const L = handPos('official', pose, OFF, c.p, S, 0), R = handPos('official', pose, OFF, c.p, S, 1), mid: V3 = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2 + 0.2, (L[2] + R[2]) / 2];
  const fall = seg(f, 70, 82), paper: V3 = [mix((L[0] + R[0]) / 2, 0.3, fall), mix((L[1] + R[1]) / 2 + 0.05, 0.84, fall), mix((L[2] + R[2]) / 2, -1.3, fall)];
  return (<><Lights mode="office" ss={ss} /><LightFx mode="office" f={f} cam={c.p} /><Office poster={false} fan={fanOK(c)} /><B p={[0.8, 1.95, -3.12]} s={[1.14, 1.48, 0.06]} c="#7A4A2A" cast={false} ink={0.012} />
    <Person role="official" p={OFF} s={S} cam={c.p} pose={pose} tint={{state: 'angry', zones: ['full'], k: 0.85 * seg(f, 78, 86)}} />
    {f < 86 && <Paper p={paper} rot={[fall * -1.3, 0, 0]} />}
    {f < RIP_B && <Poster p={f < RIP_A ? P_WALL : [mix(P_WALL[0], mid[0], grab), mix(P_WALL[1], mid[1], grab), mix(P_WALL[2], mid[2], grab)]} w={mix(0.98, 0.5, grab)} h={mix(1.32, 0.68, grab)} />}
    <Poster p={f >= RIP_B ? [L[0] - 0.12 * pull, L[1] + 0.22, L[2] + 0.06] : [0, -9, 0]} w={f >= RIP_B ? 0.36 : 0.001} h={0.5} half="left" rot={[0, 0, 0.3 * pull]} />
    <Poster p={f >= RIP_B ? [R[0] + 0.12 * pull, R[1] + 0.22, R[2] + 0.06] : [0, -9, 0]} w={f >= RIP_B ? 0.36 : 0.001} h={0.5} half="right" rot={[0, 0, -0.3 * pull]} /></>);
};

// ---------------------------------------------------------------- SHOT 11 (GARAGE A): the breeder sits, snakes pile up to his waist, sick green cheeks
const E11: React.FC<Ctx> = ({f, c, ss}) => {
  const p0: V3 = [0, 0, -2.0], sp = useMemo(() => sitPose('c14', {seat: 'bench', view: 'front', camYaw: yawTo(c.p, p0), scale: S}), []), p: V3 = [0, sp.yOffset, -2.0]; // eslint-disable-line react-hooks/exhaustive-deps
  const k = seg(f, 20, 44), pose = {...sp.pose, headRoll: 0.12 * k, headDy: 10 * k + 3 * Math.sin(f * 0.12), face: f > 16 ? 'sad' as const : 'deadpan' as const, bounce: bounceAt([{kind: 'sit', f0: 4, k: 0.4}, {kind: 'stop', f0: 60, k: 0.5}, {kind: 'stop', f0: 100, k: 0.5}], f, hw('b2'), 1)};
  return (<><Lights mode="garage" ss={ss} /><Garage /><LightFx mode="garage" f={f} cam={c.p} /><B p={[0, 0.225, -2.2]} s={[1.3, 0.45, 0.55]} c="#8A5A3A" ink={0.012} /><Person role="b2" p={p} s={S} cam={c.p} pose={pose} tint={{state: 'sick', zones: ['cheeks', 'around-eyes'], k: 0.9 * k}} /><SnakeField snakes={SN11} cam={c.p} f={f} /></>);
};

// ---------------------------------------------------------------- SHOT 12 (GARAGE B): the breeder opens the big door, snakes pour out
const E12: React.FC<Ctx> = ({f, c, ss}) => {
  const open = seg(f, 58, 100), p: V3 = [0.6, 0, 3.6], reach = kf2(f, [[48, REST_R], [58, [CX + 110, 190]], [96, [CX + 110, 190]], [112, [CX + 205, 410]]]), left = kf2(f, [[96, REST_L], [112, [CX - 205, 410]]]);
  const pose = poseOf(p, c.p, {headFwd: dirCam(0.5 * (1 - seg(f, 90, 104))), hands: [left, reach], handsZ: [null, null], lean: 0.03, headRoll: 0.16 * seg(f, 100, 112), headDy: f >= 50 && f < 58 ? anticipationDy(f - 50, hw('b3')) : 0, face: faceWin(f, [[100, 135, 'happyArc']], 'deadpan'), bounce: bounceAt([{kind: 'reach', f0: 58, k: 0.6}, {kind: 'stop', f0: 100, k: 0.6}], f, hw('b3'), 1)});
  return (<><Lights mode="garage" ss={ss} /><Garage open={open} /><LightFx mode="street" f={f} cam={c.p} /><Person role="b3" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN12} cam={c.p} f={f} /></>);
};

// ---------------------------------------------------------------- SHOT 13: STREET C (top-down), then STREET B with even more snakes and "DELHI, INDIA"
const E13A: React.FC<Ctx> = ({f, c, ss}) => (<><StreetSet ss={ss} f={f} c={c} /><SnakeField snakes={SN3C} cam={c.p} f={f + 40} /></>);
const E13B: React.FC<Ctx> = ({f, c, ready, ss}) => (<><StreetSet ss={ss} f={f} c={c} /><SnakeField snakes={SN13B} cam={c.p} f={f} />{lab('DELHI, INDIA', c, [0, 1.5, -4.5], f, 53, ready)}</>);

// ---------------------------------------------------------------- SHOT 14 (STREET A): the official throws coins, every coin pops up a new snake, facepalm
const OFF14: V3 = [0.1, 0, -1.0], CS = SN14.map(([x, z]) => [x + 0.28, 0.07, z + 0.1] as V3);
const E14: React.FC<Ctx> = ({f, c, ss}) => {
  const keysL: [number, [number, number]][] = [[0, REST_L]];
  for (let i = 0; i < 5; i++) { const t = THROW0 + i * THROW_DT; keysL.push([t, [CX - 150, 430]], [t + 4, [CX - 225, 255]], [t + 9, REST_L]); }
  const face = kf2(f, [[54, REST_R], [62, [CX - 10, 190]]]);
  const pose = poseOf(OFF14, c.p, {hands: [kf2(f, keysL), face], handsZ: [null, 70 * seg(f, 54, 62)], lean: -0.06 * seg(f, 54, 62), headRoll: -0.1 * seg(f, 54, 62), headDy: 8 * seg(f, 54, 62), headFwd: dirCam(0.4 * Math.sin(f / 10)), face: f >= 54 ? 'fear' : 'smug', bounce: bounceAt(Array.from({length: 5}, (_, i): BounceEvent => ({kind: 'reach', f0: THROW0 + i * THROW_DT + 4, k: 0.5, dir: i % 2 ? -1 : 1})), f, hw('official'), 1)});
  const start: V3 = [-0.2, 1.15, -0.9];
  return (<><StreetSet ss={ss} f={f} c={c} /><Person role="official" p={OFF14} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN14S} cam={c.p} f={f} />
    {CS.map((q, i) => {
      const t = THROW0 + i * THROW_DT + 3, u = clamp((f - t) / 9), landed = u >= 1;
      if (f < t) return null;
      const pos: V3 = landed ? q : [mix(start[0], q[0], u), mix(start[1], q[1], u) + 0.9 * 4 * u * (1 - u), mix(start[2], q[2], u)];
      return <Coin key={i} p={pos} r={0.09} rot={landed ? [0.1, 0, 0.1] : [u * 9, 0.3, 0]} />;
    })}</>);
};

// ---------------------------------------------------------------- SHOT 15 (GARAGE B): slow push-in on the closed door, a lime snake eye peeks from under it, hard hold
const SN15: LiveSnake[] = [{x: 0.4, z: 0.85, shape: 'S', s: 0.9, t0: 80, wig: 0.6, vz: 0.02}]; // starts INSIDE (head z 1.4 < door 1.62), head first
const E15: React.FC<Ctx> = ({f, c, ss}) => {
  const eye = seg(f, 80, 90), blink = f > 112 && f < 118 ? 0.2 : 1;
  return (<><Lights mode="garage" ss={ss} /><Garage open={0.05 * seg(f, 88, 100)} /><LightFx mode="street" f={f} cam={c.p} /><SnakeField snakes={SN15} cam={c.p} f={f} />
    <Sp p={[-0.7, 0.07, 1.6]} s={[0.1 * eye, 0.05 * eye * blink, 0.03]} c="#7CE23B" basic cast={false} /><Sp p={[-0.74, 0.08, 1.64]} s={[0.018 * eye, 0.018 * eye * blink, 0.01]} c="#231A28" basic cast={false} /><Sp p={[-0.66, 0.08, 1.64]} s={[0.018 * eye, 0.018 * eye * blink, 0.01]} c="#231A28" basic cast={false} /></>);
};

// ---------------------------------------------------------------- timeline + cameras (CAMERA RULES v3.1: follow the focus, fit the framing box, one S-curve move, never the same angle in a row)
type Kind = 'wide' | 'medium' | 'close' | 'insert';
interface Entry {id: string; set: SetName; ang: string; h: number; fr: number; axis?: 'y' | 'z'; focus: (f: number) => V3; move: MoveV3 | ((a: Pose) => (f: number, n: number) => Pose); flip?: boolean; Body: React.FC<Ctx>; snakes?: LiveSnake[]; f0?: number; splitOf?: string; doorZ?: number; keys?: {name: string; at: (f: number) => V3; r: number; f: number[]}[]}
const FOV = 62;
const E8X = (f: number) => (f < 66 ? mix(1.4, -1.2, clamp(f / 60)) : f < 76 ? -1.2 : -1.2 + 0.035 * (f - 76));
const hopY = (f: number) => 0.3 * Math.abs(Math.sin((Math.PI * f) / 16)) * (f < 36 ? 1 : 0.25);
const leadHead = (sn: LiveSnake, f: number): V3 => { const dt = Math.max(0, f - (sn.t0 ?? 0)); return [sn.x + (sn.vx ?? 0) * dt + 0.55 * Math.cos(snakeYaw(sn)), 0.1, sn.z + (sn.vz ?? 0) * dt - 0.55 * Math.sin(snakeYaw(sn))]; };
const blend3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const OFFF = (): V3 => [0, 1.2, -2];
const seq12 = (a: Pose) => (f: number, n: number): Pose => { const s1 = Math.round(n * 0.55), m1 = moveV3(a, {push: [0, 0.15]}); if (f < s1) return m1(f, s1); return moveV3(m1(s1 - 1, s1), {dx: [0, 0.4]})(f - s1, n - s1); };
const move9b = (a: Pose) => moveV3(a, {dy: [0, 0.2], push: [0, -0.3]});
export const ENTRIES: Entry[] = [
  {id: '1', set: 'street', ang: 'A', focus: (f) => [0.1, 0.9, mix(1.1, -0.4, depthProgress(f, E1_WALK))], h: 1.9, fr: 0.5, move: {yawDeg: [0, -20], push: [0, 0.12]}, Body: E1, snakes: SN1, keys: [{name: 'snake under the foot', at: () => [0.04, 0.1, -0.74], r: 0.35, f: [45, 60]}]},
  {id: '2a', set: 'street', ang: 'D', focus: (f) => [0, 0.9 + hopY(f), -0.2], h: 2.1, fr: 0.5, move: {push: [0, 0.1]}, Body: E2A, snakes: SN2A, keys: [{name: 'snakes at his feet', at: () => [0.9, 0.1, -0.7], r: 0.35, f: [30]}]},
  {id: '2b', set: 'street', ang: 'E', focus: (f) => [0, 0.9 + hopY(f + 6), -0.2], h: 2.1, fr: 0.5, move: {dx: [0.4, -0.4]}, Body: E2B, snakes: SN2B, keys: [{name: 'snakes at his feet', at: () => [0.35, 0.1, -0.15], r: 0.35, f: [30]}]},
  {id: '3a', set: 'garage', ang: 'B', focus: () => [0, 0.9, 1.4], h: 2.4, fr: 0.3, move: {yawDeg: [0, 25], push: [0, 0.18]}, Body: E3A, keys: [{name: 'doorway full of snakes', at: () => [0, 0.9, 1.9], r: 1.5, f: [20]}]},
  {id: '3b', set: 'street', ang: 'B', focus: () => [0, 0.4, -4], h: 2.5, fr: 0.25, move: {dx: [0.9, -0.9], yawDeg: [4, -4]}, Body: E3B},
  {id: '3c', set: 'street', ang: 'C', focus: () => [0, 0, -5], h: 9, fr: 0.3, axis: 'z' as const, move: {dy: [0, 2], dutchDeg: 5}, Body: E3C},
  {id: '4', set: 'office', ang: 'A', focus: focusGroup([OFFF, () => [0.8, 1.95, -3.1]]), h: 2.6, fr: 0.45, move: {pitchDeg: [0, 22], push: [0, 0.1]}, Body: E4, keys: [{name: 'coin on the desk', at: () => [-0.2, 0.85, -1.6], r: 0.2, f: [80]}, {name: 'snake drawing', at: () => [0.8, 1.95, -3.1], r: 0.65, f: [80]}]},
  {id: '5a', set: 'street', ang: 'B', focus: (f) => [-2.1 + 0.062 * f, 0.9, -1.65], h: 1.9, fr: 0.45, move: {dx: [-0.7, 0.7]}, Body: E5A, snakes: SN5A},
  {id: '5a2', set: 'street', ang: 'E', focus: (f) => [-2.1 + 0.062 * (f + 38), 0.9, -1.8], h: 1.9, fr: 0.45, move: {push: [0, 0.05]}, Body: E5A, snakes: SN5B, f0: 38, splitOf: '5a'},
  {id: '5b', set: 'office', ang: 'B', focus: OFFF, h: 1.9, fr: 0.55, move: {yawDeg: [0, 20], push: [0, 0.1]}, Body: E5B, keys: [{name: 'coin bag', at: () => [0, 0.95, -1.75], r: 0.3, f: [30]}]},
  {id: '6', set: 'office', ang: 'C', focus: () => [-0.35, 1.0, -2.0], h: 1.6, fr: 0.45, move: {push: [0, 0.1], dy: [0, 0.3]}, Body: E6},
  {id: '7', set: 'street', ang: 'F', focus: () => [0.2, 1.0, -0.8], h: 1.9, fr: 0.5, move: {push: [0, 0.08], dutchDeg: 6, endAt: 0.6}, Body: E7, snakes: SN7},
  {id: '8a', set: 'street', ang: 'D', focus: (f) => [E8X(f), 0.9, -0.9], h: 1.9, fr: 0.45, move: {push: [0, 0.06]}, Body: E8A, snakes: SN8},
  {id: '8b', set: 'garage', ang: 'A', focus: focusGroup([() => [-0.2, 0.9, -2], () => [0.85, 0.5, -2]]), h: 1.7, fr: 0.4, move: {yawDeg: [0, 12], push: [0, 0.08]}, Body: E8B, keys: [{name: 'snake nest box', at: () => [0.85, 0.5, -2.0], r: 0.35, f: [30]}]},
  {id: '9a', set: 'garage', ang: 'C', focus: () => [0, 0.5, -3.4], h: 1.2, fr: 0.4, move: {yawDeg: [0, 15], push: [0, 0.06]}, Body: E9A, snakes: SN9A},
  {id: '9b', set: 'garage', ang: 'D', focus: (f) => blend3([0, 1.35, -1.85], [0.7, 1.5, -1.55], seg(f, 14, 28)), h: 1.5, fr: 0.5, move: move9b, Body: E9B, snakes: SN9B},
  {id: '9c', set: 'garage', ang: 'E', focus: () => [0.1, 0.95, -1.8], h: 0.5, fr: 0.7, move: {yawDeg: [0, 22], push: [0, 0.08]}, Body: E9C, snakes: SN9C},
  {id: '9d', set: 'garage', ang: 'A', focus: () => [0, 1.0, -1.8], h: 1.9, fr: 0.5, move: {pitchDeg: [0, 14], push: [0, 0.05]}, Body: E9D, keys: [{name: 'coin stacks', at: () => [0.2, 0.95, -0.5], r: 0.3, f: [40]}]},
  {id: '10', set: 'office', ang: 'A', focus: focusGroup([() => [0, 1.1, -2.0], () => [0.8, 1.95, -3.1]]), h: 2.4, fr: 0.45, move: {push: [0, 0.05], endAt: 0.4}, Body: E10, keys: [{name: 'sign', at: () => [0.8, 1.95, -3.1], r: 0.7, f: [30, 60, 80]}, {name: 'sign being ripped', at: () => [0, 1.6, -1.9], r: 0.6, f: [100, 108, 118, 135]}, {name: 'official', at: () => [0, 1.1, -2.0], r: 0.55, f: [30, 100, 135]}]},
  {id: '11', set: 'garage', ang: 'C', focus: () => [0, 0.8, -2.0], h: 1.4, fr: 0.5, move: {yawDeg: [0, 20], push: [0, 0.1]}, Body: E11, snakes: SN11},
  {id: '12', set: 'garage', ang: 'D', focus: focusGroup([() => [0.6, 0.95, 3.6], (f) => (f < 74 ? [0, 0.3, 1.9] : leadHead(SN12[0], f))]), h: 2.3, fr: 0.3, move: seq12, Body: E12, snakes: SN12, doorZ: 1.62, keys: [{name: 'breeder (whole head and body)', at: () => [0.6, 0.95, 3.6], r: 0.6, f: [10, 60, 110, 122]}, {name: 'lead snake', at: (f) => leadHead(SN12[0], f), r: 0.35, f: [90, 100]}]},
  {id: '13a', set: 'street', ang: 'C', focus: () => [0, 0, -5], h: 9, fr: 0.28, axis: 'z' as const, move: {pitchDeg: [0, -35], push: [0, 0.12], yawDeg: [0, 6]}, Body: E13A},
  {id: '13b', set: 'street', ang: 'A', focus: () => [0, 0.4, -4], h: 2.5, fr: 0.25, move: {dy: [1.0, 0], yawDeg: [0, -6], push: [0, 0.04]}, Body: E13B},
  {id: '14', set: 'street', ang: 'F', focus: () => [0.1, 1.0, -1.0], h: 1.9, fr: 0.5, flip: true, move: {push: [0, -0.12], dutchDeg: 5}, Body: E14, snakes: SN14S, keys: [{name: 'coin and the snake it pops', at: () => [-0.42, 0.3, -1.4], r: 0.35, f: [64]}]},
  {id: '15', set: 'garage', ang: 'X', focus: (f) => blend3([0.35, 0.05, 2.45], leadHead(SN15[0], f), seg(f, 92, 118)), h: 1.3, fr: 0.5, move: {yawDeg: [0, -10], push: [0, 0.2], endAt: 0.85}, Body: E15, snakes: SN15, doorZ: 1.62, keys: [{name: 'snake head at the gap', at: (f) => leadHead(SN15[0], f), r: 0.3, f: [130, 148]}]},
];
/** frames of every entry: the timeline.json cuts, plus sub-cuts inside an entry (`splitOf` / `f0`) that do not move any approved cut. */
export const ENTRY_FRAMES: {id: string; from: number; to: number}[] = (() => {
  const base = TL.entries.map((e, i) => ({id: e.id, from: Math.round(e.t * TL.fps), to: i + 1 < TL.entries.length ? Math.round(TL.entries[i + 1].t * TL.fps) : CE_FRAMES})), out: {id: string; from: number; to: number}[] = [];
  for (const e of ENTRIES) { const b = base.find((x) => x.id === (e.splitOf ?? e.id))!; if (e.splitOf) { const prev = out[out.length - 1]; out.push({id: e.id, from: b.from + (e.f0 ?? 0), to: b.to}); prev.to = b.from + (e.f0 ?? 0); } else out.push({...b}); }
  return out;
})();
/** Builds the camera of an entry: base pose from the named angle + the fitted distance, the move relative to the focus, then the damped follow. */
export function buildCam(e: Entry): {cam: (f: number, n: number) => Pose; base: (f: number, n: number) => Pose} {
  const d = DIRS[e.set][e.ang], az = (e.flip ? -1 : 1) * d.az, r = bandDistance(e.h, e.fr, d.el, e.axis ?? 'y', FOV), f0 = e.focus(0); // SIZE BAND distance: no padding, no zooming out to fit
  const a: Pose = {p: orbitPos(f0, az, d.el, r), l: f0, fov: FOV}, base = typeof e.move === 'function' ? e.move(a) : moveV3(a, e.move), follow = followFocus(base, e.focus, {damping: 5, lead: 5});
  const interior = e.set === 'garage' && e.focus(0)[2] < 0, ymax = e.set === 'office' ? 3.1 : interior ? 3.0 : 99;
  // keep the camera inside the set: street (between the facades unless above the roofs), floor, ceiling, door wall. The look point stays on the focus, so it stays centred.
  const fit = (f: number, n: number): Pose => { const c = follow(f, n), p: V3 = [c.p[0], c.p[1], c.p[2]]; if (e.set === 'street' && p[1] < 6.5) p[0] = Math.max(-1.9, Math.min(1.9, p[0])); if (e.set !== 'street' || p[1] < 30) p[1] = Math.max(0.22, Math.min(ymax, p[1])); if (interior) { p[2] = Math.min(p[2], 1.2); p[0] = Math.max(-3.7, Math.min(3.7, p[0])); } if (e.set === 'office') { p[2] = Math.min(p[2], 5.5); p[0] = Math.max(-3.7, Math.min(3.7, p[0])); } return {...c, p}; };
  return {base, cam: fit};
}
const CAMS = ENTRIES.map(buildCam);
/** QA gate input: every entry with its camera, focus, box, snakes. Run with ?qa=1 (console) or call from Studio. */
/** Mesh-level snake checks on the REAL ring positions (same function the renderer uses): head ring on the head path, head forward . velocity > 0.7, every ring within 5 % of the length of the path the head traced, nobody starts outside the door. */
function snakeIssues(e: Entry, n: number): string[] {
  const out: string[] = [], N = 48, ring = new Float32Array((N + 1) * 3);
  for (const s of e.snakes ?? []) {
    const v = Math.hypot(s.vx ?? 0, s.vz ?? 0), t0 = Math.max(0, s.t0 ?? 0); if (!(v > 0)) continue;
    for (const f of [t0 + 10, Math.round((t0 + n) / 2), n - 1]) {
      if (f < t0 + 8 || f > n - 1 || (s.off !== undefined && f >= s.off) || (s.die !== undefined && f >= s.die)) continue;
      const st = snakeRings(s, f, N, false, ring), L = 1.1 * (s.s ?? 1), fx = ring[0] - ring[3], fz = ring[2] - ring[5], fl = Math.hypot(fx, fz) || 1, dot = (fx * (s.vx ?? 0) + fz * (s.vz ?? 0)) / (fl * v);
      if (dot <= 0.7) out.push(`snake@${f} head.velocity ${dot.toFixed(2)}`);
      const h = st.headPath(f), g0 = Math.hypot(ring[0] - h[0], ring[2] - h[2]); if (g0 > 0.01) out.push(`snake@${f} head ring off the head path by ${g0.toFixed(3)}`);
      let worst = 0; for (let i = 1; i <= N; i += 4) { let best = 9; for (let q = 0; q <= 120; q++) { const p = st.headPath(f - (q / 120) * (L / v) * 1.3); best = Math.min(best, Math.hypot(ring[i * 3] - p[0], ring[i * 3 + 2] - p[2])); } worst = Math.max(worst, best); }
      if (worst > 0.05 * L) out.push(`snake@${f} body leaves the head path by ${(worst / L * 100).toFixed(1)} % of its length`);
      if (e.doorZ !== undefined && f === t0 + 10 + 0) { const st0 = snakeRings(s, t0 + 1, N, false, ring); void st0; if (ring[2] > e.doorZ) out.push(`snake starts outside the door (head z ${ring[2].toFixed(2)})`); }
    }
  }
  return out;
}
export const qaEntries = (): QAEntry[] => ENTRIES.map((e, i) => {
  const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, c = CAMS[i], sn = (e.snakes ?? []).filter((s) => s.shape !== 'limp' && !s.dead);
  return {id: e.id, set: e.set, ang: e.ang, kind: bandOf(e.fr), n, cam: (f, nn) => c.cam(f, nn), base: c.base, endAt: typeof e.move === 'function' ? undefined : e.move.endAt, sCurve: typeof e.move !== 'function', focus: (f) => e.focus(f), box: [e.h, e.h, e.h], h: e.h, fr: e.fr, axis: e.axis, doorZ: e.doorZ, keys: e.keys, headGap: Math.max(0, HEAD_HALF - HEAD_FWD), snakeIssues: snakeIssues(e, n), yawOf: snakeYaw, sampleSnakes: sn.map((s) => ({x: s.x, z: s.z, vx: s.vx, vz: s.vz, yaw: s.yaw, target: s.target, head0: s.z + 0.55 * Math.sign(s.vz ?? 0)}))};
});
export const runCobraQA = () => runQA(qaEntries(), ENTRIES.map((e) => ({id: e.id, set: e.set, ang: e.ang})));
const PLAN_REPORT_NOTE = 'framing lengths in words are not checked here (approved cuts kept)';
void PLAN_REPORT_NOTE; void _CB;

const EntryView: React.FC<{i: number; f: number; n: number; ss: number}> = ({i, f, n, ss}) => {
  const ready = useFredoka(), e = ENTRIES[i], c = CAMS[i].cam(f, n);
  return <e.Body f={f + (e.f0 ?? 0)} n={n + (e.f0 ?? 0)} c={c} ready={ready} ss={ss} />;
};
export const CobraEffect: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa') === '1') { const r = runCobraQA(); (window as unknown as {__qa?: string[]}).__qa = r.lines; r.lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa]', l) : console.info('[qa]', l))); }
    return ENTRIES.map((e, i) => {
      const {from, to} = ENTRY_FRAMES[i], n = to - from;
      return {from, to, light: 'day', ownLights: true, cam: (_u: number, t: number) => CAMS[i].cam(Math.min(n - 1, Math.round(t * CE_FPS)), n), post: (_fr: number, pose: Pose) => (<EffectComposer multisampling={4}><FocusDof pose={pose} focal={e.focus(0)} r={e.h * 0.5} />{gradeEffects()}</EffectComposer>), render: (t: number) => <EntryView i={i} f={Math.min(n - 1, Math.round(t * CE_FPS))} n={n} ss={2048} />};
    });
  }, []);
  return <SingleCanvasVideo shots={shots} fps={CE_FPS} />;
};
void Desk;

/** QA contact sheet cells: shot k (1..15) sampled at 0, 25, 50, 75, 100 % of its whole span (all its cuts). */
export function sheetCells(shot: number) {
  const idx = ENTRIES.map((e, i) => ({e, i, fr: ENTRY_FRAMES[i]})).filter((x) => parseInt(x.e.id, 10) === shot), from = idx[0].fr.from, to = idx[idx.length - 1].fr.to;
  return [0, 0.25, 0.5, 0.75, 1].map((q) => {
    const g = Math.min(to - 1, from + Math.round(q * (to - from - 1))), k = idx.find((x) => g >= x.fr.from && g < x.fr.to) ?? idx[idx.length - 1], n = k.fr.to - k.fr.from, f = Math.min(n - 1, g - k.fr.from), pose = CAMS[k.i].cam(f, n);
    return {i: k.i, id: k.e.id, f, n, pose, focus: k.e.focus(f), h: k.e.h, axis: k.e.axis, kind: bandOf(k.e.fr), ang: k.e.ang, g};
  });
}
export const EntryBody: React.FC<{i: number; f: number; n: number; c: Pose; ss: number}> = ({i, f, n, c, ss}) => { const ready = useFredoka(), e = ENTRIES[i]; return <e.Body f={f + (e.f0 ?? 0)} n={n + (e.f0 ?? 0)} c={c} ready={ready} ss={ss} />; };
