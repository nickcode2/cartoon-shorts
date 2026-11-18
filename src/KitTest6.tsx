// KitTest6: kit test video, 9:16, exactly 6.0 s = 180 frames at 30 fps, silent, hard hold at the end (no fade).
// Cast: MAIN (default hoodie), OFFICER (police outfit), PASSENGER (casual outfit), all white HoodieCurved.
// Scene 1 (0-3 s, set "officeA"): wide locked (tiny drift) -> straight push-in to a cup insert; MAIN walks in, stops, picks the cup up (pickPlace).
// Scene 2 (3-6 s, set "officeB"): dissolve (12 frames), MAIN sits (sit helper), 4 expressions + mouth flap + blink + ONE gaze flip, last 0.5 s frozen.
// 3 named angles in the whole test: wideA, insertA (set officeA), seatB (set officeB).
// Checks run once at mount (checkPlanV2, assertFramed, per-frame head sweep, assertPathClear, assertLegsClear); results go to console "[kit6]" and window.__kit6.
// Motion numbers marked "estimate" are ours and untested; walk, pickPlace and sit follow STYLE_NOTES ANIMATION v5 / SITTING v8.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer, ToneMapping} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {CamFn, Pose, ShotSpec, SingleCanvasVideo, V3, clamp01, lerp, shared, useTex} from './kit/kit';
import {EXPR, ExprName, mixExpr} from './kit/hoodieMan';
import {HoodieCurved} from './kit/hoodieCurved';
import {METERS_PER_PX, SOLE_Y} from './guard';
import {RIG_GLOW, cardSpace, easeInOut, idle, pickPlace, sit, standFeet, walk} from './kit/motion';
import {Zone, assertLegsClear, assertPathClear} from './kit/collide';
import {
  CENTER_BOX, Focal, HEAD_EDGE_MARGIN, Head, PlanRowV2, angleOf, assertFramed, checkPlanV2, defineSet, dissolveTo, frameFocal, insertCloseUp, lockedShot, pushIn, toScreen,
} from './kit/camera';
import {FocusDof} from './kit/Dof';
import {PAL, paintSoftFloor} from './kit/finish';
import {SBox, SPlane} from './v2/gfx';
import {paintWall} from './v2/rooms';

export const KT6_FPS = 30;
export const KT6_FRAMES = 180;

const R = RIG_GLOW;
const S = 0.84;
const M = METERS_PER_PX * S; // metres per card px
const HEAD_Y = (SOLE_Y - 205) * M; // standing head centre height, m
const HEAD_R = 0.25; // head circle radius, m (hair included)
const DIP = '#1E1448';

// ---------------------------------------------------------------- layout (metres; x right, z toward the camera)
const CUP: V3 = [0.08, 0.795, -0.06]; // grip point = cup centre, standing on the table top (0.75 m)
const TABLE = {c: [0.35, -0.2] as [number, number], half: [0.45, 0.3] as [number, number], top: 0.75};
const OFFICER: V3 = [0.2, 0, -1.6]; // behind the table (far enough that his head stays inside the frame when the push-in ends)
const X0 = -1.5, XS = -0.42; // MAIN walks from x0 to xs (z = 0), head fully inside the frame at frame 0 (heads never touch the frame edge)
const WALK_END = 1.5, PICK_T = 1.5; // s
const D_WALK = XS - X0;
const V0 = D_WALK / 1.25; // cruise speed (estimate); decelerates linearly to 0 over the last 0.5 s
const walkDist = (t: number) => (t <= 1.0 ? V0 * t : t < WALK_END ? V0 * (1 + (t - 1) - (t - 1) ** 2) : D_WALK);
const walkK = (t: number) => (t < 1.0 ? 1 : 1 - easeInOut((t - 1.0) / 0.5)); // walk intensity: eases to standing over the last 0.5 s

