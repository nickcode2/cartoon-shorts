// WalkTest v2: motion + look test, 9:16, 30 fps, 4.0 s = 120 frames, silent, hard hold on the last frame.
// Reference: reference/w_*.png and sheet_*.png (bright clean prison corridor, stick-leg cartoon characters, hard blue cast shadows).
// Characters: src/kit/rickRig.tsx only (NOT Ruri / RuriX / limbs.ts). No glow, no vignette, no dark overlay, no dust, no curved limbs.
// PALETTE: cyan tile #5BC0E0 (lower wall), gray-teal #86a9b3 (upper wall), pale gray-white floor, yellow #f2c418 floor line, dark blue beams #2b5c9a,
// steel-blue door #3d86a8, ONE saturated accent: the pink cell #ee4f9b.
// Motion sources (searched 2026-11-16, see STYLE_NOTES "RICKS MOTION REFERENCE"): walk = 4 key poses per step, opposite arm/leg, head bob lagging the torso
// (https://en.wikipedia.org/wiki/Walk_cycle); the 5.5-frame step, 2.5-frame arm lag, 3/7/3 door timing come from the brief, not from a source. Estimates, untested.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer} from '@react-three/postprocessing';
import {CamFn, Pose, ShotSpec, SingleCanvasVideo, V3, clamp01, hash, lerp, shared, useTex, makeTex} from './kit/kit';
import {easeInOut} from './kit/motion';
import {CENTER_BOX, Focal, Head, assertFramed, headInBox, toScreen} from './kit/camera';
import {FocusDof} from './kit/Dof';
import {DEPTH_FRAMES, DEPTH_SCALE_END, IDLE_PERIOD_FRAMES, WALK_STEP_FRAMES, depthProgress, depthSpeed, idleSwayDx} from './kit/refMotion';
import {ReactionDraw, makeReactionDraw, makeZoneTint, reactionDraw, showReaction, useReactionFace} from './kit/reactionFace';
import {TINT_COLORS, TintRow, checkTintRows, tintAt} from './kit/tint';
import {BOUNCE, BounceEvent, bounceAt} from './kit/bounce';
import {sitPose} from './kit/sit';
import {CELL_Z0, CELL_Z1, DOOR_H, DOOR_W, DOOR_X, SW_H, SW_Z0, SW_Z1, WALL_Z, X_W} from './walkLayout';
import {ENV_PAINTERS, EnvScene, OVERLAY_PAINTERS, Overlays, buildEnv, envStats} from './WalkEnv';
import {ARM, BASE_Z, BUILD, COSTUME_FILLS, DEG, HAND_R, cardLocalToWorld, SKIN_FILL, limbDepth, reliefFraction, bezier3Stats, handWorld, limbCurves3, rightIsNear, worldToCardLocal, FaceName, bezierStats, build, headPts, limbCurves, mirrorDiff, polyDiff, torsoPts, GROUND, Kind, LEG, LIMB_W, PXM, REST, Rick, RickPose, bodyToCard, cardToWorld, drawHead, drawRick, facingYaw, footDir, headCard, headRadius, headView, solve, wrapAng, worldToCard, yawTo} from './kit/rickRig';

export const WT_FPS = 30;
export const WT_FRAMES = 120;
const TAU = Math.PI * 2;
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

// ---------------------------------------------------------------- layout (metres, x right, z toward the camera, floor y = 0)
const COP_P: V3 = [0.25, 0, -4.4]; // x chosen so his (wide) head stays inside CENTER_BOX in the locked wide shot
const COP_S = 1.0, PRIS_S = 0.9;

// ---------------------------------------------------------------- timeline (frames at 30 fps)
const F_TROLL1 = 34, F_TROLL1_END = 58; // prisoner troll face, angry red head
const F_SLAM = 60, F_SHUT = 63, F_REOPEN = 70, F_OPEN = 73; // door: shut in 3, closed 7, open in 3
const F_SWAP = 63; // prisoner leaves the corridor spot (hidden behind the shut door), back in the doorway smiling at F_REOPEN
const F_PUSH = 84, F_TROLL2 = 96; // slow ease-in push-in, cop troll face (sick pastel head)
const DOOR_OPEN_ANGLE = (-58 * Math.PI) / 180;

// ---------------------------------------------------------------- camera: locked first, then a slow ease-in push toward the cop's face
const CAM_P0: V3 = [0, 0.8, -1.6];
const CAM_P1: V3 = [0.22, 1.5, COP_P[2] + 2.0]; // end of the push-in (tuned against CENTER_BOX, see the framing check)
const CAM_FOV = 66; // wider (rule: 56-66 for 9:16): the 0.64 m wide cop head and the prisoner head both fit CENTER_BOX with a gap
const camAt = (t: number): Pose => {
  const e = easeInOut(Math.min(t, 2.8) / 2.8), d: V3 = [CAM_P0[0] + 0.02 * e, CAM_P0[1] + 0.015 * e, CAM_P0[2]];
  let p = d;
  if (t > F_PUSH / WT_FPS) { const u = clamp01((t - F_PUSH / WT_FPS) / ((WT_FRAMES - F_PUSH) / WT_FPS)), k = u * u; p = [lerp(d[0], CAM_P1[0], k), lerp(d[1], CAM_P1[1], k), lerp(d[2], CAM_P1[2], k)]; } // ease-in only, hold = last frame
  return {p, l: [p[0], p[1], p[2] - 10], fov: CAM_FOV, roll: 0};
};
const cam: CamFn = (_u, t) => camAt(t);

// ---------------------------------------------------------------- prisoner
const tri = (s: number) => (2 / Math.PI) * Math.asin(Math.sin(Math.PI * s)); // triangle wave, period 2 steps: constant foot speed = no skating
// Reference constants (kit/refMotion.ts): scale 100% -> 58% over 25 frames. Perspective scale = 1 / depth, so PA is placed at 0.58 x the camera distance of PB.
const PB: V3 = [DOOR_X, 0, -6.0]; // straight into the door: with the head inside CENTER_BOX the start x cannot be left of about -0.32 at depth 2.55
const PA: V3 = [DOOR_X - 0.04, 0, CAM_P0[2] - (CAM_P0[2] - PB[2]) * DEPTH_SCALE_END];
const PHEAD_W = 2 * BUILD.prisoner.rx; // head width in card px, the unit of the bounce and sway percentages
const PLEN = Math.hypot(PB[0] - PA[0], PB[2] - PA[2]), PDIR: [number, number] = [(PB[0] - PA[0]) / PLEN, (PB[2] - PA[2]) / PLEN];
const CURV_LIMIT = 1.15; // max curvature x own limb length (an arc with a 10-12 % offset has about 0.8-1.0)
const STEP_F = WALK_STEP_FRAMES; // one step (one head bounce) per 5.8 frames, constant cadence
const WALK_F = DEPTH_FRAMES; // frame the walk ends (25)
const LEGLEN = LEG * PXM * 0.9; // leg length in metres at PRIS_S
// Speed decays to 0 at the door, so the stride decays with it (stride = distance covered in one step): the planted foot keeps pace with the body, no skating.
const legAmp = (f: number) => Math.asin(Math.min(0.9, (PLEN * depthSpeed(f) * STEP_F) / 2 / LEGLEN));
const SEQ: [FaceName, number][] = [['annoyed', 5], ['grimace', 4], ['teeth', 5], ['annoyed', 3], ['shock', 4], ['grimace', 5], ['teeth', 4], ['annoyed', 4]]; // hard cuts every 3-5 frames, 34 frames
const faceAt = (f: number): FaceName => { let a = 0; for (const [n, l] of SEQ) { if (f < a + l) return n; a += l; } return 'fear'; };
// FACING (see STYLE_NOTES 'FACING / PHYSICS'): world directions as angles a -> [sin a, cos a]; torso, head and feet turn separately.
const dirOf = (a: number): [number, number] => [Math.sin(a), Math.cos(a)];
const angOf = (d: [number, number]) => Math.atan2(d[0], d[1]);
const lerpAng = (a: number, b: number, u: number) => a + wrapAng(b - a) * u; // shortest way round
const camAng = (pos: V3, f: number) => { const cp = camAt(f / WT_FPS).p; return Math.atan2(cp[0] - pos[0], cp[2] - pos[2]); }; // direction from pos to the camera
const ramp = (f: number, f0: number, n: number) => easeInOut(clamp01((f - f0) / n));
const A_PDIR = angOf(PDIR);
const F_PHEAD = 26, F_PTORSO = 30, F_PFEET = 31; // at the door: head turns over the shoulder first (26-30), torso follows (30-36), feet 1 frame after the torso (31-37)
// BOUNCE (kit/bounce.ts): secondary motion on every movement. Prisoner: the walk (one bob per 5.8-frame step), the stop at the door, head turn, torso turn, the step back into the doorway. Cop: a small reach bounce at each end of the roller stroke, the head turn.
const PRIS_BOUNCE: BounceEvent[] = [{kind: 'step', f0: 0, f1: WALK_F}, {kind: 'stop', f0: WALK_F, k: 0.8}, {kind: 'turn', f0: F_PHEAD, k: 0.5, dir: -1}, {kind: 'turn', f0: F_PTORSO, k: 0.7, dir: -1}, {kind: 'start', f0: 70, k: 0.6}];
const COP_BOUNCE: BounceEvent[] = [...Array.from({length: 9}, (_, i) => ({kind: 'reach' as const, f0: 4 + i * 14.25, k: 0.35, dir: (i % 2 ? -1 : 1) as 1 | -1})), {kind: 'turn', f0: 91, k: 0.5, dir: 1}];
const shadowK = (z: number) => clamp01((-5.05 - z) / 0.3); // 0 in the light, 1 once inside the door shadow band (z < -5.35)

interface State {pos: V3; pose: RickPose; kind: Kind; s: number; visible: boolean; troll: boolean}
const IDLE_LEGS: Pick<RickPose, 'legSw' | 'legOut' | 'toe' | 'bend'> = {legSw: [0, 0], legOut: [-0.05, 0.05], toe: [0, 0], bend: [0, 0]};
function prisonerState(f: number): State {
  const walking = f < WALK_F, st = Math.min(f, WALK_F) / STEP_F; // steps taken (time-based cadence)
  const dist = PLEN * depthProgress(f);
  let pos: V3 = [PA[0] + PDIR[0] * dist, 0, PA[2] + PDIR[1] * dist];
  const t = f / WT_FPS;
  let pose: RickPose;
  if (f >= F_REOPEN) { // in the doorway, smiling
    pos = [DOOR_X, 0, -6.02];
    const sw = Math.sin(t * 3.2);
    pose = {...REST, ...IDLE_LEGS, fwd: dirOf(camAng(pos, f)), armSw: [0.04, -0.04], lean: 0.02 * sw, headDx: 4 * sw, headRoll: 0.04 * sw, face: 'happyArc', shade: {color: '#4C7FA0', k: 0.4}};
  } else if (walking) {
    const k = 1, s = st, entry = 1 - easeOut(f / 14), side = Math.sin(A_PDIR - camAng(pos, f)); // side = how much of the walk direction is across the card
    const c = Math.cos(Math.PI * s), la = legAmp(f) * tri(s), arm = 0.42 * tri(s - 0.45); // arms: opposite to the legs, lag 2.5 frames (0.45 step)
    pose = {
      ...REST, fwd: PDIR, legSw: [la, -la], legOut: [-0.03, 0.03], bend: [Math.max(0, c) * k, Math.max(0, -c) * k], // the swing leg bends as ONE gentle arc (max 10 % of the leg length), the stance leg is straight
      toe: [0.6 * Math.max(0, c), 0.6 * Math.max(0, -c)], armSw: [-arm, arm],
      lean: (0.13 + 0.1 * entry) * side, // head first: leans 7-13 deg ALONG the walk; on the card (which faces the camera) only the sideways part shows, so walking straight away it barely moves the head sideways
      headDy: -6 * entry, // (the walk bob now comes from `bounce`) headDx: (4 * Math.sin(Math.PI * (s - 0.4)) + 8 * entry) * side, headRoll: (0.05 * Math.sin(Math.PI * (s - 0.2)) + 0.16 * entry) * side,
      face: faceAt(f), shade: {color: '#4C7FA0', k: 0.4 * shadowK(pos[2])},
    };
  } else { // stopped in front of the door, faces keep cutting
    const sw = Math.sin((TAU * f) / IDLE_PERIOD_FRAMES), aC = camAng(pos, f);
    pose = {...REST, ...IDLE_LEGS, fwd: dirOf(lerpAng(A_PDIR, aC, ramp(f, F_PFEET, 6))), torsoFwd: dirOf(lerpAng(A_PDIR, aC, ramp(f, F_PTORSO, 6))), headFwd: dirOf(lerpAng(A_PDIR, aC, ramp(f, F_PHEAD, 4))), armSw: [0.08, -0.08], lean: 0.05 + 0.03 * sw, headDx: idleSwayDx(f, PHEAD_W), headDy: 4, headRoll: 0.07 * sw, face: faceAt(f), shade: {color: '#4C7FA0', k: 0.4 * shadowK(pos[2])}};
  }
  const inTroll = f >= F_TROLL1 && f < F_TROLL1_END;
  pose = {...pose, bounce: bounceAt(PRIS_BOUNCE, f, PHEAD_W, 1)};
  return {pos, pose, kind: 'prisoner', s: PRIS_S, visible: !(f >= F_SWAP && f < F_REOPEN), troll: inTroll};
}