const CHAIR_TOP = 0.3, CARD_Z = 0.36; // sit: card stands in front of the cushion (SEAT_CARD_DZ 0.36)
const HIP_UP_M = 41 * M; // HoodieCurved's hips sit 41 card px above RIG_GLOW's: lower the seat for the helper by the same amount, so the body sits ON the cushion
const SEAT_ZONE: Zone = {kind: 'box', name: 'chair', c: [0, 0], half: [0.23, 0.23]};
const PASS_X = 0.5;
const HOLD = 2.5; // s into scene 2: everything frozen from here (last 0.5 s = hard hold)

// ---------------------------------------------------------------- cameras (built once, pure math)
const FOV1 = 64, DIST1 = 5.6;
const WIDE: Pose = {p: [CUP[0], 1.05, CUP[2] + DIST1], l: CUP, fov: FOV1, roll: 0}; // axis passes through the cup, so a straight push keeps it centred
const PUSH_T = 1.5, PUSH_DUR = 1.5;
function buildCams() {
  const drift = lockedShot([WIDE.p[0] - 0.05, WIDE.p[1], WIDE.p[2]], [WIDE.l[0] - 0.05, WIDE.l[1], WIDE.l[2]], {drift: 0.05, fov: FOV1}); // ends exactly on the wide pose
  const ins = insertCloseUp({p: CUP, r: 0.06, name: 'cup'}, {from: WIDE, fill: 0.7});
  const push = pushIn(WIDE, ins.pose, {duration: PUSH_DUR, delay: PUSH_T});
  const cam1: CamFn = (u, t) => (t < PUSH_T ? drift(clamp01(t / PUSH_T), t) : push(u, t));
  const insertEnd = cam1(1, PUSH_T + PUSH_DUR);
  // scene 2: medium two-shot from the front-left, group centred between MAIN and PASSENGER
  const mid: V3 = [PASS_X / 2, 1.23, CARD_Z];
  const seat = frameFocal({p: mid, r: 0.2, name: 'MAIN + PASSENGER'}, {fov: 62, yaw: 16, pitch: 4, span: 0.5, minDist: 4.2});
  const seatCam = lockedShot(seat.p, seat.l, {drift: 0.04, fov: 62});
  const cam2: CamFn = (_u, t) => seatCam(clamp01(Math.min(t, HOLD) / HOLD), t);
  defineSet('officeA', {wideA: WIDE, insertA: insertEnd});
  defineSet('officeB', {seatB: seat});
  const dis = dissolveTo('seatB', {duration: 0.4, set: 'officeB', fps: KT6_FPS});
  return {cam1, cam2, ins, dis};
}

// ---------------------------------------------------------------- small helpers
const norm = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const sitDy = sit({rig: R, seatTop: CHAIR_TOP - HIP_UP_M, scale: S, k: 1}).body!.dy!;
const sitK = (t: number) => easeInOut((t - 0.1) / 0.7); // sit down 0.1 -> 0.8 s (0.7 s, above the 0.5 s minimum)
const mainHead2 = (t: number): V3 => [0, (SOLE_Y - 205 - sitDy * sitK(t)) * M, CARD_Z];
const passHead: V3 = [PASS_X, HEAD_Y, CARD_Z];
const officerHead: V3 = [OFFICER[0], HEAD_Y, OFFICER[2]];
const mainHead1 = (t: number): V3 => [X0 + walkDist(Math.min(t, WALK_END)), HEAD_Y, 0];

// MAIN expression timeline in scene 2 (local seconds): neutral -> smug -> surprised -> angry, mouth flap 1.45-2.45 s, blink about 0.9 s, ONE gaze flip at 1.45-1.65 s
const EXPR_PLAN: [number, number, ExprName, ExprName][] = [[0.8, 1.1, 'neutral', 'smug'], [1.45, 1.7, 'smug', 'surprised'], [2.0, 2.25, 'surprised', 'angry']];
const exprAt = (t: number) => {
  if (t < EXPR_PLAN[0][0]) return EXPR.neutral;
  for (const [a, b, from, to] of EXPR_PLAN) if (t >= a && t < b) return mixExpr(EXPR[from], EXPR[to], easeInOut((t - a) / (b - a)));
  return t < 1.45 ? EXPR.smug : t < 2.0 ? EXPR.surprised : EXPR.angry;
};
const speakAt = (t: number) => {
  const a = 1.45, b = 2.45;
  if (t < a || t > b) return 0;
  return Math.min(1, (t - a) / 0.1, (b - t) / 0.1) * (0.25 + 0.6 * Math.abs(Math.sin((t - a) * Math.PI * 3.4)));
};