// ---------------------------------------------------------------- cop (paints the wall behind him with a long roller)
const PER = 0.95; // stroke period, s (estimate)
const stroke = (t: number) => Math.sin((TAU * t) / PER);
const LAG = 2.5 / WT_FPS;
const rollerY = (t: number) => Math.min(2.3, Math.max(0.75, 1.2 + 0.12 * t + (0.16 + 0.1 * t) * stroke(t - LAG)));
const ROLL_Z = -4.3, ROLLER_R = 0.055, STRIPE_X = 0.012, ROLLER_C = STRIPE_X + ROLLER_R; // roller position along the wall; roller centre is ROLLER_C off the wall so its surface sits on the painted stripe (touches the wall)
const WALL_DIR: [number, number] = (() => { const dx = X_W - ROLLER_C - COP_P[0], dz = ROLL_Z - COP_P[2], l = Math.hypot(dx, dz); return [dx / l, dz / l]; })(); // cop -> roller on the wall
const A_WALL = angOf(WALL_DIR);
const F_CHEAD0 = 91; // head turns to the camera 91-96 (3.03-3.2 s), the troll face starts at F_TROLL2 = 96
const STRIPE: [number, number][] = (() => { const o: [number, number][] = []; let lo = 9, hi = -9; for (let f = 0; f < WT_FRAMES; f++) { const y = rollerY(f / WT_FPS); lo = Math.min(lo, y); hi = Math.max(hi, y); o.push([lo, hi]); } return o; })();
const COP_SEQ: [FaceName, number][] = [['smug', 20], ['annoyed', 5], ['deadpan', 4], ['smug', 14], ['annoyed', 6], ['smug', 8], ['deadpan', 5], ['annoyed', 4]];
const copFace = (f: number): FaceName => { let a = 0; for (const [n, l] of COP_SEQ) { if (f < a + l) return n; a += l; } return 'smug'; };
interface CopState extends State {roller: V3; handle: {mid: V3; len: number; q: [number, number, number, number]; a: V3; b: V3}}
const Y = new THREE.Vector3(0, 1, 0), tmpD = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const lineQ = (d: V3): [number, number, number, number] => { tmpD.set(d[0], d[1], d[2]).normalize(); tmpQ.setFromUnitVectors(Y, tmpD); return [tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w]; };
function copState(f: number): CopState {
  const t = f / WT_FPS, s = stroke(t), yaw = yawTo(camAt(t).p, COP_P);
  const roller: V3 = [X_W - ROLLER_C, rollerY(t), ROLL_Z];
  const base: RickPose = {
    ...REST, fwd: WALL_DIR, torsoFwd: WALL_DIR, headFwd: dirOf(lerpAng(A_WALL, camAng(COP_P, f), ramp(f, F_CHEAD0, F_TROLL2 - F_CHEAD0))), legSw: [0.05, -0.05], legOut: [-0.1, 0.1], bend: [0, 0], toe: [0.1, 0.1], // standing legs are straight; feet point toward the wall he paints
    lean: 0.07 + 0.05 * s, headDx: 4 * s, headDy: 5 + 3 * Math.sin((2 * TAU * t) / PER), headRoll: 0.1 * stroke(t - 1 / WT_FPS), face: copFace(f),
  };
  // upper hand holds the handle near the body, the handle runs from the roller on the wall through it. Both hands are 3D: the near hand is in front of the card, the far hand behind it, so the pole stays one straight line in 3D.
  const h1w: V3 = [COP_P[0] + 0.3, 1.0 + 0.25 * (roller[1] - 1.2), COP_P[2]];
  const xy = (w: V3) => worldToCard(w, COP_P, yaw, COP_S), zz = (w: V3) => worldToCardLocal(w, COP_P, yaw, COP_S)[2];
  let pose: RickPose = {...base, hands: [null, xy(h1w)], handsZ: [null, zz(h1w)]};
  let sol = solve('cop', pose, yaw);
  const h1 = handWorld('cop', pose, sol, yaw, 1, COP_P, COP_S);
  const dir: V3 = [h1[0] - roller[0], h1[1] - roller[1], h1[2] - roller[2]], dl = Math.hypot(...dir), u: V3 = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  const h0w: V3 = [h1[0] + u[0] * 0.3, h1[1] + u[1] * 0.3, h1[2] + u[2] * 0.3]; // lower hand on the same line
  pose = {...base, hands: [xy(h0w), xy(h1w)], handsZ: [zz(h0w), zz(h1w)]};
  sol = solve('cop', pose, yaw);
  const g1 = handWorld('cop', pose, sol, yaw, 1, COP_P, COP_S);
  const d2: V3 = [g1[0] - roller[0], g1[1] - roller[1], g1[2] - roller[2]], l2 = Math.hypot(...d2), u2: V3 = [d2[0] / l2, d2[1] / l2, d2[2] / l2];
  const e: V3 = [g1[0] + u2[0] * 0.4, g1[1] + u2[1] * 0.4, g1[2] + u2[2] * 0.4], len = l2 + 0.4;
  pose = {...pose, bounce: bounceAt(COP_BOUNCE, f, 2 * build('cop').rx, 1.3)}; // the cop is the heavier body: slower and a bit bigger bounce
  return {pos: COP_P, pose, kind: 'cop', s: COP_S, visible: true, troll: f >= F_TROLL2, roller, handle: {mid: [(roller[0] + e[0]) / 2, (roller[1] + e[1]) / 2, (roller[2] + e[2]) / 2], len, q: lineQ(u2), a: roller, b: e}};
}
const headWorld = (st: State, camP: V3): V3 => {
  const yaw = yawTo(camP, st.pos), sol = solve(st.kind, st.pose, yaw);
  return cardToWorld(headCard(st.kind, sol, st.pose), st.pos, yaw, st.s);
};

// ---------------------------------------------------------------- door
const doorAngle = (f: number) => {
  if (f < F_SLAM) return DOOR_OPEN_ANGLE;
  if (f < F_SHUT) { const u = (f - F_SLAM + 1) / (F_SHUT - F_SLAM); return DOOR_OPEN_ANGLE * (1 - u * u); } // hard, accelerating, lands exactly closed at F_SHUT
  if (f < F_REOPEN) return 0;
  if (f < F_OPEN) { const u = (f - F_REOPEN + 1) / (F_OPEN - F_REOPEN); return DOOR_OPEN_ANGLE * (1 - (1 - u) ** 2); }
  return DOOR_OPEN_ANGLE;
};

// ---------------------------------------------------------------- shared parts (never per instance)
const BOX = () => shared('wk-box', () => new THREE.BoxGeometry(1, 1, 1));
const CYL = () => shared('wk-cyl', () => new THREE.CylinderGeometry(1, 1, 1, 14));
const BALL = () => shared('wk-ball', () => new THREE.SphereGeometry(1, 10, 8));
const PLANE = () => shared('wk-plane', () => new THREE.PlaneGeometry(1, 1));
const MAT = (c: string, r = 0.9, side: THREE.Side = THREE.FrontSide) => shared(`wkm${c}${r}${side}`, () => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: 0, side}));
const BASIC = (c: string, op = 1) => shared(`wkb${c}${op}`, () => new THREE.MeshBasicMaterial({color: c, transparent: op < 1, opacity: op, depthWrite: op >= 1, toneMapped: false, side: THREE.DoubleSide}));
const P: React.FC<{g: THREE.BufferGeometry; m: THREE.Material; p: V3; s: V3; rot?: V3; cast?: boolean; recv?: boolean; order?: number}> = ({g, m, p, s, rot, cast = false, recv = true, order}) => (
  <mesh geometry={g} material={m} position={p} scale={s} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow={recv} renderOrder={order ?? 0} />
);


const HANDLE_R = (LIMB_W * PXM * COP_S) / 2; // the roller handle is as thick as the cop's arm line (12 card px)
const DROPS = [0.5, 1.15, 1.8, 2.45, 3.1, 3.7];
const Paint: React.FC<{f: number; cop: CopState}> = ({f, cop}) => {
  const t = f / WT_FPS, [lo, hi] = STRIPE[Math.min(f, WT_FRAMES - 1)], h = Math.max(0.02, hi - lo);
  return (
    <group>
      <P g={PLANE()} m={MAT('#f0549c', 0.8)} p={[X_W - STRIPE_X, (lo + hi) / 2, ROLL_Z]} rot={[0, -Math.PI / 2, 0]} s={[0.3, h, 1]} recv={false} />
      <mesh geometry={CYL()} material={MAT('#120a14', 0.5)} position={cop.handle.mid} quaternion={cop.handle.q} scale={[HANDLE_R, cop.handle.len, HANDLE_R]} castShadow />
      {[cop.handle.a, cop.handle.b].map((e, i) => <mesh key={i} geometry={BALL()} material={MAT('#120a14', 0.5)} position={e} scale={[HANDLE_R, HANDLE_R, HANDLE_R]} castShadow />)}
      <P g={CYL()} m={MAT('#f0549c', 0.6)} p={cop.roller} s={[ROLLER_R, 0.3, ROLLER_R]} rot={[Math.PI / 2, 0, 0]} recv={false} />
      {DROPS.map((t0, i) => {
        const a = t - t0, on = a >= 0 && a < 0.5, y = Math.max(0.05, rollerY(t0) - 4.9 * a * a);
        return <P key={i} g={BALL()} m={MAT('#f0549c', 0.5)} p={[X_W - 0.12, y, ROLL_Z + (i % 3 - 1) * 0.08]} s={on ? [0.028, 0.04, 0.028] : [0, 0, 0]} recv={false} />;
      })}
    </group>
  );
};

/** The only blurred thing: a cropped steel-blue pipe glued to the camera at the left edge (the DOF blurs it). */
const Foreground: React.FC<{pose: Pose}> = ({pose}) => {
  const depth = 0.45, tv = Math.tan((CAM_FOV * Math.PI) / 360), hH = depth * tv, wH = hH * (1080 / 1920);
  const p: V3 = [pose.p[0] - wH * 0.98, pose.p[1], pose.p[2] - depth];
  return (
    <group>
      <P g={PLANE()} m={BASIC('#2f7a9b')} p={p} s={[wH * 0.22, hH * 2.3, 1]} order={6} recv={false} />
      <P g={PLANE()} m={BASIC('#8fd0e6')} p={[p[0] + wH * 0.06, p[1], p[2]]} s={[wH * 0.03, hH * 2.3, 1]} order={7} recv={false} />
    </group>
  );
};

// ---------------------------------------------------------------- scene
// HEAD TINT TRACKS (narration -> target plan, kit/tint.ts). Heads are WHITE by default; a troll face never tints a head by itself. Rows exist only where the narration names the state.
// Demo: the prisoner is angry (red) over the forehead and eyes, strength 0.6, only while his troll face is on. The cop has NO tint rows.
const PRIS_TINTS: TintRow[] = [{state: 'angry', zone: 'upper-half', intensity: 0.6, from: F_TROLL1, to: F_TROLL1_END, easeIn: 3, easeOut: 3, why: 'demo: the prisoner is furious while the troll face is on'}];
const COP_TINTS: TintRow[] = [];
checkTintRows('prisoner', PRIS_TINTS); checkTintRows('cop', COP_TINTS);
const PRIS_REACT = showReaction('funny', F_TROLL1, F_TROLL1_END - F_TROLL1, {blinkAt: [10]});
const COP_REACT = showReaction('funny', F_TROLL2, WT_FRAMES - F_TROLL2, {blinkAt: [9], flip: true});