// ---------------------------------------------------------------- set (standard materials, cheap: textured floor and walls, a few boxes)
const Lights: React.FC = () => (
  <>
    <hemisphereLight args={['#c7cbff', '#352A57', 1.1]} />
    <ambientLight intensity={0.25} />
    <directionalLight color="#ffd9a0" intensity={2.4} position={[-3, 4.5, 5]} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={0.5} shadow-camera-far={20} shadow-bias={-0.0005} shadow-normalBias={0.02} />
  </>
);
// Room extends past the camera on every side: x +-5, z -3 .. 11, ceiling 3 m.
export const Room: React.FC<{id: string; wall: string; stripe: string; floor: string}> = ({id, wall, stripe, floor}) => {
  const fl = useTex('kt6f' + id + floor, 512, 512, paintSoftFloor(floor, 96), [4, 6]);
  const wl = useTex('kt6w' + id + wall, 512, 512, paintWall(wall, stripe), [2, 1]);
  const W = 10, H = 3, Z0 = -3, Z1 = 11, ZC = (Z0 + Z1) / 2, DD = Z1 - Z0;
  return (
    <group>
      <SPlane w={W} h={DD} p={[0, 0, ZC]} rot={[-Math.PI / 2, 0, 0]} map={fl} r={0.55} />
      <SPlane w={W} h={DD} p={[0, H, ZC]} rot={[Math.PI / 2, 0, 0]} c={PAL.lavender.base} r={0.95} recv={false} />
      <SPlane w={W} h={H} p={[0, H / 2, Z0]} map={wl} r={0.9} />
      <SPlane w={DD} h={H} p={[-W / 2, H / 2, ZC]} rot={[0, Math.PI / 2, 0]} map={wl} r={0.9} />
      <SPlane w={DD} h={H} p={[W / 2, H / 2, ZC]} rot={[0, -Math.PI / 2, 0]} map={wl} r={0.9} />
      <SBox s={[W, 0.12, 0.04]} p={[0, 0.06, Z0 + 0.02]} c={PAL.indigo.base} cast={false} />
    </group>
  );
};
const Table: React.FC = () => {
  const [cx, cz] = TABLE.c;
  return (
    <group>
      <SBox s={[TABLE.half[0] * 2, 0.05, TABLE.half[1] * 2]} p={[cx, TABLE.top - 0.025, cz]} c={PAL.lilac.base} r={0.5} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <SBox key={i} s={[0.05, TABLE.top - 0.05, 0.05]} p={[cx + sx * (TABLE.half[0] - 0.05), (TABLE.top - 0.05) / 2, cz + sz * (TABLE.half[1] - 0.05)]} c={PAL.indigo.base} />
      ))}
    </group>
  );
};
const Chair: React.FC = () => (
  <group>
    <SBox s={[0.46, 0.05, 0.46]} p={[0, CHAIR_TOP - 0.025, 0]} c={PAL.rose.base} r={0.6} />
    <SBox s={[0.46, 0.46, 0.05]} p={[0, CHAIR_TOP + 0.23, -0.205]} c={PAL.rose.vivid} r={0.6} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
      <SBox key={i} s={[0.04, CHAIR_TOP - 0.05, 0.04]} p={[sx * 0.2, (CHAIR_TOP - 0.05) / 2, sz * 0.2]} c={PAL.indigo.base} />
    ))}
  </group>
);
// Cup: tapered body, coffee disc, handle. Shared geometry and materials (never per instance), 4 meshes.
const Cup: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <mesh castShadow geometry={shared('kt6cup', () => new THREE.CylinderGeometry(0.044, 0.034, 0.09, 24))} material={shared('kt6cupm', () => new THREE.MeshStandardMaterial({color: PAL.key, roughness: 0.4}))} />
    <mesh position={[0, 0.0415, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={shared('kt6coffee', () => new THREE.CircleGeometry(0.037, 24))} material={shared('kt6coffeem', () => new THREE.MeshStandardMaterial({color: '#3a2438', roughness: 0.3}))} />
    <mesh position={[0.04, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow geometry={shared('kt6handle', () => new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI))} material={shared('kt6cupm', () => new THREE.MeshStandardMaterial({color: PAL.key, roughness: 0.4}))} />
    <mesh position={[0, -0.047, 0]} geometry={shared('kt6saucer', () => new THREE.CylinderGeometry(0.06, 0.055, 0.008, 24))} material={shared('kt6saucerm', () => new THREE.MeshStandardMaterial({color: PAL.lavender.base, roughness: 0.5}))} />
  </group>
);
// Foreground shoulder: one dark ellipsoid glued to the camera (0.2 m in front, bottom-right corner, slides in from the edge during the push). Shared geometry + material.
const Foreground: React.FC<{pose: Pose; e: number}> = ({pose, e}) => {
  const f = norm([pose.l[0] - pose.p[0], pose.l[1] - pose.p[1], pose.l[2] - pose.p[2]]);
  const rl = Math.hypot(f[2], f[0]) || 1;
  const right: V3 = [-f[2] / rl, 0, f[0] / rl];
  const up: V3 = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
  const tv = Math.tan(((pose.fov ?? 60) * Math.PI) / 360), depth = 0.2, wHalf = depth * tv * (1080 / 1920), hHalf = depth * tv;
  const cx = wHalf * 1.36 + (1 - e) * wHalf * 2.4, cy = -hHalf * 0.8;
  const pos: V3 = [pose.p[0] + f[0] * depth + right[0] * cx + up[0] * cy, pose.p[1] + f[1] * depth + right[1] * cx + up[1] * cy, pose.p[2] + f[2] * depth + right[2] * cx + up[2] * cy];
  return <mesh position={pos} scale={[0.06, 0.09, 0.03]} renderOrder={5} geometry={shared('kt6fg', () => new THREE.SphereGeometry(1, 16, 12))} material={shared('kt6fgm', () => new THREE.MeshBasicMaterial({color: DIP, toneMapped: false}))} />;
};

// ---------------------------------------------------------------- scene 1
const CS_MAIN = cardSpace([XS, 0, 0], S, 0);
const PICK = pickPlace({
  start: PICK_T,
  rest: CS_MAIN.toWorld(R.handRest[1]),
  from: CUP,
  to: [0.16, CUP[1], CUP[2]],
  carry: [0.1, 0.99, CUP[2]],
  weight: 0.15,
  dur: {anticipate: 0.2, reach: 0.5, grip: 0.15, lift: 0.4, carry: 0.6, lower: 0.5, release: 0.15, retreat: 0.45},
});
const Scene1: React.FC<{t: number; u: number; cam: CamFn}> = ({t, u, cam}) => {
  const dist = walkDist(t), k = walkK(t);
  const w = walk(dist, {rig: R, scale: S, intensity: k, dir: 1});
  const pp = PICK(t);
  const hands: [[number, number] | null, [number, number] | null] = [w.hands![0], t >= PICK_T ? CS_MAIN.toCard(pp.hand) : w.hands![1]]; // slot 1 = the arm nearest the table (reach limit)
  const body = {dx: w.body!.dx, dy: (w.body!.dy ?? 0) + pp.dip * 12 * 0.65, lean: (w.body!.lean ?? 0) + 0.05 * pp.lean};
  const cupP: V3 = [pp.obj[0], pp.obj[1], CUP[2]];
  const pose = cam(u, t);
  const e = clamp01((t - PUSH_T) / 0.6); // foreground slide-in
  return (
    <>
      <Lights />
      <Room id="A" wall={PAL.lavender.base} stripe="#cfd0ee" floor="#8d86c4" />
      <Table />
      <Cup p={cupP} />
      <HoodieCurved pose={{t, expr: EXPR.neutral, turn: -0.3, ...idle(t, 1), feet: standFeet(R), blinkPhase: 1.1}} p={OFFICER} s={S} yawK={0} outfit="police" />
      <HoodieCurved pose={{t, expr: EXPR.neutral, turn: 0.3, ...w, hands, body, grip: [0, pp.grip]}} p={[X0 + dist, 0, 0]} s={S} yawK={0} />
      <Foreground pose={pose} e={e} />
    </>
  );
};

// ---------------------------------------------------------------- scene 2
const LAP = sit({rig: R, seatTop: CHAIR_TOP - HIP_UP_M, scale: S, k: 1}).hands!;
const Scene2: React.FC<{t: number}> = ({t}) => {
  const k = sitK(t);
  const sp = sit({rig: R, seatTop: CHAIR_TOP - HIP_UP_M, scale: S, k, t, seed: 0});
  const hb = easeInOut((k - 0.25) / 0.6); // hands go from hanging to the lap smoothly (the helper itself switches at k 0.6)
  const hands: [[number, number], [number, number]] = [
    [lerp(R.handRest[0][0], LAP[0]![0], hb), lerp(R.handRest[0][1], LAP[0]![1], hb)],
    [lerp(R.handRest[1][0], LAP[1]![0], hb), lerp(R.handRest[1][1], LAP[1]![1], hb)],
  ];
  const turn = lerp(-0.6, 0.6, easeInOut((t - 1.45) / 0.2)); // looks to its left (card-left), then flips to card-right: the arm layering swaps once
  return (
    <>
      <Lights />
      <Room id="B" wall="#E6D3EE" stripe="#d9c2e6" floor="#7d78b8" />
      <Chair />
      <HoodieCurved pose={{t, expr: exprAt(t), turn, speak: speakAt(t), blinkPhase: 0.2, ...sp, hands}} p={[0, 0, CARD_Z]} s={S} yawK={0} />
      <HoodieCurved pose={{t, expr: EXPR.neutral, turn: -0.4, ...idle(t, 2), feet: standFeet(R), blinkPhase: 1.0}} p={[PASS_X, 0, CARD_Z]} s={S} yawK={0} outfit="casual" />
    </>
  );
};

// ---------------------------------------------------------------- checks (setup time, results to console + window.__kit6)
const headEdgeFail = (pose: Pose, h: Head): string | null => {
  const s = toScreen(pose, h.p);
  if (s.depth <= 0.05) return null; // behind the camera
  const th = Math.tan(((pose.fov ?? 60) * Math.PI) / 360) * (1080 / 1920), r = (h.r / (s.depth * th)) * 540;
  const ex = HEAD_EDGE_MARGIN * 1080, ey = HEAD_EDGE_MARGIN * 1920;
  const inside = s.x - r >= ex && s.x + r <= 1080 - ex && s.y - r >= ey && s.y + r <= 1920 - ey;
  const outside = s.x + r < 0 || s.x - r > 1080 || s.y + r < 0 || s.y - r > 1920;
  return inside || outside ? null : `head "${h.name}" touches the frame edge (x ${s.x.toFixed(0)}, y ${s.y.toFixed(0)}, r ${r.toFixed(0)} px)`;
};
interface Report {ok: boolean; lines: string[]}
function runChecks(cam1: CamFn, cam2: CamFn, ins: ReturnType<typeof insertCloseUp>): Report {
  const lines: string[] = [];
  const add = (label: string, fn: () => void) => {
    try { fn(); lines.push(`PASS ${label}`); } catch (e) { lines.push(`FAIL ${label}: ${(e as Error).message}`); }
  };
  const warns: string[] = [];
  const ow = console.warn;
  console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
  const mainHeadObj = (t: number): Head => ({p: mainHead1(t), r: HEAD_R, name: 'MAIN'});
  const offHead: Head = {p: officerHead, r: HEAD_R, name: 'OFFICER'};
  const cupFocal: Focal = {p: CUP, r: 0.06, name: 'cup'};
  const plan: PlanRowV2[] = [
    {line: 'wide: OFFICER by the table, MAIN walks in and stops', from: 0, to: 45, words: 6, set: 'officeA', angle: 'wideA', shot: 'wide', move: 'locked', target: 'table, officer, MAIN', targets: [{p: CUP, r: 1.2, name: 'table'}], focal: cupFocal, heads: [offHead], why: 'establish the place; the cup on the table is the subject'},
    {line: 'push straight in to the cup, MAIN picks it up', from: 45, to: 90, words: 6, set: 'officeA', angle: 'insertA', shot: 'insert', move: 'push', target: 'cup', targets: [{p: CUP, r: 0.1, name: 'cup'}], focal: cupFocal, why: 'narrated small object: straight-on insert, hand cropped at the edge, DOF', prop: 'cup'},
    {line: 'dissolve: MAIN sits, PASSENGER beside', from: 90, to: 135, words: 6, set: 'officeB', angle: 'seatB', shot: 'medium', move: 'dissolve', target: 'MAIN and PASSENGER', targets: [{p: [PASS_X / 2, 1.23, CARD_Z], r: 0.6, name: 'two-shot'}], focal: {p: mainHead2(1.5), r: 0.27, head: true, name: 'MAIN face'}, heads: [{p: passHead, r: HEAD_R, name: 'PASSENGER'}], why: 'change of place; faces readable for the expression cycle'},
    {line: 'MAIN expressions, flap, gaze flip, then hard hold', from: 135, to: 180, words: 6, set: 'officeB', angle: 'seatB', shot: 'medium', move: 'locked', target: 'MAIN face', targets: [{p: mainHead2(HOLD), r: 0.3, name: 'MAIN face'}], focal: {p: mainHead2(HOLD), r: 0.27, head: true, name: 'MAIN face'}, heads: [{p: passHead, r: HEAD_R, name: 'PASSENGER'}], why: 'same framing continues, only the acting changes'},
  ];
  add('checkPlanV2', () => { checkPlanV2(plan); });
  add('angles: 3 named angles in the whole test', () => { const n = ['wideA', 'insertA'].map((a) => angleOf(a, 'officeA')).length + ['seatB'].map((a) => angleOf(a, 'officeB')).length; if (n !== 3) throw new Error(`${n} angles`); });
  add('assertFramed scene 1 wide (focal cup, OFFICER and MAIN heads in the box)', () =>
    assertFramed('scene1-wide', cam1, () => cupFocal, PUSH_T, (_u, t) => (t >= WALK_END - 0.01 ? [offHead, mainHeadObj(t)] : [offHead])));
  add('assertFramed scene 1 insert (focal cup in the box)', () => assertFramed('scene1-insert', (u, t) => cam1(u, PUSH_T + t), () => cupFocal, PUSH_DUR));
  add('assertFramed scene 2 (MAIN face focal + head, PASSENGER head)', () =>
    assertFramed('scene2', cam2, (_u, t) => ({p: mainHead2(t), r: 0.27, head: true, name: 'MAIN face'}), 3.0, () => [{p: passHead, r: HEAD_R, name: 'PASSENGER'}]));
  add('every frame: no head touches the frame edge (all 180 frames)', () => {
    const bad: string[] = [];
    for (let f = 0; f < 90; f++) {
      const t = f / KT6_FPS, pose = cam1(f / 90, t);
      for (const h of [offHead, mainHeadObj(t)]) { const m = headEdgeFail(pose, h); if (m) bad.push(`f${f}: ${m}`); }
    }
    for (let f = 90; f < 180; f++) {
      const t = (f - 90) / KT6_FPS, pose = cam2((f - 90) / 90, t);
      for (const h of [{p: mainHead2(Math.min(t, HOLD)), r: HEAD_R, name: 'MAIN'}, {p: passHead, r: HEAD_R, name: 'PASSENGER'}]) { const m = headEdgeFail(pose, h); if (m) bad.push(`f${f}: ${m}`); }
    }
    if (bad.length) throw new Error(`${bad.length} violations: ${bad.map((b) => b.replace(' touches the frame edge', '').replace(/ \(x .*\)/, '')).join(' | ')}`);
  });
  add('focal point in the box on every frame (cup in scene 1, MAIN face in scene 2)', () => {
    const [x0, x1, y0, y1] = [CENTER_BOX.x0 * 1080, CENTER_BOX.x1 * 1080, CENTER_BOX.y0 * 1920, CENTER_BOX.y1 * 1920];
    const bad: string[] = [];
    for (let f = 0; f < 180; f++) {
      const sc2 = f >= 90, t = (sc2 ? f - 90 : f) / KT6_FPS, pose = sc2 ? cam2((f - 90) / 90, t) : cam1(f / 90, t);
      const s = toScreen(pose, sc2 ? mainHead2(Math.min(t, HOLD)) : CUP);
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) bad.push(`f${f} (${s.x.toFixed(0)}, ${s.y.toFixed(0)})`);
    }
    if (bad.length) throw new Error(`${bad.length} frames outside the box, first: ${bad.slice(0, 5).join(', ')}`);
  });
  add('assertPathClear MAIN walk vs table and officer', () => {
    const zones: Zone[] = [{kind: 'box', name: 'table', c: TABLE.c, half: TABLE.half}, {kind: 'circle', name: 'officer', c: [OFFICER[0], OFFICER[2]], r: 0.25}];
    assertPathClear('MAIN walk', (t) => [X0 + walkDist(t), 0, 0], 0, WALK_END, zones);
  });
  add('assertLegsClear MAIN seated (k = 0.5 and 1)', () => {
    for (const k of [0.5, 1]) assertLegsClear(`MAIN sit k=${k}`, sit({rig: R, seatTop: CHAIR_TOP - HIP_UP_M, scale: S, k}), [0, 0, CARD_Z], S, SEAT_ZONE, CHAIR_TOP);
  });
  add('hand reach: cup within the arm reach at stop (slot 1 shoulder)', () => {
    const sh = CS_MAIN.toCard([CUP[0], CUP[1], 0]), dx = (sh[0] - 368) * M, dy = (sh[1] - 388) * M, d = Math.hypot(dx, dy);
    if (d > 0.995 * 290 * M) throw new Error(`cup is ${d.toFixed(2)} m from the shoulder, arm is ${(290 * M).toFixed(2)} m`);
  });
  console.warn = ow;
  warns.forEach((w) => lines.push(`WARN ${w}`));
  void ins;
  const ok = !lines.some((l) => l.startsWith('FAIL'));
  return {ok, lines};
}

// ---------------------------------------------------------------- composition
const dofR = (pose: Pose) => Math.min(1.2, Math.max(0.08, (Math.hypot(pose.l[0] - pose.p[0], pose.l[1] - pose.p[1], pose.l[2] - pose.p[2]) / DIST1) * 1.2));
export const KitTest6: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    const {cam1, cam2, ins, dis} = buildCams();
    const rep = runChecks(cam1, cam2, ins);
    (window as unknown as {__kit6?: Report}).__kit6 = rep;
    rep.lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[kit6]', l) : l.startsWith('WARN') ? console.warn('[kit6]', l) : console.info('[kit6]', l)));
    return [
      {
        from: 0, to: 90, light: 'indoor', ownLights: true, cam: cam1,
        post: (_f, pose) => (
          <EffectComposer multisampling={4}>
            <FocusDof pose={pose} focal={CUP} r={dofR(pose)} />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        ),
        render: (t, u) => <Scene1 t={t} u={u} cam={cam1} />,
      },
      {
        from: 90, to: 180, light: 'indoor', ownLights: true, cam: cam2, dip: {frames: dis.frames, color: DIP},
        post: (_f, pose) => (
          <EffectComposer multisampling={4}>
            <FocusDof pose={pose} focal={[0, 1.1, CARD_Z]} r={0.6} />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        ),
        render: (t) => <Scene2 t={Math.min(t, HOLD)} />,
      },
    ];
  }, []);
  return <SingleCanvasVideo shots={shots} fps={KT6_FPS} />;
};