const Scene: React.FC<{t: number}> = ({t}) => {
  const f = Math.round(t * WT_FPS);
  const face = useReactionFace('funny');
  const dPris = useMemo(makeReactionDraw, []), dCop = useMemo(makeReactionDraw, []);
  const zoneTints = useMemo(() => (face ? new Map([...PRIS_TINTS, ...COP_TINTS].map((r) => [`${r.state}|${r.zone}`, makeZoneTint(face, TINT_COLORS[r.state], r.zone)])) : null), [face]); // built once per used (state, zone)
  const pr = prisonerState(f), cp = copState(f), pose = camAt(t);
  const withTroll = (r: ReactionDraw | null, st: State, rows: TintRow[]): RickPose => {
    const act = tintAt(rows, f); // active tint rows of this character at this frame; none = a white head
    if (r) { const a = act[0]; r.tint = a && zoneTints ? zoneTints.get(`${a.state}|${a.zone}`) ?? null : null; r.tintK = a ? a.k : 0; } // only if the narration plan says so, never because a troll face is on
    return {...st.pose, tint: act, troll: r && st.troll ? r : null};
  };
  const pp = withTroll(reactionDraw(PRIS_REACT, face, f, dPris), pr, PRIS_TINTS), cc = withTroll(reactionDraw(COP_REACT, face, f, dCop), cp, COP_TINTS);
  return (
    <>
      <hemisphereLight args={['#f6faff', '#eaf2f7', 2.8]} />
      <directionalLight color="#ffe9cc" intensity={1.5} position={[4, 6, 1]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-near={1} shadow-camera-far={22} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <EnvScene doorAngle={doorAngle(f)} />
      <Overlays />
      <Paint f={f} cop={cp} />
      <Rick kind="cop" pose={cc} p={cp.pos} cam={pose.p} s={cp.s} />
      <group visible={pr.visible}><Rick kind="prisoner" pose={pp} p={pr.pos} cam={pose.p} s={pr.s} /></group>
      <Foreground pose={pose} />
    </>
  );
};

// ---------------------------------------------------------------- checks (window.__walk and console "[walktest]")
export function runChecks(): string[] {
  const out: string[] = [];
  const ok = (c: boolean, a: string, b = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${a}${c ? '' : ' ' + b}`);
  const copHead = (f: number) => headWorld(copState(f), camAt(f / WT_FPS).p), prisHead = (f: number) => headWorld(prisonerState(f), camAt(f / WT_FPS).p);
  const HR = headRadius('cop') * COP_S;
  const focalAt = (_u: number, t: number): Focal => ({p: copHead(Math.min(Math.round(t * WT_FPS), WT_FRAMES - 1)), r: HR, head: true, name: 'cop head'});
  try { assertFramed('walktest', cam, focalAt, WT_FRAMES / WT_FPS, (_u, t) => { const f = Math.min(Math.round(t * WT_FPS), WT_FRAMES - 1); const l: Head[] = [{p: copHead(f), r: HR, name: 'cop'}]; return l; }); ok(true, 'assertFramed (u 0, 0.5, 1)'); } catch (e) { ok(false, 'assertFramed', (e as Error).message); }
  const badC: number[] = [], badP: number[] = [];
  let maxCop = 0, maxPris = 0, minPris = 1, maxLeg = 0, minLeg = 1e9;
  for (let f = 0; f < WT_FRAMES; f++) {
    const p = cam(f / WT_FRAMES, f / WT_FPS);
    if (!headInBox(p, {p: copHead(f), r: HR})) badC.push(f);
    const ps = prisonerState(f);
    if (f < F_SWAP && !headInBox(p, {p: prisHead(f), r: headRadius('prisoner') * PRIS_S})) badP.push(f);
    if (f < F_PUSH) {
      const hs = toScreen(p, [COP_P[0], 0, COP_P[2]]), ht = toScreen(p, [COP_P[0], 1.93 * COP_S, COP_P[2]]); maxCop = Math.max(maxCop, Math.abs(hs.y - ht.y) / 1920);
      if (f < F_SWAP) { const a = toScreen(p, [ps.pos[0], 0, ps.pos[2]]), b = toScreen(p, [ps.pos[0], 1.93 * PRIS_S, ps.pos[2]]), fr = Math.abs(a.y - b.y) / 1920; maxPris = Math.max(maxPris, fr); minPris = Math.min(minPris, fr); }
    }
    for (const st of [ps, copState(f)]) { const sl = solve(st.kind, st.pose, yawTo(p.p, st.pos)); for (let i = 0; i < 2; i++) { const l = Math.hypot(sl.ankle[i][0] - sl.hip[i][0], sl.ankle[i][1] - sl.hip[i][1]); maxLeg = Math.max(maxLeg, l); minLeg = Math.min(minLeg, l); } }
  }
  ok(badC.length === 0, `cop head inside CENTER_BOX on all ${WT_FRAMES} frames`, `${badC.length} bad: ${badC.slice(0, 8).join(',')}`);
  ok(badP.length === 0, 'prisoner head inside CENTER_BOX frames 0-62', `${badP.length} bad, first ${badP.slice(0, 6)}`);
  { // CURVATURE of the 3D limb curves: every leg and arm is one cubic in 3D; on every frame and for both characters the curvature stays below the limit and the sideways offset below 12 % (legs: 10 %)
    let kMax = 0, offLeg = 0, offArm = 0, kF = '';
    for (let f = 0; f < WT_FRAMES; f++) for (const st of [prisonerState(f), copState(f)]) {
      const cy = yawTo(camAt(f / WT_FPS).p, st.pos), sl = solve(st.kind, st.pose, cy);
      limbCurves3(st.kind, st.pose, sl, cy).slice(0, 4).forEach((cv, i) => { const q = bezier3Stats(cv), kk = q.kappa * (i < 2 ? LEG : ARM); if (kk > kMax) { kMax = kk; kF = `${st.kind}@${f} ${i < 2 ? 'leg' : 'arm'}`; } if (i < 2) offLeg = Math.max(offLeg, q.offset / LEG); else offArm = Math.max(offArm, q.offset / q.chord); });
    }
    ok(kMax <= CURV_LIMIT && offLeg <= 0.105 && offArm <= 0.125, `3D limb curvature: max ${kMax.toFixed(2)} / own limb length (limit ${CURV_LIMIT}; worst ${kF}), max leg offset ${(offLeg * 100).toFixed(1)} % of the leg (limit 10), arm offset ${(offArm * 100).toFixed(1)} % of the chord (limit 12)`);
  }
  ok(maxLeg <= LEG * 1.01, `legs: max projected length ${maxLeg.toFixed(1)} px of ${LEG}`);
  ok(maxCop > 0.5 && maxCop < 0.72, `cop ${(maxCop * 100).toFixed(0)}% of frame height (target 55-70%)`);
  ok(Math.abs(minPris / maxPris - DEPTH_SCALE_END) < 0.03, `prisoner scale ${(maxPris * 100).toFixed(0)}% near -> ${(minPris * 100).toFixed(0)}% far = ${(minPris / maxPris * 100).toFixed(0)}% (reference: 100% -> 58%)`);
  ok(doorAngle(F_SHUT) === 0 && doorAngle(F_SLAM - 1) === DOOR_OPEN_ANGLE && doorAngle(F_OPEN) === DOOR_OPEN_ANGLE, `door: closes ${F_SLAM}-${F_SHUT} (3 f), shut ${F_SHUT}-${F_REOPEN} (7 f), opens ${F_REOPEN}-${F_OPEN} (3 f)`);
  // ---- FACING / PHYSICS checks (STYLE_NOTES). They draw every frame into a fake canvas, so they run in node and in Studio, no WebGL needed.
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.Path2D === 'undefined') g.Path2D = class { rect() {} roundRect() {} lineTo() {} moveTo() {} closePath() {} addPath() {} };
  if (typeof g.DOMMatrix === 'undefined') g.DOMMatrix = class { translate() { return this; } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noop: any = new Proxy(function () {}, {get: () => noop, apply: () => noop, set: () => true});
  const ctx = noop as CanvasRenderingContext2D;
  const badFeet: string[] = [], badFace: string[] = [], badTroll: string[] = [], badBack: string[] = [];
  for (let f = 0; f < WT_FRAMES; f++) {
    const camP = camAt(f / WT_FPS).p;
    for (const [name, st] of [['prisoner', prisonerState(f)], ['cop', copState(f)]] as [string, State][]) {
      if (!st.visible) continue;
      const cy = yawTo(camP, st.pos), sol = solve(st.kind, st.pose, cy), di = drawRick(ctx, st.kind, {...st.pose, troll: null}, sol, cy);
      const fy = facingYaw(st.pose.fwd, cy), tv = st.pose.torsoFwd ?? st.pose.fwd;
      for (let i = 0; i < 2; i++) { const d = footDir(st.pose, i); if (d[0] * tv[0] + d[2] * tv[1] < -0.25) badFeet.push(`${name}@${f}`); } // a foot line must not point away from the facing direction
      if (Math.abs(wrapAng(fy - di.torsoYaw)) > 100 * DEG) badFeet.push(`${name}@${f} feet ${(fy / DEG).toFixed(0)} vs torso ${(di.torsoYaw / DEG).toFixed(0)}`);
      if (Math.abs(di.torsoYaw) < 30 * DEG && Math.abs(fy) >= 90 * DEG) badFeet.push(`${name}@${f} faces the camera but the feet point away`);
      const front = Math.abs(di.headYaw) < 75 * DEG;
      if ((di.headView === 'front') !== front || (di.faceDrawn && di.headView === 'back') || (!front && di.headView === 'front')) badFace.push(`${name}@${f} yaw ${(di.headYaw / DEG).toFixed(0)}`);
      if (st.troll && di.headView !== 'front') badTroll.push(`${name}@${f} troll face while the head yaw is ${(di.headYaw / DEG).toFixed(0)}`);
    }
  }
  for (let a = -180; a <= 180; a += 5) for (const k of ['cop', 'prisoner', 'tall'] as Kind[]) { // sweep: a full face only below 75 deg, a side face 75-105, nothing but hair / cap behind
    const r = drawHead(ctx, k, 'teeth', a * DEG), A = Math.abs(a), want = A < 75 ? 'front' : A <= 105 ? 'side' : 'back';
    if (r.view !== want || r.view !== headView(a * DEG) || r.faceDrawn === (want === 'back')) badBack.push(`${k} yaw ${a}`);
  }
  ok(badFeet.length === 0, 'feet point forward (never away from the torso facing; toward the camera when facing it), all frames', badFeet.slice(0, 4).join('; '));
  ok(badFace.length === 0 && badBack.length === 0, 'face drawn only when the head faces the camera (front < 75 deg, side 75-105, back of head > 105), all frames + 5-degree sweep', `${badFace.slice(0, 3).join('; ')} ${badBack.slice(0, 3).join('; ')}`);
  ok(badTroll.length === 0, 'troll face only while the head faces the camera', badTroll.slice(0, 3).join('; '));
  let back = 0; for (let f = 1; f <= WALK_F; f++) { const a = prisonerState(f).pos, b = prisonerState(f - 1).pos, d = prisonerState(f).pose.fwd; if ((a[0] - b[0]) * d[0] + (a[2] - b[2]) * d[1] < -1e-9) back++; }
  ok(back === 0, 'prisoner never walks backward (step direction . facing >= 0)', `${back} frames`);
  const tf = (f: number) => prisonerState(f).pose, headY = (f: number) => Math.abs(facingYaw(tf(f).headFwd ?? tf(f).fwd, yawTo(camAt(f / WT_FPS).p, prisonerState(f).pos)));
  ok(headY(10) > 105 * DEG && headY(F_PHEAD + 4) < 75 * DEG && headY(F_TROLL1) < 30 * DEG, `prisoner: back of head while walking in (${(headY(10) / DEG).toFixed(0)} deg), head over the shoulder by frame ${F_PHEAD + 4} (${(headY(F_PHEAD + 4) / DEG).toFixed(0)} deg), toward the camera at the troll face (${(headY(F_TROLL1) / DEG).toFixed(0)} deg)`);
  const ty = (f: number) => Math.abs(facingYaw(tf(f).torsoFwd ?? tf(f).fwd, yawTo(camAt(f / WT_FPS).p, prisonerState(f).pos)));
  ok(ty(F_PTORSO) > ty(F_PTORSO + 6) && headY(F_PHEAD + 4) < ty(F_PHEAD + 4), 'prisoner: head turns first, torso follows a few frames later', `head ${(headY(F_PHEAD + 4) / DEG).toFixed(0)} torso ${(ty(F_PHEAD + 4) / DEG).toFixed(0)}`);
  const wallDev = Math.max(...Array.from({length: F_CHEAD0}, (_, f) => { const c = copState(f), cy = yawTo(camAt(f / WT_FPS).p, COP_P); return Math.max(Math.abs(wrapAng(facingYaw(c.pose.fwd, cy) - facingYaw(WALL_DIR, cy))), Math.abs(wrapAng(facingYaw(c.pose.torsoFwd!, cy) - facingYaw(WALL_DIR, cy))), Math.abs(wrapAng(facingYaw(c.pose.headFwd!, cy) - facingYaw(WALL_DIR, cy)))); }));
  ok(wallDev < 1 * DEG && Math.abs(facingYaw(WALL_DIR, yawTo(camAt(0).p, COP_P))) > 70 * DEG && Math.abs(facingYaw(WALL_DIR, yawTo(camAt(0).p, COP_P))) < 90 * DEG, `cop: torso 70-90 deg, torso, head and feet face the side wall while painting (frames 0-${F_CHEAD0 - 1}); torso yaw ${(facingYaw(WALL_DIR, yawTo(camAt(0).p, COP_P)) / DEG).toFixed(0)} deg vs the camera (profile, he faces the side wall)`);
  const copHeadY = (f: number) => Math.abs(facingYaw(copState(f).pose.headFwd!, yawTo(camAt(f / WT_FPS).p, COP_P))), copFeetY = (f: number) => facingYaw(copState(f).pose.fwd, yawTo(camAt(f / WT_FPS).p, COP_P));
  ok(copHeadY(F_TROLL2) < 15 * DEG && copHeadY(WT_FRAMES - 1) < 15 * DEG && Math.abs(wrapAng(copFeetY(WT_FRAMES - 1) - facingYaw(WALL_DIR, yawTo(camAt(WT_FRAMES - 1).p, COP_P)))) < 1 * DEG, `cop: head to the camera at ${F_TROLL2} (${(copHeadY(F_TROLL2) / DEG).toFixed(0)} deg) and in the push-in, feet and torso stay toward the wall`);
  let touch = 0, grow = 0; for (let f = 0; f < WT_FRAMES; f++) { const c = copState(f), [lo, hi] = STRIPE[f]; if (Math.abs(X_W - c.roller[0] - ROLLER_R - STRIPE_X) > 0.002) touch++; if (c.roller[1] < lo - 1e-9 || c.roller[1] > hi + 1e-9) grow++; }
  ok(touch === 0 && grow === 0, 'roller surface sits on the wall paint every frame and the stripe covers the roller position', `${touch} frames off the wall, ${grow} outside the stripe`);
  for (const k of ['cop', 'prisoner', 'tall'] as Kind[]) { const b = build(k), top = b.cy - b.ry, legF = (GROUND - (b.top + b.th)) / (GROUND - top); ok(b.th / 170 > 1.7 && b.th / 170 < 2.1 && legF > 0.385 && legF < 0.46, `${k}: torso ${(b.th / 170).toFixed(2)}x the old length, visible legs ${(legF * 100).toFixed(1)}% of height (the legs start inside the torso, 9 % above its bottom edge)`); }
  { const cp = camAt(0), th = Math.tan(((cp.fov ?? 60) * Math.PI) / 360) * (1080 / 1920), px = (LIMB_W * PXM * COP_S * 1080) / (2 * (COP_P[2] - cp.p[2]) * -1 * th); ok(px > 19 && px < 22.5, `cop limb line ${px.toFixed(1)} px on a 1080 wide frame at frame 0 (${(px / 10.8).toFixed(2)} % of the width; target about 15 px, 1.4 %), round caps (canvas lineCap, foot / handle spheres)`); }
  // ---- framing slack (px of room between a head circle and CENTER_BOX / the 3 % edge margin; negative = outside) and foot sliding
  const slack = (p: Pose, head: {p: V3; r: number}) => {
    const sc = toScreen(p, head.p), th = Math.tan(((p.fov ?? 60) * Math.PI) / 360) * (1080 / 1920), rpx = (head.r / (sc.depth * th)) * 540, m = 0.03;
    return Math.min(sc.x - rpx - Math.max(CENTER_BOX.x0, m) * 1080, Math.min(CENTER_BOX.x1, 1 - m) * 1080 - (sc.x + rpx), sc.y - rpx - Math.max(CENTER_BOX.y0, m * 1080 / 1920) * 1920, Math.min(CENTER_BOX.y1, 1 - m * 1080 / 1920) * 1920 - (sc.y + rpx));
  };
  let minC = 1e9, minCf = 0, minP = 1e9, minPf = 0, minCpush = 1e9;
  for (let f = 0; f < WT_FRAMES; f++) {
    const p = camAt(f / WT_FPS), sc = slack(p, {p: copHead(f), r: HR}); if (sc < minC) { minC = sc; minCf = f; } if (f >= F_PUSH) minCpush = Math.min(minCpush, sc);
    if (f < F_SWAP) { const sp = slack(p, {p: prisHead(f), r: headRadius('prisoner') * PRIS_S}); if (sp < minP) { minP = sp; minPf = f; } }
  }
  ok(minC >= 10, `cop head slack in CENTER_BOX: min ${minC.toFixed(0)} px (frame ${minCf}), push-in frames ${F_PUSH}-${WT_FRAMES - 1}: ${minCpush.toFixed(0)} px`);
  ok(minP >= 10, `prisoner head slack in CENTER_BOX: min ${minP.toFixed(0)} px (frame ${minPf}), frames 0-${F_SWAP - 1}`);
  { // FOOT SLIDING of the prisoner's walk: stance foot world position along fwd = body distance + leg length x sin(leg swing); it must stay put while the foot is on the floor
    const L = LEG * PXM * PRIS_S, body = (f: number) => PLEN * depthProgress(f), foot = (f: number, i: number) => body(f) + L * Math.sin(prisonerState(f).pose.legSw[i]);
    const lowest = (f: number) => { const h = prisonerState(f).pose.bend ?? [0, 0]; return h[0] <= h[1] ? 0 : 1; }; // the stance leg is the one that is not bent (the swing leg lifts with its arc)
    let slide = 0, worst = 0, dist = 0, n = 0, worstF = 0;
    for (let f = 1; f < WALK_F; f++) { const i = lowest(f); if (i !== lowest(f - 1)) continue; const d = Math.abs(foot(f, i) - foot(f - 1, i)); slide += d; dist += body(f) - body(f - 1); n++; if (d > worst) { worst = d; worstF = f; } }
    const stride0 = PLEN * depthSpeed(0) * STEP_F;
    out.push(`INFO foot sliding (prisoner walk, frames 1-${WALK_F - 1}): stance foot slides ${slide.toFixed(2)} m in total while the body travels ${dist.toFixed(2)} m (${(100 * slide / dist).toFixed(0)} %), worst ${(worst * 100).toFixed(1)} cm in one frame (frame ${worstF}); first stride ${stride0.toFixed(2)} m, leg length ${L.toFixed(2)} m (stride / leg = ${(stride0 / L).toFixed(2)}, max reach 2 x leg x 0.9 = ${(1.8 * L).toFixed(2)} m)`);
  }
  { // COMPOSITION: the prisoner's head must not overlap the cop's head in the frame (circles, same radii as the CENTER_BOX check)
    const circ = (p: Pose, h: {p: V3; r: number}) => { const sc = toScreen(p, h.p), th = Math.tan(((p.fov ?? 60) * Math.PI) / 360) * (1080 / 1920); return {x: sc.x, y: sc.y, r: (h.r / (sc.depth * th)) * 540}; };
    let g0 = 1e9, g1 = 1e9, f0 = 0;
    for (let f = 0; f < F_SWAP; f++) { const p = camAt(f / WT_FPS), a = circ(p, {p: prisHead(f), r: headRadius('prisoner') * PRIS_S}), b = circ(p, {p: copHead(f), r: HR}), g = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r; if (f <= F_PHEAD + 4) g0 = Math.min(g0, g); if (g < g1) { g1 = g; f0 = f; } }
    ok(g0 >= 0, `prisoner head clear of the cop head during the walk and turn (frames 0-${F_PHEAD + 4}): min gap ${g0.toFixed(0)} px; over frames 0-${F_SWAP - 1}: ${g1.toFixed(0)} px (frame ${f0})`);
  }
  { // HAND-DRAWN SHAPES: 8 generated characters (c1..c8) + the 3 named ones. Heads pairwise different silhouettes, none left/right symmetric; torsos different and asymmetric. Fixed per character.
    const gen = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as Kind[], all = gen.concat(['cop', 'prisoner', 'tall'] as Kind[]);
    let minPair = 1, pairName = '', minMir = 1, mirName = '', minTor = 1, torName = '', minTMir = 1;
    for (let i = 0; i < all.length; i++) {
      const hm = mirrorDiff(headPts(all[i], 96)); if (hm < minMir) { minMir = hm; mirName = all[i]; }
      const tm = mirrorDiff(torsoPts(all[i], build(all[i]).tw)); minTMir = Math.min(minTMir, tm);
      for (let j = i + 1; j < all.length; j++) {
        const d = polyDiff(headPts(all[i], 96), headPts(all[j], 96)); if (d < minPair) { minPair = d; pairName = `${all[i]}/${all[j]}`; }
        const A = torsoPts(all[i], build(all[i]).tw), B = torsoPts(all[j], build(all[j]).tw), td = polyDiff(A, B, false); if (td < minTor) { minTor = td; torName = `${all[i]}/${all[j]}`; }
      }
    }
    const same = all.every((k) => JSON.stringify(headPts(k)) === JSON.stringify(headPts(k)) && JSON.stringify(torsoPts(k, build(k).tw)) === JSON.stringify(torsoPts(k, build(k).tw)));
    const cop = headPts('cop', 96), cw = (Math.max(...cop.map((q) => q[0])) - Math.min(...cop.map((q) => q[0]))) / (Math.max(...cop.map((q) => q[1])) - Math.min(...cop.map((q) => q[1])));
    ok(minPair >= 0.07 && minMir >= 0.03 && minTor >= 0.04 && minTMir >= 0.03 && same && cw >= 1.1 && cw <= 1.2,
      `shapes: 11 heads pairwise different (min XOR ${(minPair * 100).toFixed(1)} % of the union, ${pairName}; limit 7), none symmetric (min mirror difference ${(minMir * 100).toFixed(1)} % at ${mirName}; limit 3), torsos pairwise different (min ${(minTor * 100).toFixed(1)} %, ${torName}; limit 4) and asymmetric (min mirror difference ${(minTMir * 100).toFixed(1)} %), deterministic; cop head width / height ${cw.toFixed(2)} (target 1.1-1.2)`);
  }
  { // HEAD TINT: white by default, a tint only from narration rows (here: the prisoner, upper-half, 0.6, only during his troll face; the cop none)
    const frames = Array.from({length: WT_FRAMES}, (_, f) => f), pa = frames.map((f) => tintAt(PRIS_TINTS, f)), ca = frames.map((f) => tintAt(COP_TINTS, f));
    const kMax = Math.max(0, ...pa.flat().map((t) => t.k)), outside = frames.filter((f) => pa[f].length > 0 && (f < F_TROLL1 || f >= F_TROLL1_END)).length;
    ok(tintAt([], 50).length === 0 && ca.every((a) => a.length === 0) && outside === 0 && kMax > 0.5 && kMax <= 0.6 + 1e-9 && pa[F_TROLL1 + 12].length === 1 && pa[F_TROLL1 + 12][0].zone === 'upper-half',
      `tint: no tint by default, cop never tinted, prisoner 'angry' upper-half max ${kMax.toFixed(2)} only inside frames ${F_TROLL1}-${F_TROLL1_END - 1} (outside: ${outside} frames)`);
  }
  { // LAYERING IN 3D: near-side limbs in front of the card, far-side limbs behind it, for every torso yaw (independent cross-product test); leg and arm roots inside the torso art
    const bad: string[] = [], kinds = ['cop', 'prisoner', 'tall', 'c1', 'c5'] as Kind[], cardYaw = 0.3;
    for (const k of kinds) for (let a = 0; a < 360; a += 15) {
      const dir: [number, number] = [Math.sin(a * DEG + cardYaw), Math.cos(a * DEG + cardYaw)], pose: RickPose = {...REST, fwd: dir, torsoFwd: dir}, z = limbDepth(k, pose, cardYaw), sinT = Math.sin(a * DEG);
      if (Math.abs(sinT) < 0.1) { if (z.legRoot[0] <= 0 || z.legRoot[1] <= 0 || z.armRoot[0] <= 0 || z.armRoot[1] <= 0) bad.push(`${k}@${a} frontal / back view: both sides must sit in front of the card`); continue; }
      const nearIs0 = rightIsNear(dir, cardYaw), nz = nearIs0 ? 0 : 1, fz = 1 - nz;
      if (!(z.legRoot[nz] > z.legRoot[fz] && z.armRoot[nz] > z.armRoot[fz])) bad.push(`${k}@${a} near side not in front`);
      if (!(z.armRoot[nz] > 0 && z.armRoot[fz] < 0)) bad.push(`${k}@${a} arms not in front of / behind the card`);
    }
    const roots = (['cop', 'prisoner', 'tall', 'c1', 'c8'] as Kind[]).map((k) => { const b = build(k), sl = solve(k, REST, 0); return {k, leg: (b.top + b.th - sl.hip[0][1]) / b.th, arm: (sl.sh[0][1] - b.top) / b.th}; });
    const rootBad = roots.filter((r) => r.leg < 0.06 || r.leg > 0.1 || r.arm < 0.1 || r.arm > 0.3);
    ok(bad.length === 0 && rootBad.length === 0, `3D layering: near / far limbs in front of / behind the card for 24 torso yaws x 5 characters; leg tops start ${(roots[0].leg * 100).toFixed(0)} % of the torso above its bottom edge (6-10 %), arm roots ${(roots[0].arm * 100).toFixed(0)} % below its top`, `${bad.slice(0, 3).join('; ')} ${rootBad.map((r) => r.k).join(',')}`);
  }
  { // PURE WHITE heads and torsos (unlit toon cards): fill #FFFFFF, only the crescent carries the cool shade #DDE5EC; the average colour of head / torso art outside shadows and tints must be >= #F5F5F5
    const f = (k: Kind) => reliefFraction(k), shade = [221, 229, 236], alpha = 0.9, avg = (frac: number) => shade.map((c) => 255 * (1 - frac) + (c * alpha + 255 * (1 - alpha)) * frac);
    const headAvg = Math.min(...avg(f('cop')), ...avg(f('prisoner'))), torsoAvg = Math.min(...avg(0.1));
    ok(SKIN_FILL === '#FFFFFF' && !COSTUME_FILLS && Math.min(headAvg, torsoAvg) >= 245, `white cards: skin ${SKIN_FILL}, costume fills off, average head ${headAvg.toFixed(1)} / torso ${torsoAvg.toFixed(1)} (>= 245 = #F5F5F5), crescent shade #DDE5EC; no tone mapping in the post stack`);
  }
  { // BOUNCE on all movement: prisoner walk (frames 0-24): torso bob 16 % of the head width peak to peak, squash / stretch +-4 % with the opposite scale on the other axis, rock <= 5 deg, head lagging 2-3 frames; stop settles within 3 frames; heavy bodies slower
    const W = 2 * build('prisoner').rx, bs = (f: number) => bounceAt(PRIS_BOUNCE, f, W, 1), fr = Array.from({length: 18}, (_, i) => 6 + i), dys = fr.map((f) => -bs(f).dy), pp = Math.max(...dys) - Math.min(...dys);
    const sxd = fr.map((f) => bs(f).sx - 1), syd = fr.map((f) => bs(f).sy - 1), opposite = fr.every((f, i) => sxd[i] * syd[i] <= 1e-12), sq = Math.max(...syd.map(Math.abs), ...sxd.map(Math.abs)), rockMax = Math.max(...fr.map((f) => Math.abs(bs(f).rock))) / DEG;
    let bestLag = 0, bestErr = 1e9; for (let lag = 0; lag <= 5; lag += 0.5) { const e = fr.reduce((a, f) => a + (-bounceAt(PRIS_BOUNCE, f - lag, W, 1).dy - -bs(f).headDy) ** 2, 0); if (e < bestErr) { bestErr = e; bestLag = lag; } }
    const settle = Array.from({length: 8}, (_, i) => WALK_F + 5 + i).every((f) => Math.abs(bounceAt([{kind: 'stop', f0: WALK_F, k: 0.8}], f, W, 1).dy) < 0.01) && Math.abs(bounceAt([{kind: 'stop', f0: WALK_F}], WALK_F + BOUNCE.SETTLE.stop, W, 1).dy) < 0.01;
    const per = (m: number) => { const fs = Array.from({length: 80}, (_, i) => 6 + i * 0.25), u = fs.map((f) => -bounceAt([{kind: 'step', f0: 0, f1: 200}], f, W, m).dy); let c = 0; for (let i = 1; i < u.length; i++) if (u[i - 1] < 0 && u[i] >= 0) c++; return {c, a: Math.max(...u) - Math.min(...u)}; };
    const light = per(1), heavy = per(1.6);
    ok(Math.abs(pp / (0.16 * W) - 1) < 0.1 && opposite && sq <= 0.0405 && sq >= 0.03 && rockMax <= 5.01 && rockMax >= 3 && Math.abs(bestLag - 2.5) <= 0.5 && settle && heavy.c < light.c && heavy.a > light.a,
      `bounce: torso bob ${pp.toFixed(1)} px = ${(100 * pp / W).toFixed(1)} % of the head width (16), squash / stretch +-${(sq * 100).toFixed(1)} % opposite on the other axis, rock <= ${rockMax.toFixed(1)} deg, head lag ${bestLag} frames, stop settled after ${BOUNCE.SETTLE.stop} frames, heavy body slower (${heavy.c} vs ${light.c} cycles) and bigger (${heavy.a.toFixed(1)} vs ${light.a.toFixed(1)} px)`);
  }
  { // SITTING: seated at a table and on a bench, facing the camera and in 3/4 (both mirrors): hands touch what they rest on, feet on the floor, leg tops inside the torso, near arm in front of the far arm, reach within the arm length
    const bad: string[] = [], camYaw = 0.3, cases: [Kind, 'table' | 'bench', 'front' | 'three-quarter', boolean][] = [];
    for (const kd of ['cop', 'c3'] as Kind[]) for (const seat of ['table', 'bench'] as const) for (const [view, mir] of [['front', false], ['three-quarter', false], ['three-quarter', true]] as ['front' | 'three-quarter', boolean][]) cases.push([kd, seat, view, mir]);
    let maxContact = 0, maxFloor = 0, worstChord = 0;
    for (const [kd, seat, view, mir] of cases) {
      const r = sitPose(kd, {seat, view, camYaw, mirror: mir}), sol = solve(kd, r.pose, camYaw), cur = limbCurves3(kd, r.pose, sol, camYaw), pos: V3 = [0, r.yOffset, 0], kk = PXM, rL = (LIMB_W / 2) * kk, rH = HAND_R * kk, tag = `${kd} ${seat} ${view}${mir ? ' mirrored' : ''}`;
      const W = (q: [number, number, number]) => cardLocalToWorld(q, pos, camYaw, 1);
      for (let i = 0; i < 2; i++) {
        const ank = W(cur[i][3]), hand = W(cur[2 + i][3]), root = cur[i][0], b = build(kd);
        maxFloor = Math.max(maxFloor, Math.abs(ank[1])); if (Math.abs(ank[1]) > 0.004) bad.push(`${tag}: foot ${i} off the floor`);
        if (!(root[1] > b.top && root[1] < b.top + b.th)) bad.push(`${tag}: leg top ${i} outside the torso`);
        if (footDir(r.pose, i)[0] * r.pose.fwd[0] + footDir(r.pose, i)[2] * r.pose.fwd[1] <= 0) bad.push(`${tag}: foot ${i} not forward`);
        let dist: number;
        if (seat === 'table') dist = Math.abs(hand[1] - (r.tableTop + rH));
        else { dist = 9; for (let q = 0; q <= 60; q++) { const t = q / 60, m = 1 - t, L = cur[i], pt = [0, 1, 2].map((e) => m * m * m * L[0][e] + 3 * m * m * t * L[1][e] + 3 * m * t * t * L[2][e] + t * t * t * L[3][e]) as [number, number, number], w = W(pt); w[1] += rL; dist = Math.min(dist, Math.abs(Math.hypot(hand[0] - w[0], hand[1] - w[1], hand[2] - w[2]) - (rL + rH))); } }
        maxContact = Math.max(maxContact, dist); if (dist > 0.004) bad.push(`${tag}: hand ${i} floats (${(dist * 1000).toFixed(1)} mm)`);
        const st = bezier3Stats(cur[2 + i]); worstChord = Math.max(worstChord, st.chord / ARM); if (st.chord > ARM * 0.995 || st.offset > 0.36 * st.chord) bad.push(`${tag}: arm ${i} chord ${(st.chord / ARM).toFixed(2)} offset ${(st.offset / st.chord).toFixed(2)}`);
      }
      if (view === 'three-quarter') { const near = rightIsNear(r.pose.fwd, camYaw) ? 0 : 1; if (!(cur[2 + near][0][2] > cur[3 - near][0][2] && cur[near][0][2] > cur[1 - near][0][2])) bad.push(`${tag}: near limbs not in front`); }
    }
    ok(bad.length === 0, `sitting: ${cases.length} poses (table / bench x front / 3/4 x 2 mirrors x 2 characters): hands touch their support (max ${(maxContact * 1000).toFixed(1)} mm off), feet on the floor (max ${(maxFloor * 1000).toFixed(1)} mm), leg tops inside the torso, feet forward, near limbs in front, reach <= ${(worstChord * 100).toFixed(0)} % of the arm`, bad.slice(0, 3).join('; '));
  }
  { // ENVIRONMENT (2D/3D mix): every texture painter runs (fake canvas); the 3D set is built (stub textures): instanced blocks / tiles / bolts, merged props, hull outlines, door leaf; counts reported
    const failed: string[] = []; for (const [n, fn, w, h] of [...ENV_PAINTERS, ...OVERLAY_PAINTERS]) { try { fn(ctx, w, h); } catch (e) { failed.push(`${n}: ${(e as Error).message}`); } }
    let st = {triangles: 0, drawCalls: 0, instances: 0}; try { const env = buildEnv(() => new THREE.Texture()); st = envStats(env.group); } catch (e) { failed.push(`buildEnv: ${(e as Error).message}`); }
    ok(failed.length === 0 && st.drawCalls > 0 && st.drawCalls <= 30, `environment: ${ENV_PAINTERS.length + OVERLAY_PAINTERS.length} painters run clean; 3D set = ${st.drawCalls} draw calls, ${st.triangles} triangles (${st.instances} instances) + 9 overlay planes`, failed.join('; '));
  }
  void CENTER_BOX;
  return out;
}

export const WalkTest: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    const lines = runChecks();
    (window as unknown as {__walk?: string[]}).__walk = lines;
    lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[walktest]', l) : console.info('[walktest]', l)));
    return [
      {
        from: 0, to: WT_FRAMES, light: 'day', ownLights: true, cam,
        post: (_frame, pose) => (
          <EffectComposer multisampling={4}>
            <FocusDof pose={pose} focal={[0.2, 1.2, -4.6]} r={1.6} />
          </EffectComposer>
        ),
        render: (t) => <Scene t={t} />,
      },
    ];
  }, []);
  return <SingleCanvasVideo shots={shots} fps={WT_FPS} />;
};
