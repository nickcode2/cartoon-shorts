// SHOPPING_CART: the 18 shots. Every shot body is a function of its local frame f (0 .. n-1); the storyboard stills render the same bodies at a hero frame (see HERO), the video renders them in sequence.
// MOTION SOURCES (searched 2026-11-17): walk = distance-driven gait (phase from distance travelled, so the planted foot does not slide; kit rule) with a slow stride for "walks slowly";
// pushing a cart / carrying a heavy basket: lean into the weight, hips and head low, free arm out for balance, heavy things start slowly and lag the body (animschool.edu, Animation Mentor, cursa.app
// body-mechanics notes; no source gives frame counts, so every duration below is an estimate, untested). Hammer strikes, bill hand-outs, the rocking arms and the flex are estimates as well.
import React from 'react';
import * as THREE from 'three';
import {Lights} from '../cobra/sets';
import {B, Cy, Sp} from '../cobra/common';
import {LightFx} from '../kit/LightFx';
import {Pose, V3} from '../kit/kit';
import {easeInOut} from '../kit/motion';
import {BounceEvent, bounceAt} from '../kit/bounce';
import {ARM, CX, GROUND, HIP_Y, PXM, RickPose, FaceName, build, facingYaw, shoulderX, shoulderY, worldToCardLocal, yawTo} from '../kit/rickRig';
import {Bills, Cart, ChairCart, Glint, HandBasket, RED, cartGrips} from './props';
import {Person, Role, KIND, SPECS, AGE_GAIT, AGE_BOB, AGE_LEAN, dirTo, handPos, poseOf} from './cast';
import {makeCrowd} from '../kit/crowd';
import {ShopFx, ShopLights, Supermarket, Workshop} from './sets';

export const S = 0.9, TAU = Math.PI * 2, LEG_M = (GROUND - HIP_Y) * PXM * S;
export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const seg = (f: number, a: number, b: number) => easeInOut(clamp((f - a) / (b - a)));
export const tri = (s: number) => (2 / Math.PI) * Math.asin(Math.sin(Math.PI * s));
export function kf(f: number, keys: [number, number][]): number {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) return mix(keys[i - 1][1], keys[i][1], easeInOut((f - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
}
export const kf2 = (f: number, keys: [number, [number, number]][]): [number, number] => [kf(f, keys.map((k) => [k[0], k[1][0]] as [number, number])), kf(f, keys.map((k) => [k[0], k[1][1]] as [number, number]))];
const lerp3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hw = (r: Role) => 2 * build(KIND[r]).rx;
const REST_L: [number, number] = [CX - 62, 580], REST_R: [number, number] = [CX + 62, 580];
export type Ctx = {f: number; n: number; c: Pose; ss: number};
const V = (x: number, y: number, z: number): V3 => [x, y, z];

// ---------------------------------------------------------------- motion helpers
/** Distance-driven gait: amp = leg swing (rad). stride = 2 L sin(amp). Returns the leg / arm fields of a RickPose. */
export function gait(dist: number, amp: number, k = 1, ph = 0, sc = 1): Partial<RickPose> {
  const stride = 2 * LEG_M * sc * Math.sin(amp), s = dist / stride + ph, t = tri(s) * amp * k, cs = Math.cos(Math.PI * s) * k;
  return {legSw: [t, -t], bend: [Math.max(0, cs), Math.max(0, -cs)], toe: [0.5 * Math.max(0, cs), 0.5 * Math.max(0, -cs)], armSw: [-amp * 0.9 * tri(s - 0.45) * k, amp * 0.9 * tri(s - 0.45) * k]};
}
/** Gait of a character: elders take shorter steps, children shorter legs (stride follows the scale). */
export const gaitR = (role: Role, dist: number, amp: number, k = 1, ph = 0): Partial<RickPose> => gait(dist, amp * AGE_GAIT[SPECS[role].age], k, ph, SPECS[role].scale);
/** Forward lean of elders (rad) toward the walk direction. */
export const ageLean = (role: Role, p: V3, c: Pose, dir: [number, number]) => AGE_LEAN[SPECS[role].age] * (leanOf(p, c, dir) >= 0 ? 1 : -1);
/** Step bounce for a walk whose step takes `period` frames (the kit's bounce is 5.8 frames per step at mass 1: mass = (period / 5.8)^2, strength compensated). */
export const stepBounce = (f: number, f0: number, f1: number, period: number, role: Role, extra: BounceEvent[] = []) => { const mass = (period / 5.8) ** 2; return bounceAt([{kind: 'step', f0, f1, k: 0.45 * AGE_BOB[SPECS[role].age]}, ...extra], f, hw(role), mass); };
export const blendDir = (a: [number, number], b: [number, number], t: number): [number, number] => { let a0 = Math.atan2(a[0], a[1]), a1 = Math.atan2(b[0], b[1]); let d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; const x = a0 + d * t; return [Math.sin(x), Math.cos(x)]; };
const dirOf = (a: number): [number, number] => [Math.sin(a), Math.cos(a)];
export const sway = (f: number, ph = 0) => 5 * Math.sin(f * 0.06 + ph);
/** Keeps a hand target (card px, z toward the camera) inside the arm's reach of its shoulder (0.93 x the arm length, never closer than 110 px): a longer reach makes a NaN limb. Pointing = the arm simply stretches toward the target. */
export function clampHand(role: Role, slot: number, q: [number, number, number], wsc = 1, rootZ = 14): [number, number, number] {
  const b = build(KIND[role]), sx = CX + (slot === 0 ? -1 : 1) * shoulderX(b) * wsc, sy = shoulderY(b), z = Math.min(200, Math.max(-200, q[2])), R = 0.97 * ARM, dz = z - rootZ; // the arm's 3D chord is measured from the real shoulder (x squeezed by the torso turn, depth from the torso yaw)
  const vx = q[0] - sx, vy = q[1] - sy, lp = Math.hypot(vx, vy) || 1, maxP = Math.sqrt(Math.max(1, R * R - dz * dz)), k = Math.min(maxP, Math.max(50, lp)) / lp; // 3D chord <= 0.97 x the arm (the elbow keeps a small bend); with the 2-bone IK a short chord is fine
  return [sx + vx * k, sy + vy * k, z];
}
/** Hands on world points: each grip goes to the NEAREST shoulder (card-local x and depth, depth from the torso yaw when `torsoDir` is given), slot 0 = the card-left hand. */
export function handsOn(role: Role, p: V3, c: Pose, w0: V3, w1: V3, torsoDir?: [number, number]): Pick<RickPose, 'hands' | 'handsZ'> {
  const yaw = yawTo(c.p, p), a = worldToCardLocal(w0, p, yaw, S), b = worldToCardLocal(w1, p, yaw, S), bd = build(KIND[role]), sinT = torsoDir ? Math.sin(facingYaw(torsoDir, yaw)) : 0, sh = (slot: number) => [CX + (slot === 0 ? -1 : 1) * shoulderX(bd) * 0.6, 14 + (slot === 0 ? 1 : -1) * shoulderX(bd) * sinT];
  const cost = (q: number[], slot: number) => { const h = sh(slot); return (q[0] - h[0]) ** 2 + (q[2] - h[1]) ** 2; };
  const straight = cost(a, 0) + cost(b, 1) <= cost(b, 0) + cost(a, 1), [l0, r0] = straight ? [a, b] : [b, a], wsc = torsoDir ? Math.max(0.22, Math.abs(Math.cos(facingYaw(torsoDir, yaw)))) : 1, l = clampHand(role, 0, l0, wsc, sh(0)[1]), r = clampHand(role, 1, r0, wsc, sh(1)[1]);
  return {hands: [[l[0], l[1]], [r[0], r[1]]], handsZ: [l[2], r[2]]};
}
/** One hand on a world point for the given slot, kept inside the reach. */
export function handTo(role: Role, slot: number, p: V3, c: Pose, w: V3): {xy: [number, number]; z: number} { const q = clampHand(role, slot, worldToCardLocal(w, p, yawTo(c.p, p), S)); return {xy: [q[0], q[1]], z: q[2]}; }
const leanOf = (p: V3, c: Pose, dir: [number, number]) => { const yaw = yawTo(c.p, p); return dir[0] * Math.cos(yaw) - dir[1] * Math.sin(yaw); }; // + = the walk direction points to card-right

// ---------------------------------------------------------------- reusable actors
export interface PushArgs {role: Role; pos: V3; dir: [number, number]; dist: number; moving?: number; face?: FaceName; look?: [number, number]; amp?: number; load?: number; seed?: number; period?: number; extra?: Partial<RickPose>; f: number; n: number; ph?: number}
/** Geometry of a person pushing a wire cart: the cart centre sits 0.90 m in front of the body (the handle 0.30 m), both hands are pinned to the two GRIP ANCHORS on the red bar (shoulder-width apart),
 *  the arms reach them with an elbow bend (2-bone IK), the body leans into the push. If the arm cannot reach, the cart is brought closer (0.30 m is inside the 0.93 x arm reach). */
export function pushGeom(o: PushArgs, c: Pose) {
  const {role, pos, dir, dist, moving = 1, face = 'deadpan', look, amp = 0.3, period = 18, extra, f, n, ph = 0} = o;
  const ry = Math.atan2(-dir[0], -dir[1]), ctr: V3 = [pos[0] + dir[0] * 0.9, 0, pos[2] + dir[1] * 0.9], grips = cartGrips(ctr, ry), lean = leanOf(pos, c, dir);
  const pose = poseOf(pos, c.p, {fwd: dir, torsoFwd: dir, headFwd: look ?? dir, ...gaitR(role, dist, amp, moving, ph), ...handsOn(role, pos, c, grips[0], grips[1], dir), lean: 0.1 * lean * moving, face, bounce: stepBounce(f, 0, n, period, role), ...extra});
  return {pose, ctr, ry, grips};
}
/** Max distance (m) between a hand and its grip anchor for a pose (QA: must stay < 3 % of the character height = 0.052 m). */
export function gripError(role: Role, pose: RickPose, p: V3, c: Pose, grips: V3[], slots: number[]): number {
  let worst = 0; const hs = slots.map((sl) => handPos(role, pose, p, c.p, S, sl));
  const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  if (grips.length === 2 && slots.length === 2) worst = Math.min(Math.max(d(hs[0], grips[0]), d(hs[1], grips[1])), Math.max(d(hs[0], grips[1]), d(hs[1], grips[0])));
  else grips.forEach((g, i) => { worst = Math.max(worst, d(hs[i], g)); });
  return worst;
}
/** A person pushing a wire shopping cart (see pushGeom). */
export const PushScene: React.FC<PushArgs & {c: Pose}> = ({c, ...o}) => {
  const g = pushGeom(o, c);
  return (<><Person role={o.role} p={o.pos} s={S} cam={c.p} pose={g.pose} noCane /><Cart p={g.ctr} ry={g.ry} spin={-o.dist / 0.07} load={o.load ?? 0} seed={o.seed ?? 0} /></>);
};
interface IdleO {role: Role; p: V3; c: Pose; f: number; face?: FaceName; look?: V3; hands?: RickPose['hands']; handsZ?: RickPose['handsZ']; extra?: Partial<RickPose>; fwd?: [number, number]; ph?: number; tone?: string; tint?: React.ComponentProps<typeof Person>['tint']}
/** Standing character: weight shift, head sway, faces the camera or a point. */
export const Idle: React.FC<IdleO> = ({role, p, c, f, face = 'deadpan', look, hands, handsZ, extra, fwd, ph = 0, tone, tint}) => {
  const d = fwd ?? (look ? dirTo(p, look) : dirTo(p, c.p));
  const pose = poseOf(p, c.p, {fwd: d, torsoFwd: d, headFwd: look ? dirTo(p, look) : d, headDx: sway(f, ph), lean: 0.012 * Math.sin(f * 0.05 + ph), face, hands, handsZ, armSw: [0.035 * Math.sin(f * 0.045 + ph), -0.035 * Math.sin(f * 0.045 + ph + 1.3)], ...extra}); // idle arms hang with a small natural sway (and a slight elbow bend from the IK)
  return <Person role={role} p={p} s={S} cam={c.p} pose={pose} tone={tone} tint={tint} />;
};
/** HAND BASKET CARRY (kit default, round 3): the basket hangs from the hand at arm's length on the OUTSIDE of the leg. The hand target is BASKET_PX (about 0.33 m beside the body axis), the basket is turned with its long side along the walking direction (narrow side toward the leg) and a separation step pushes it out of the body cylinder
 *  (BODY_R + half width + tolerance) when the pose would still put it into the leg. Bottom stays above the floor (hand height minus 0.37 m). The group carries userData.qaHeld for the generic collision QA. */
/** The hand target of a hand-basket carrier, in WORLD terms: 0.33 m to the outside of the body axis (the person's own side of that arm: slot 1 = the person's right when facing the camera) and 0.05 m ahead, at the usual hanging hand height.
 *  Converted to card px + depth by handTo, so it stays beside the leg from the front, the 3/4 and the profile view alike (in profile the card depth carries the lateral offset). */
export function basketArm(role: Role, p: V3, c: Pose, fwd: [number, number], slot: number): {xy: [number, number]; z: number} {
  const sg = slot === 1 ? 1 : -1, lx = sg * fwd[1], lz = -sg * fwd[0], w: V3 = [p[0] + lx * 0.33 + fwd[0] * 0.05, p[1] + (GROUND - 575) * PXM * S, p[2] + lz * 0.33 + fwd[1] * 0.05];
  return handTo(role, slot, p, c, w);
}
export const basketHands = (role: Role, p: V3, c: Pose, fwd: [number, number], slot: number): {hands: ([number, number] | null)[]; handsZ: [number | null, number | null]} => { const a = basketArm(role, p, c, fwd, slot); return {hands: slot === 0 ? [a.xy, null] : [null, a.xy], handsZ: slot === 0 ? [a.z, null] : [null, a.z]}; };
export const BODY_R = 0.15, BASKET_HALF = 0.15, SEP_TOL = 0.02;
const HeldBasket: React.FC<{role: Role; pose: RickPose; p: V3; c: Pose; slot: number; load: number; seed?: number; swing?: number}> = ({role, pose, p, c, slot, load, seed = 0, swing = 0}) => {
  const h = handPos(role, pose, p, c.p, S, slot), fw = pose.torsoFwd ?? pose.fwd;
  const need = BODY_R + BASKET_HALF + SEP_TOL;
  let dx = h[0] - p[0], dz = h[2] - p[2], dist = Math.hypot(dx, dz), moved = 0;
  if (dist < need) { // separation step: push the basket out of the body cylinder, away from the axis (sideways of the walking direction when the hand is on the axis)
    if (dist < 1e-3) { const sd = slot === 0 ? -1 : 1; dx = -fw[1] * sd; dz = fw[0] * sd; dist = 1; }
    const k = need / dist; moved = need - Math.min(dist, need); dx *= k; dz *= k; h[0] = p[0] + dx; h[2] = p[2] + dz;
  }
  const ry = Math.atan2(dx, dz) + 0.12 * swing; // the narrow side (0.15 m half width) faces the body axis: the basket never extends more than BASKET_HALF toward the leg
  return <group userData={{qaHeld: {axis: [p[0], p[2]], half: BASKET_HALF, need, moved}}}><HandBasket p={[h[0], h[1] - 0.37, h[2]]} ry={ry} load={load} seed={seed} handleTilt={swing} /></group>;
};

// ---------------------------------------------------------------- scene wrappers
const ShopScene: React.FC<{ss: number; f: number; drawer?: number; crank?: number}> = ({ss, f, drawer, crank}) => (<><ShopLights ss={ss} /><Supermarket regDrawer={drawer} regCrank={crank} /><ShopFx f={f} /></>);
const WorkScene: React.FC<{ss: number; f: number; c: Pose; benchZ: number}> = ({ss, f, c, benchZ}) => (<><Lights mode="garage" ss={ss} /><Workshop benchZ={benchZ} /><LightFx mode="garage" f={f} cam={c.p} /></>);

// ================================================================= SHOT 1 (aisle C): the pusher walks slowly toward +z pushing the cart, smiling at everyone (follow dolly alongside)
export const V1 = 0.024; // 0.72 m/s: slow
export const p1 = (f: number): V3 => [0.6, 0, -6.2 + V1 * f];
const E1: React.FC<Ctx> = ({f, n, c, ss}) => {
  const pos = p1(f), looks: [V3, V3] = [[-1.6, 1.6, -3.2], [1.6, 1.6, -2.4]], a = seg(f, 40, 70) * (1 - seg(f, 100, 130)), b = seg(f, 120, 150) * (1 - seg(f, 175, 200));
  const look = blendDir(blendDir([0, 1], dirTo(pos, looks[0]), a), dirTo(pos, looks[1]), b);
  const wave = kf2(f, [[0, REST_R], [60, REST_R], [76, [CX + 150, 420]], [100, [CX + 150, 420]]]);
  void wave;
  return (<><ShopScene ss={ss} f={f} />
    <PushScene role="pusher" pos={pos} dir={[0, 1]} c={c} dist={V1 * f} face="happyArc" look={look} amp={0.3} f={f} n={n} load={Math.min(0.5, f / 300)} extra={{headRoll: 0.04 * Math.sin(f * 0.07)}} />
    <Idle role="manCap" p={[-2.1, 0, -3.2]} c={c} f={f} look={pos} face="deadpan" ph={1} /><Idle role="womanHat" p={[1.6, 0, -2.4]} c={c} f={f} look={pos} face="confused" ph={2} /></>);
};

// ================================================================= SHOT 2 (aisle D, low angle): shoppers with hand baskets just stare; he rolls on, nobody follows
const SH2: {role: Role; p: V3; seed: number}[] = [{role: 'manCap', p: [-0.8, 0, -3.4], seed: 1}, {role: 'womanHat', p: [0.55, 0, -3.4], seed: 2}, {role: 'oldMan', p: [-0.1, 0, -4.3], seed: 3}];
export const p2 = (f: number): V3 => [mix(1.6, 0.9, clamp(f / 41)), 0, -2.7];
const E2: React.FC<Ctx> = ({f, n, c, ss}) => {
  const man = p2(f);
  return (<><ShopScene ss={ss} f={f} />
    <PushScene role="pusher" pos={man} dir={[-1, 0]} c={c} dist={0.03 * f} face="happyArc" amp={0.3} f={f} n={n} load={0.4} period={18} />
    {SH2.map((s, i) => {
      const look = blendDir(dirTo(s.p, c.p), dirTo(s.p, man), seg(f, 2 + i * 2, 12 + i * 2));
      const hb = poseOf(s.p, c.p, {fwd: look, torsoFwd: look, headFwd: look, ...basketHands(s.role, s.p, c, look, 1), headDx: sway(f, i), face: i === 1 ? 'confused' : 'deadpan', lean: 0.01});
      return (<React.Fragment key={s.seed}><Person role={s.role} p={s.p} s={S} cam={c.p} pose={hb} noCane /><HeldBasket role={s.role} pose={hb} p={s.p} c={c} slot={1} load={0.5} seed={s.seed} /></React.Fragment>);
    })}
    <Idle role="elderLady" p={[1.15, 0, -4.1]} c={c} f={f} look={man} face="confused" ph={5} /><Idle role="kidBoy" p={[-1.1, 0, -2.2]} c={c} f={f} look={man} face="shock" ph={2} /></>);
};

// ================================================================= SHOT 3 (aisle A, close): his smile fades, awkward, red cheeks
export const P3: V3 = [0.3, 0, -1.2];
const E3: React.FC<Ctx> = ({f, n, c, ss}) => {
  const face: FaceName = f < 14 ? 'happyArc' : f < 28 ? 'deadpan' : 'grimace', cheeks = seg(f, 20, 44);
  return (<><ShopScene ss={ss} f={f} />
    <PushScene role="pusher" pos={P3} dir={[0, 1]} c={c} dist={0} moving={0} face={face} f={f} n={n} load={0.5} look={blendDir([0, 1], dirTo(P3, [-1.0, 1.6, -0.2]), seg(f, 30, 44))}
      extra={{headDx: sway(f), headDy: 8 * seg(f, 20, 40), headRoll: 0.07 * seg(f, 26, 44), tint: [{state: 'embarrassed', zone: 'cheeks', k: 0.9 * cheeks}]}} /></>);
};

// ================================================================= SHOT 4 (register A): the owner proudly points at the cart
export const P4: V3 = [2.5, 0, -3.3], CART4: V3 = [2.35, 0, -4.55];
const E4: React.FC<Ctx> = ({f, c, ss}) => {
  const pt = seg(f, 14, 40), tgt = handTo('owner', 0, P4, c, [CART4[0] + 0.1, 1.0, CART4[2]]), arm: [number, number] = [mix(CX - 40, tgt.xy[0], pt), mix(560, tgt.xy[1] - 10, pt)];
  const pose = poseOf(P4, c.p, {fwd: dirTo(P4, c.p), torsoFwd: dirTo(P4, c.p), headFwd: blendDir(dirTo(P4, c.p), dirTo(P4, CART4), 0.5 * seg(f, 10, 34)), hands: [arm, [CX + 120, 520]], handsZ: [mix(0, tgt.z, pt), 20], lean: -0.03 * pt, headDy: -8 * pt, headDx: sway(f), headRoll: 0.05 * pt, face: 'smug', bounce: bounceAt([{kind: 'reach', f0: 14, k: 0.6}, {kind: 'stop', f0: 40, k: 0.4}], f, hw('owner'), 1)});
  return (<><ShopScene ss={ss} f={f} /><Person role="owner" p={P4} s={S} cam={c.p} pose={pose} /><Cart p={CART4} ry={Math.PI / 2 + 0.5} load={0.35} seed={4} />
    <Idle role="greenLady" p={[-0.2, 0, -5.4]} c={c} f={f} look={[CART4[0], 1.4, CART4[2]]} face="confused" ph={3} /></>);
};

// ================================================================= SHOT 5 (aisle F): a woman takes a can from the shelf (reaching hand, can visible), drops it into her basket, the basket is heavy, she walks to the register
// Purpose of every limb: the reaching arm goes to the can on the shelf (elbow bent), the other hand holds the basket low at her side, then both relax (arm hangs along the body); nothing floats.
const WP5: V3[] = [[-1.95, 0, -2.6], [0.0, 0, -2.9], [1.7, 0, -3.3]];
const len5 = [Math.hypot(WP5[1][0] - WP5[0][0], WP5[1][2] - WP5[0][2]), Math.hypot(WP5[2][0] - WP5[1][0], WP5[2][2] - WP5[1][2])];
export const D5 = (f: number) => kf(f, [[0, 0], [110, 0], [170, 2.0], [184, 2.0], [236, len5[0] + len5[1]]]);
export function pos5(d: number): {p: V3; dir: [number, number]} { const k = d < len5[0] ? 0 : 1, t = (d - (k ? len5[0] : 0)) / len5[k], a = WP5[k], b = WP5[k + 1]; return {p: [mix(a[0], b[0], clamp(t)), 0, mix(a[2], b[2], clamp(t))], dir: dirTo(a, b)}; }
export const CAN5: V3 = [-2.32, 1.12, -2.6];
const REST_PX = (slot: number): [number, number] => (slot === 0 ? [CX - 66, 585] : [CX + 66, 585]);
const E5: React.FC<Ctx> = ({f, c, ss}) => {
  const d = D5(f), {p, dir} = pos5(d), moving = clamp((D5(f + 1) - D5(f - 1)) * 18), turn = seg(f, 92, 114), fwd = blendDir([-1, 0], dir, turn), side = leanOf(p, c, dir) >= 0 ? 1 : -1, tired = seg(f, 96, 140);
  const yaw = yawTo(c.p, p), q = worldToCardLocal(CAN5, p, yaw, S), r = q[0] < CX ? 0 : 1, b = 1 - r; // r = reaching slot (the side of the shelf), b = basket slot
  const base: Partial<RickPose> = {fwd, torsoFwd: fwd, headFwd: blendDir(dirTo(p, CAN5), dir, turn), ...gaitR('womanHat', d, 0.2, moving, 0.2)};
  const hang = (turn: number) => REST_PX(b)[1] + 0 * turn;
  const ba5 = basketArm('womanHat', p, c, fwd, b), basketHandPx: [number, number] = [ba5.xy[0], ba5.xy[1] + 8 * tired];
  const pose0 = poseOf(p, c.p, {...base, hands: b === 0 ? [basketHandPx, null] : [null, basketHandPx], handsZ: b === 0 ? [ba5.z, null] : [null, ba5.z]});
  const hb = handPos('womanHat', pose0, p, c.p, S, b), above: V3 = [hb[0], hb[1] - 0.08, hb[2]];
  const tgt: V3 = f < 46 ? CAN5 : f < 72 ? [mix(CAN5[0], above[0], seg(f, 46, 72)), mix(CAN5[1], above[1], seg(f, 46, 72)), mix(CAN5[2], above[2], seg(f, 46, 72))] : above;
  const amt = seg(f, 10, 38) * (1 - seg(f, 86, 104)), th = handTo('womanHat', r, p, c, tgt), restR = REST_PX(r);
  const reachPx: [number, number] = [mix(restR[0], th.xy[0], amt), mix(restR[1], th.xy[1], amt)];
  const hands: RickPose['hands'] = r === 0 ? [reachPx, basketHandPx] : [basketHandPx, reachPx], handsZ: RickPose['handsZ'] = r === 0 ? [mix(0, th.z, amt), ba5.z] : [ba5.z, mix(0, th.z, amt)];
  const pose = poseOf(p, c.p, {...base, hands, handsZ, lean: (f < 100 ? 0.02 : -0.1 * side * (0.6 + 0.4 * tired)), headDy: 12 * tired, headRoll: 0.06 * side * tired, face: f < 80 ? 'deadpan' : f < 100 ? 'annoyed' : 'grimace', bounce: stepBounce(f, 0, 237, 22, 'womanHat', [{kind: 'reach', f0: 36, k: 0.5}, {kind: 'reach', f0: 74, k: 0.5, dir: -1}, {kind: 'stop', f0: 170, k: 0.6}, {kind: 'start', f0: 184, k: 0.5}])});
  const hr = handPos('womanHat', pose, p, c.p, S, r), inHand = f >= 38 && f < 72, dropT = clamp((f - 72) / 12), dropping = f >= 72 && f < 84;
  const load = f < 84 ? 0.55 : 1;
  return (<><ShopScene ss={ss} f={f} /><Person role="womanHat" p={p} s={S} cam={c.p} pose={pose} noCane /><HeldBasket role="womanHat" pose={pose} p={p} c={c} slot={b} load={load} seed={5} swing={0.2 * Math.sin(f * 0.3) * moving} />
    {f >= 30 && f < 72 && <Cy p={inHand || f < 38 ? [hr[0], hr[1], hr[2]] : CAN5} r={0.05} h={0.15} c="#E0302A" ink={0.004} cast={false} />}
    {dropping && <Cy p={[above[0], mix(above[1], hb[1] - 0.12, dropT), above[2]]} r={0.05} h={0.15} c="#E0302A" ink={0.004} cast={false} />}
    <Idle role="x3" p={[0.5, 0, -4.7]} c={c} f={f} look={[p[0], 1.4, p[2]]} face="deadpan" ph={4} /></>);
};

// ================================================================= SHOT 6 (workshop A): the owner puts wheels on a folding chair and two baskets on top
// The chair lies upside down on the workbench so every leg is at hand height: wheels 1-2 on the near side, the chair turns, wheels 3-4, then it is flipped upright and the baskets go in.
export const BENCH_Z = -3.15, BENCH_Y = 0.92, CHAIR6: V3 = [1.3, BENCH_Y, BENCH_Z], OWN6: V3 = [1.95, 0, -3.15];
const WHEEL_MOUNT: V3[] = [[0.22, 0.07, -0.2], [0.22, 0.07, 0.2], [-0.22, 0.07, -0.2], [-0.22, 0.07, 0.2]];
const WT: [number, number][] = [[4, 18], [18, 32], [46, 60], [60, 74]], TURN6: [number, number] = [32, 46], FLIP6: [number, number] = [76, 92], BK6: [number, number][] = [[94, 110], [110, 126]];
const E6: React.FC<Ctx> = ({f, c, ss}) => {
  const ry = Math.PI * seg(f, TURN6[0], TURN6[1]), flip = seg(f, FLIP6[0], FLIP6[1]), a = Math.PI * (1 - flip), cp: V3 = [CHAIR6[0], mix(CHAIR6[1] + 0.52, CHAIR6[1], flip), CHAIR6[2]];
  const mount = (i: number): V3 => { const l = WHEEL_MOUNT[i], x1 = l[0] * Math.cos(a) - l[1] * Math.sin(a), y1 = l[0] * Math.sin(a) + l[1] * Math.cos(a), x2 = x1 * Math.cos(ry) + l[2] * Math.sin(ry), z2 = -x1 * Math.sin(ry) + l[2] * Math.cos(ry); return [cp[0] + x2, cp[1] + y1, cp[2] + z2]; };
  const pile: V3 = [1.58, BENCH_Y + 0.07, BENCH_Z + 0.3];
  const wheelPos = (i: number): V3 => { const t = seg(f, WT[i][0], WT[i][1]), m = mount(i); return [mix(pile[0], m[0], t), mix(pile[1], m[1], t) + 0.12 * Math.sin(Math.PI * t), mix(pile[2], m[2], t)]; };
  const active = WT.findIndex(([x, y]) => f >= x && f < y);
  const bk = (i: number): V3 => { const t = seg(f, BK6[i][0], BK6[i][1]); return [mix(1.58, CHAIR6[0], t), mix(BENCH_Y + 0.05 + (1 - i) * 0.24, BENCH_Y + 0.52 + i * 0.28, t) + 0.22 * Math.sin(Math.PI * t), mix(BENCH_Z + 0.3, CHAIR6[2], t)]; };
  const hitK = (lo: number, hi: number) => (f >= lo && f < hi ? Math.max(0, Math.sin(((f - lo) / 6) * Math.PI * 2)) : 0), hit = Math.max(hitK(14, 26), hitK(28, 40), hitK(56, 68), hitK(70, 82));
  const bAct = BK6.findIndex(([x, y]) => f >= x && f < y);
  const tgt: V3 = active >= 0 ? wheelPos(active) : f >= FLIP6[0] && f < FLIP6[1] ? [CHAIR6[0] + 0.3, 1.2, CHAIR6[2]] : bAct >= 0 ? bk(bAct) : f < WT[0][0] ? pile : [1.45, 1.15, CHAIR6[2] + 0.2];
  const hand = handTo('owner', 0, OWN6, c, [tgt[0], tgt[1] + 0.03 * hit, tgt[2]]);
  const pose = poseOf(OWN6, c.p, {fwd: [-1, 0], torsoFwd: [-1, 0], headFwd: dirTo(OWN6, [CHAIR6[0], 1.0, CHAIR6[2]]), hands: [hand.xy, null], handsZ: [hand.z, 0], armSw: [0, 0.05 * Math.sin(f * 0.09)], lean: -0.05, headDy: 5 * Math.sin(f * 0.1), face: f > 126 ? 'smug' : 'deadpan', bounce: bounceAt([...[14, 28, 56, 70].map((f0): BounceEvent => ({kind: 'reach', f0, k: 0.5})), {kind: 'turn', f0: 32, k: 0.6}, {kind: 'reach', f0: 94, k: 0.6}, {kind: 'reach', f0: 110, k: 0.6}, {kind: 'stop', f0: 126, k: 0.5}], f, hw('owner'), 1)});
  return (<><WorkScene ss={ss} f={f} c={c} benchZ={BENCH_Z} /><Person role="owner" p={OWN6} s={S} cam={c.p} pose={pose} />
    <group position={cp} rotation={[0, ry, a]}><ChairCart p={[0, 0, 0]} baskets={0} wheels={0} /></group>
    {[0, 1, 2, 3].map((i) => <Cy key={i} p={wheelPos(i)} r={0.07} h={0.04} c="#2B2630" rot={[0, ry, Math.PI / 2]} ink={0.004} />)}
    {BK6.map((_, i) => (f >= BK6[i][0] || f < 4) ? <HandBasket key={i} p={bk(i)} load={0.5} seed={2 + i} /> : <HandBasket key={i} p={[1.58, BENCH_Y + 0.05 + (1 - i) * 0.24, BENCH_Z + 0.3]} load={0.5} seed={2 + i} />)}</>);
};

// ================================================================= SHOT 7 (garage D): the finished cart shines, the owner is smug, thumbs up, then a worried "Right?"
export const CART7: V3 = [0.2, 0, -2.4], OWN7: V3 = [1.0, 0, -2.5];
const E7: React.FC<Ctx> = ({f, c, ss}) => {
  const up = seg(f, 8, 22), worry = seg(f, 38, 48), shine = Math.max(0, Math.sin(clamp((f - 4) / 26) * Math.PI));
  const pose = poseOf(OWN7, c.p, {fwd: dirTo(OWN7, c.p), torsoFwd: dirTo(OWN7, c.p), headFwd: blendDir(dirTo(OWN7, c.p), dirTo(OWN7, CART7), 0.5 * seg(f, 24, 36)), hands: [[mix(CX - 62, CX - 200, up), mix(580, 330, up)], REST_R], handsZ: [30 * up, 0], lean: 0.03 * up, headRoll: 0.07 * up - 0.12 * worry, headDy: -6 * up + 8 * worry, headDx: sway(f), face: f < 38 ? 'smug' : 'fear', bounce: bounceAt([{kind: 'reach', f0: 10, k: 0.7}, {kind: 'reach', f0: 40, k: 0.5, dir: -1}], f, hw('owner'), 1)});
  const th = handPos('owner', pose, OWN7, c.p, S, 0);
  return (<><WorkScene ss={ss} f={f} c={c} benchZ={-4.7} /><Person role="owner" p={OWN7} s={S} cam={c.p} pose={pose} /><ChairCart p={CART7} ry={0.5} />
    {up > 0.6 && <Cy p={[th[0] - 0.01, th[1] + 0.07, th[2]]} r={0.026} h={0.11} c="#F4EFE0" ink={0.004} cast={false} />}
    <Glint p={[CART7[0] - 0.05, 1.0, CART7[2] + 0.1]} size={0.7} k={shine} /><Glint p={[CART7[0] + 0.2, 0.62, CART7[2]]} size={0.45} k={Math.max(0, Math.sin(clamp((f - 14) / 24) * Math.PI))} /></>);
};

// ================================================================= SHOT 8 (entrance A): the cart stands alone, shoppers walk past, the owner is confused
export const CART8: V3 = [0.1, 0, -5.2], OWN8: V3 = [-0.85, 0, -5.0];
const E8: React.FC<Ctx> = ({f, c, ss}) => {
  const a: V3 = [mix(-3.4, 3.4, clamp(f / 83)), 0, -8.2], b: V3 = [mix(0.9, 7.6, clamp((f + 6) / 90)), 0, -6.4], da: [number, number] = [1, 0], db: [number, number] = [1, 0]; // both walk the same way (no head cross-overs)
  const pose = poseOf(OWN8, c.p, {fwd: dirTo(OWN8, c.p), torsoFwd: dirTo(OWN8, c.p), headFwd: blendDir(dirTo(OWN8, c.p), dirTo(OWN8, a), 0.4 * seg(f, 20, 46)), hands: [kf2(f, [[0, REST_L], [30, REST_L], [44, [CX - 215, 330]]]), kf2(f, [[0, REST_R], [30, REST_R], [44, [CX + 215, 330]]])], handsZ: [20, 20], headRoll: 0.16 * seg(f, 24, 40), headDy: -4, face: f < 8 ? 'deadpan' : 'shock', lean: 0.02, bounce: bounceAt([{kind: 'reach', f0: 6, k: 0.8}, {kind: 'reach', f0: 40, k: 0.6, dir: -1}], f, hw('owner'), 1)});
  const walk = (role: Role, p: V3, dir: [number, number], ph: number, period: number, dist: number, face: FaceName) => { const ps = poseOf(p, c.p, {fwd: dir, torsoFwd: dir, headFwd: dir, ...gaitR(role, dist, 0.34, 1, ph), ...basketHands(role, p, c, dir, 1), lean: 0.05 * leanOf(p, c, dir) + ageLean(role, p, c, dir), face, bounce: stepBounce(f, 0, 90, period, role)}); return (<React.Fragment key={role}><Person role={role} p={p} s={S} cam={c.p} pose={ps} noCane /><HeldBasket role={role} pose={ps} p={p} c={c} slot={1} load={role === 'kidGirl' ? 0 : 0.4} seed={ph * 3 | 0} /></React.Fragment>); };
  return (<><ShopScene ss={ss} f={f} /><ChairCartFix p={CART8} f={f} /><Person role="owner" p={OWN8} s={S} cam={c.p} pose={pose} />
    {walk('womanHat', a, da, 0, 14, 0.075 * f, 'deadpan')}{walk('kidGirl', [a[0] - 0.7, 0, a[2] + 0.05], da, 0.25, 12, 0.075 * f, 'happyArc')}{walk('oldMan', b, db, 0.5, 16, 0.075 * f, 'annoyed')}</>);
};
const ChairCartFix: React.FC<{p: V3; f: number}> = ({p}) => <ChairCart p={p} ry={-0.5} />;

// ================================================================= SHOT 9 (entrance C): a woman mimes rocking a baby, disgusted, next to the cart
export const CART9: V3 = [0.3, 0, -4.6], W9: V3 = [-0.6, 0, -4.5];
const E9: React.FC<Ctx> = ({f, c, ss}) => {
  const rock = Math.sin(f * 0.22), arms = seg(f, 6, 18), look = blendDir(dirTo(W9, c.p), dirTo(W9, [CART9[0], 1.0, CART9[2]]), seg(f, 24, 40));
  const pose = poseOf(W9, c.p, {fwd: dirTo(W9, c.p), torsoFwd: dirTo(W9, c.p), headFwd: look, hands: [[mix(REST_L[0], CX - 30 + 28 * rock, arms), mix(580, 450, arms)], [mix(REST_R[0], CX + 70 + 28 * rock, arms), mix(580, 410, arms)]], handsZ: [60 * arms, 60 * arms], lean: 0.05 * rock * arms, headRoll: 0.1 * rock * arms - 0.05, headDy: 4, headDx: 6 * rock, face: f < 22 ? 'smug' : 'annoyed', bounce: bounceAt([{kind: 'reach', f0: 8, k: 0.4}, ...Array.from({length: 8}, (_, i): BounceEvent => ({kind: 'turn', f0: 18 + i * 14, k: 0.3, dir: i % 2 ? -1 : 1}))], f, hw('mother'), 1)});
  const baby = handPos('mother', pose, W9, c.p, S, 0);
  return (<><ShopScene ss={ss} f={f} /><Person role="mother" p={W9} s={S} cam={c.p} pose={pose} /><ChairCart p={CART9} ry={-0.4} />
    <Idle role="kidGirl" p={[-1.55, 0, -4.1]} c={c} f={f} look={[CART9[0], 0.8, CART9[2]]} face="confused" ph={3} />
    {arms > 0.5 && <group position={[baby[0] + 0.12, baby[1] - 0.04, baby[2] + 0.05]} rotation={[0, 0, 0.3 * rock]}><Sp p={[0, 0, 0]} s={[0.17, 0.09, 0.09]} c="#F6E8C8" ink={0.005} cast={false} /><Sp p={[0.14, 0.02, 0]} s={[0.07, 0.07, 0.07]} c="#FFFFFF" ink={0.005} cast={false} /></group>}</>);
};

// ================================================================= SHOT 10 (aisle D, low angle): a man flexes holding his hand basket and shakes his head at the cart
export const M10: V3 = [-0.3, 0, -1.8], CART10: V3 = [0.45, 0, -2.3];
const E10: React.FC<Ctx> = ({f, c, ss}) => {
  const flex = seg(f, 10, 28) * (1 - seg(f, 70, 82)), shake = f > 40 ? Math.sin((f - 40) * 0.5) * 0.6 * Math.min(1, (f - 40) / 6) * (1 - seg(f, 96, 112)) : 0;
  const hd = blendDir(dirTo(M10, c.p), dirTo(M10, [CART10[0], 1, CART10[2]]), seg(f, 30, 40));
  const head: [number, number] = [hd[0] * Math.cos(shake) + hd[1] * Math.sin(shake), -hd[0] * Math.sin(shake) + hd[1] * Math.cos(shake)];
  const pose = poseOf(M10, c.p, {fwd: dirTo(M10, c.p), torsoFwd: dirTo(M10, c.p), headFwd: head, hands: [[mix(REST_L[0], CX - 150, flex), mix(580, 320, flex)], basketArm('manCap', M10, c, dirTo(M10, c.p), 1).xy], handsZ: [30 * flex, basketArm('manCap', M10, c, dirTo(M10, c.p), 1).z], lean: 0.02 + 0.03 * flex, headDy: -8 * flex, headRoll: 0.06 * Math.sin(shake * 2), face: f < 38 ? 'smug' : 'annoyed', bounce: bounceAt([{kind: 'reach', f0: 12, k: 0.7}, {kind: 'stop', f0: 30, k: 0.5}], f, hw('manCap'), 1)});
  return (<><ShopScene ss={ss} f={f} /><Person role="manCap" p={M10} s={S} cam={c.p} pose={pose} /><HeldBasket role="manCap" pose={pose} p={M10} c={c} slot={1} load={0.7} seed={9} />
    <ChairCart p={CART10} ry={0.3} /><Idle role="elderGent" p={[1.55, 0, -3.6]} c={c} f={f} look={[CART10[0], 1.0, CART10[2]]} face="annoyed" ph={4} /></>);
};

// ================================================================= SHOT 11 (entrance B, wide): the cart alone in the middle, customers walk around it
export const CART11: V3 = [0, 0, -3.2];
const E11: React.FC<Ctx> = ({f, n, c, ss}) => {
  // customers walk around the cart on its far (back) half, so nobody blocks the cart; direction +1 = left to right
  const people: {role: Role; r: number; dir: 1 | -1; off: number; ph: number; sh: number}[] = [{role: 'womanHat', r: 1.3, dir: 1, off: 0, ph: 0, sh: 0}, {role: 'oldMan', r: 1.75, dir: -1, off: 6, ph: 0.4, sh: 0.45}, {role: 'greenLady', r: 2.2, dir: -1, off: 18, ph: 0.7, sh: -0.35}, {role: 'kidBoy', r: 2.65, dir: 1, off: 22, ph: 0.2, sh: -0.45}];
  return (<><ShopScene ss={ss} f={f} /><ChairCart p={CART11} ry={0.25} />
    {people.map((q) => {
      const u = clamp((f + q.off) / 90), span = Math.PI - 0.6, a = (q.dir > 0 ? Math.PI + 0.3 + span * u : 2 * Math.PI - 0.3 - span * u) + q.sh, p: V3 = [CART11[0] + Math.cos(a) * q.r, 0, CART11[2] + Math.sin(a) * q.r * 0.8];
      const tx = -Math.sin(a) * q.dir, tz = Math.cos(a) * 0.8 * q.dir, l = Math.hypot(tx, tz), dir: [number, number] = [tx / l, tz / l], moving = 1 - seg(f + q.off, 80, 90);
      const pose = poseOf(p, c.p, {fwd: dir, torsoFwd: dir, headFwd: dir, ...gaitR(q.role, q.r * span * u, 0.34, moving, q.ph), hands: SPECS[q.role].cane ? [null, [CX + 70, 570]] : undefined, lean: 0.05 * leanOf(p, c, dir) + ageLean(q.role, p, c, dir), face: 'deadpan', bounce: stepBounce(f, 0, n, 15, q.role)});
      return <Person key={q.role} role={q.role} p={p} s={S} cam={c.p} pose={pose} />;
    })}</>);
};

// ================================================================= SHOT 12 (register C): the owner pays a row of striped-shirt actors with cash
const ACT12: {role: Role; x: number}[] = [{role: 'actA', x: -0.95}, {role: 'actB', x: -0.4}, {role: 'actC', x: 0.15}, {role: 'actD', x: 0.7}];
export const OWN12: V3 = [-1.55, 0, -3.1];
const E12: React.FC<Ctx> = ({f, c, ss}) => {
  const idx = Math.min(3, Math.floor(f / 26)), local = (f - idx * 26) / 26, hand = ACT12[idx], hp: V3 = [hand.x - 0.15, 1.1, -3.1 + 0.3];
  const give = Math.sin(clamp(local) * Math.PI), h = handTo('owner', 1, OWN12, c, lerp3([OWN12[0] + 0.35, 1.0, -3.0], hp, give));
  const pose = poseOf(OWN12, c.p, {fwd: dirTo(OWN12, c.p), torsoFwd: dirTo(OWN12, c.p), headFwd: blendDir(dirTo(OWN12, c.p), dirTo(OWN12, [hand.x, 1.5, -3.1]), 0.7), hands: [[CX - 62, 580], h.xy], handsZ: [0, h.z], lean: 0.02 * give, headRoll: 0.05, headDx: sway(f), face: 'smug', bounce: bounceAt(Array.from({length: 4}, (_, i): BounceEvent => ({kind: 'reach', f0: i * 26 + 4, k: 0.5})), f, hw('owner'), 1)});
  const bill = handPos('owner', pose, OWN12, c.p, S, 1);
  return (<><ShopScene ss={ss} f={f} /><Person role="owner" p={OWN12} s={S} cam={c.p} pose={pose} />
    {ACT12.map((a, i) => { const p: V3 = [a.x, 0, -3.1], got = f >= i * 26 + 14, take = seg(f, i * 26 + 8, i * 26 + 18), ph = poseOf(p, c.p, {fwd: dirTo(p, c.p), torsoFwd: dirTo(p, c.p), headFwd: dirTo(p, c.p), hands: [[mix(CX - 62, CX - 130, take * (got ? 0 : 1)), mix(580, 430, take * (got ? 0 : 1))], got ? [CX + 70, 480] : REST_R], handsZ: [30, 30], headDx: sway(f, i), face: got ? 'happyArc' : 'smug', lean: 0.02, bounce: bounceAt([{kind: 'reach', f0: i * 26 + 16, k: 0.7}], f, hw(a.role), 1)});
      const hnd = handPos(a.role, ph, p, c.p, S, 1); return (<React.Fragment key={i}><Person role={a.role} p={p} s={S} cam={c.p} pose={ph} />{got && <Bills p={[hnd[0], hnd[1] + 0.07, hnd[2] + 0.04]} n={3} rot={[0.5, 0.3, 0.6]} />}</React.Fragment>); })}
    {f < 104 && <Bills p={[bill[0] + 0.02, bill[1] + 0.05, bill[2]]} n={3} rot={[0.3, 0, 0.6]} />}</>);
};

// ================================================================= SHOT 13 (aisle B): actors push carts and fake-laugh; one holds an apple upside down
export const V13 = 0.022;
const E13: React.FC<Ctx> = ({f, n, c, ss}) => {
  const rows: {role: Role; z0: number; x: number}[] = [{role: 'actA', z0: -3.9, x: -0.5}, {role: 'actB', z0: -3.0, x: 0.55}, {role: 'actC', z0: -2.1, x: -0.15}], laugh = Math.sin(f * 0.9);
  return (<><ShopScene ss={ss} f={f} />
    {rows.map((r, i) => { const pos: V3 = [r.x, 0, r.z0 + V13 * f], apple = r.role === 'actC';
      return (<React.Fragment key={r.role}><PushScene role={r.role} pos={pos} dir={[0, 1]} c={c} dist={V13 * f} face={Math.sin(f * 0.25 + i) > -0.2 ? 'teeth' : 'happyArc'} amp={0.34} period={17} f={f} n={n} ph={i * 0.5} load={0.3} seed={i}
        look={blendDir([0, 1], dirTo(pos, c.p), 0.6)} extra={{headRoll: 0.12 * laugh, headDy: -8 * Math.max(0, laugh), ...(apple ? {hands: [[CX - 190, 250], [CX + 150, 520]], handsZ: [30, 20]} : {})}} />
        {apple && <AppleUp pos={pos} c={c} f={f} />}</React.Fragment>); })}</>);
};
const AppleUp: React.FC<{pos: V3; c: Pose; f: number}> = ({pos, c}) => { const yaw = yawTo(c.p, pos), q = [Math.cos(yaw) * -0.43, 1.28, -Math.sin(yaw) * -0.43]; return <group position={[pos[0] + q[0], q[1], pos[2] + q[2]]} rotation={[Math.PI, 0, 0]}><Sp p={[0, 0, 0]} s={[0.07, 0.065, 0.07]} c="#D8342A" ink={0.005} /><Cy p={[0, 0.07, 0]} r={0.008} h={0.05} c="#5A3A22" cast={false} /></group>; };

// ================================================================= SHOT 14 (entrance E): a paid greeter shows a real customer how to push the cart
export const G14: V3 = [-0.1, 0, -6.55], L14: V3 = [-0.95, 0, -5.9];
const E14: React.FC<Ctx> = ({f, n, c, ss}) => {
  const d = 0.55 * Math.sin(clamp(f / 70) * Math.PI) , pos: V3 = [G14[0], 0, G14[2] + d * 0.8];
  const tilt = seg(f, 30, 50) * (1 - seg(f, 84, 104));
  return (<><ShopScene ss={ss} f={f} />
    <PushScene role="greeter" pos={pos} dir={[0, 1]} c={c} dist={d * 0.8} moving={0.8} face="happyArc" amp={0.25} period={16} f={f} n={n} load={0} look={blendDir([0, 1], dirTo(pos, L14), 0.5 * seg(f, 4, 20))} extra={{headRoll: 0.06}} />
    <Idle role="greenLady" p={L14} c={c} f={f} look={[pos[0], 1.4, pos[2]]} face={f < 60 ? 'confused' : 'happyArc'} hands={[null, [mix(CX + 66, CX + 52, tilt), mix(585, 372, tilt)]]} handsZ={[0, 55 * tilt]} extra={{headRoll: 0.1 * tilt, lean: 0.03}} ph={1} /></>);
};

// ================================================================= SHOT 15a / 15b (entrance): the customer's face lights up, then everyone grabs carts (rush)
export const L15: V3 = [0.4, 0, -5.4];
const A15 = (f: number, n: number, c: Pose): PushArgs => { const light = seg(f, 118, 132), face: FaceName = f < 40 ? 'confused' : f < 118 ? 'deadpan' : f < 126 ? 'shock' : 'happyArc'; return {role: 'greenLady', pos: L15, dir: [0, 1], dist: 0, moving: 0, face, load: 0.1, f, n, look: dirTo(L15, c.p), extra: {headRoll: 0.08 * light, headDy: -10 * light + 4 * Math.sin(f * 0.05), headDx: sway(f), lean: 0.01, bounce: bounceAt([{kind: 'reach', f0: 118, k: 0.7}], f, hw('greenLady'), 1)}}; };
const E15A: React.FC<Ctx> = ({f, n, c, ss}) => (<><ShopScene ss={ss} f={f} /><PushScene {...A15(f, n, c)} c={c} />
  <Idle role="oldMan" p={[-2.9, 0, -4.2]} c={c} f={f} look={[L15[0], 1.5, L15[2]]} face="confused" ph={6} /></>);
const CR = makeCrowd({n: 3, seed: 21, prefix: 'rc', mix: {child: 0.34, elder: 0.34, female: 0.5}, force: {1: {age: 'adult'}, 2: {age: 'child', female: true}, 3: {age: 'elder', female: false}}}); // seeded background crowd for the rush: mixed ages and genders
export const RACK15: V3[] = [-2.2, -1.1, 0, 1.1, 2.2].map((x) => V(x, 0, -7.2));
// each rusher runs to ONE rack cart and ends 0.30 m behind its handle with both hands on the red bar (grip anchors)
const RUSH: {role: Role; from: V3; rack: number; t0: number; grab?: boolean}[] = [{role: 'womanHat', from: [-3.4, 0, 0.5], rack: 0, t0: 2}, {role: 'oldMan', from: [3.9, 0, -1.0], rack: 4, t0: 8}, {role: 'manCap', from: [-1.6, 0, 3.0], rack: 1, t0: 0}, {role: 'mother', from: [1.5, 0, 2.5], rack: 3, t0: 12}, {role: 'kidBoy', from: [2.8, 0, 3.8], rack: 4, t0: 6, grab: false}, {role: 'elderLady', from: [-2.4, 0, 3.5], rack: 0, t0: 10, grab: false}, {role: CR[0].role, from: [1.8, 0, 4.2], rack: 2, t0: 3, grab: false}, {role: CR[1].role, from: [-2.2, 0, 4.6], rack: 1, t0: 14, grab: false}, {role: CR[2].role, from: [2.6, 0, 5.2], rack: 3, t0: 18, grab: false}];
const rushEnd = (r: typeof RUSH[number], i: number): V3 => [RACK15[r.rack][0] + (r.grab === false ? 0.55 : 0), 0, RACK15[r.rack][2] + 0.6 + (r.grab === false ? 0.5 : 0.24)]; // 0.3 m behind the handle (handle at rack z + 0.6); a second person behind the first
export function rushArgs(i: number, f: number, n: number, c: Pose): {role: Role; p: V3; pose: RickPose; grips: V3[]; arrive: number} {
  const r = RUSH[i], to = rushEnd(r, i), t = clamp((f - r.t0) / (n - 24 - r.t0)), u = 1 - (1 - t) * (1 - t), p: V3 = lerp3(r.from, to, u), dir = dirTo(r.from, to), dd = Math.hypot(p[0] - r.from[0], p[2] - r.from[2]), arrive = seg(f, n - 24, n - 10); // everybody arrives at n - 24 and then grabs the bar
  const gr = cartGrips([RACK15[r.rack][0], 0, RACK15[r.rack][2]], 0), g = handsOn(r.role, p, c, gr[0], gr[1], dir);
  const pose = poseOf(p, c.p, {fwd: dir, torsoFwd: dir, headFwd: blendDir(dir, dirTo(p, c.p), arrive), ...gaitR(r.role, dd, 0.5, 1 - arrive * 0.9, i * 0.3), ...(arrive > 0.5 && r.grab !== false ? g : SPECS[r.role].cane ? {hands: [null, [CX + 70, 570]] as RickPose['hands']} : {}), lean: 0.14 * leanOf(p, c, dir) * (1 - arrive) + ageLean(r.role, p, c, dir), face: arrive > 0.3 ? 'happyArc' : 'teeth', bounce: stepBounce(f, 0, n, 11, r.role)});
  return {role: r.role, p, pose, grips: gr, arrive: r.grab === false ? 0 : arrive};
}
const E15B: React.FC<Ctx> = ({f, n, c, ss}) => (
  <><ShopScene ss={ss} f={f} />
    {RACK15.map((p, i) => <Cart key={i} p={p} ry={0} />)}
    {RUSH.map((_r, i) => { const a = rushArgs(i, f, n, c); return <Person key={i} role={a.role} p={a.p} s={S} cam={c.p} pose={a.pose} noCane={SPECS[a.role].cane ? a.arrive > 0.5 : false} />; })}</>
);

// ================================================================= SHOT 16 (register B): the owner counts cash, carts overflow, the sales explode
export const OWN16: V3 = [4.2, 0, -3.4];
const E16: React.FC<Ctx> = ({f, c, ss}) => {
  const cnt = Math.sin(f * 0.5), boom = clamp((f - 12) / 28);
  const pose = poseOf(OWN16, c.p, {fwd: dirTo(OWN16, c.p), torsoFwd: dirTo(OWN16, c.p), headFwd: dirTo(OWN16, c.p), hands: [[CX - 70 + 14 * cnt, 440 + 8 * cnt], [CX + 70 - 14 * cnt, 440 - 8 * cnt]], handsZ: [80, 80], lean: 0.01, headRoll: 0.06 * cnt, headDy: 8, face: 'happyArc', bounce: bounceAt([{kind: 'reach', f0: 4, k: 0.4}, {kind: 'reach', f0: 30, k: 0.5, dir: -1}], f, hw('owner'), 1)});
  const hn = handPos('owner', pose, OWN16, c.p, S, 0), carts: V3[] = [[2.45, 0, -1.9], [2.3, 0, -5.0], [1.7, 0, -6.4]];
  return (<><ShopScene ss={ss} f={f} drawer={seg(f, 8, 16)} crank={seg(f, 4, 12) * 2} /><Person role="owner" p={OWN16} s={S} cam={c.p} pose={pose} />
    <Bills p={[hn[0] - 0.05, hn[1] + 0.03, hn[2]]} n={5} rot={[0.4, 0.2, 0.2]} />
    {carts.map((p, i) => <Cart key={i} p={p} ry={Math.PI / 2 + i * 0.25} load={1} seed={i * 5} />)}
    {Array.from({length: 9}, (_, i) => { const t = clamp((f - 8 - i * 3) / 36), q: V3 = [4.0 + (i - 4) * 0.0, 1.1 + 1.6 * Math.sin(Math.PI * Math.min(1, t * 0.9)) , -3.3 + (i - 4) * 0.22 - t * 0.0]; return t > 0 && t < 1 ? <Bills key={i} p={[q[0] - t * (0.9 + (i % 3) * 0.3), q[1], q[2]]} n={1} rot={[t * 6, i, t * 4]} /> : null; })}
    <Glint p={[3.4, 1.7, -3.3]} size={0.6} k={boom * (1 - boom)} /></>);
};

// ================================================================= SHOT 17 (entrance D, wide): rows of carts lined at the entrance
export const ROWS17: V3[] = [[-6.9, 0, 5], [-5.75, 0, 5], [-4.6, 0, 5]].flatMap(([z]) => Array.from({length: 6}, (_, i) => V(-2.4 + i * 0.96, 0, z)));
const E17: React.FC<Ctx> = ({f, c, ss}) => (<><ShopScene ss={ss} f={f} />{ROWS17.map((p, i) => <Cart key={i} p={p} ry={0} spin={0} load={i % 7 === 0 ? 0.15 : 0} />)}<Glint p={[0.9, 1.0, -6.2]} size={0.5} k={Math.max(0, Math.sin(clamp(f / 50) * Math.PI))} /></>);

// ================================================================= SHOT 18 (aisle A): a shopper pushes a cart toward the camera and realises the stranger behind him is a paid actor, who winks
export const V18 = 0.02, P18 = (f: number): V3 => [0.25, 0, -4.2 + V18 * Math.min(f, 130)];
const E18: React.FC<Ctx> = ({f, n, c, ss}) => {
  const turn = seg(f, 56, 76), wink = seg(f, 104, 112) * (1 - seg(f, 150, 158)), pos = P18(f), moving = 1 - seg(f, 118, 136), dist = V18 * Math.min(f, 130);
  const actor: V3 = [0.85, 0, pos[2] - 1.9];
  return (<><ShopScene ss={ss} f={f} />
    <PushScene role="oldMan" pos={pos} dir={[0, 1]} c={c} dist={dist} moving={moving} face={f < 56 ? 'happyArc' : f < 100 ? 'confused' : 'shock'} amp={0.28} period={18} f={f} n={n} load={0.5} look={blendDir(dirTo(pos, c.p), [0, -1], turn)} extra={{headRoll: 0.1 * turn}} />
    <PushScene role="actD" pos={actor} dir={[0, 1]} c={c} dist={dist} moving={moving} face={wink > 0.5 ? 'smug' : 'happyArc'} amp={0.28} period={18} f={f} n={n} load={0.3} seed={7} ph={0.5} look={dirTo(actor, pos)} extra={{headRoll: 0.1 * wink}} />
    {wink > 0.3 && <Glint p={[actor[0] - 0.12, 1.62, actor[2] + 0.22]} size={0.28} k={wink} />}</>);
};
void THREE; void B; void RED;

// ---------------------------------------------------------------- GRIP QA: hand-to-anchor distance for every held cart, every frame (shots 1, 2, 3, 13, 14, 15a, 15b, 18). Baskets, cane, cash and cans hang from / sit in the hand by construction.
const ARG1 = (f: number, n: number): PushArgs[] => [{role: 'pusher', pos: p1(f), dir: [0, 1], dist: V1 * f, face: 'happyArc', amp: 0.3, f, n, load: Math.min(0.5, f / 300)}];
export const GRIP_SCAN: Record<string, (f: number, n: number) => PushArgs[]> = {
  '1': ARG1,
  '2': (f, n) => [{role: 'pusher', pos: p2(f), dir: [-1, 0], dist: 0.03 * f, face: 'happyArc', amp: 0.3, f, n, load: 0.4, period: 18}],
  '3': (f, n) => [{role: 'pusher', pos: P3, dir: [0, 1], dist: 0, moving: 0, face: 'deadpan', f, n, load: 0.5}],
  '13': (f, n) => ([['actA', -3.9, -0.5], ['actB', -3.0, 0.55], ['actC', -2.1, -0.15]] as [Role, number, number][]).map(([role, z0, x], i): PushArgs => ({role, pos: [x, 0, z0 + V13 * f], dir: [0, 1], dist: V13 * f, amp: 0.34, period: 17, f, n, ph: i * 0.5, load: 0.3})),
  '14': (f, n) => { const d = 0.55 * Math.sin(clamp(f / 70) * Math.PI); return [{role: 'greeter', pos: [G14[0], 0, G14[2] + d * 0.8], dir: [0, 1], dist: d * 0.8, moving: 0.8, amp: 0.25, period: 16, f, n}]; },
  '18': (f, n) => { const pos = P18(f), moving = 1 - seg(f, 118, 136), dist = V18 * Math.min(f, 130); return [{role: 'oldMan', pos, dir: [0, 1], dist, moving, amp: 0.28, period: 18, f, n, load: 0.5}, {role: 'actD', pos: [0.85, 0, pos[2] - 1.9], dir: [0, 1], dist, moving, amp: 0.28, period: 18, f, n, load: 0.3, ph: 0.5}]; },
};
/** Max grip error (m) of a shot over all its frames; `camAt` gives the camera of the shot at a frame. */
export let GRIP_DBG = '';
export function gripScan(id: string, n: number, camAt: (f: number) => Pose): {worst: number; frame: number; role: string} {
  let worst = 0, frame = 0, wr = '';
  for (let f = 0; f < n; f++) {
    const c = camAt(f);
    if (id === '15a') { const a = A15(f, n, c), g = pushGeom(a, c), e = gripError(a.role, g.pose, a.pos, c, g.grips, [0, 1]); if (e > worst) { worst = e; frame = f; wr = a.role; } continue; }
    if (id === '15b') { for (let i = 0; i < RUSH.length; i++) { const a = rushArgs(i, f, n, c); if (a.arrive > 0.99) { const e = gripError(a.role, a.pose, a.p, c, a.grips, [0, 1]); if (e > worst) { worst = e; frame = f; wr = a.role; GRIP_DBG = JSON.stringify({p: a.p, hands: a.pose.hands, z: a.pose.handsZ, grips: a.grips, h0: handPos(a.role, a.pose, a.p, c.p, S, 0), h1: handPos(a.role, a.pose, a.p, c.p, S, 1), fwd: a.pose.fwd, lean: a.pose.lean}); } } } continue; }
    for (const a of GRIP_SCAN[id]?.(f, n) ?? []) { const g = pushGeom(a, c), e = gripError(a.role, g.pose, a.pos, c, g.grips, [0, 1]); if (e > worst) { worst = e; frame = f; wr = a.role; if (id === '2') GRIP_DBG = JSON.stringify({pos: a.pos, hands: g.pose.hands, z: g.pose.handsZ, grips: g.grips, h0: handPos(a.role, g.pose, a.pos, c.p, S, 0), h1: handPos(a.role, g.pose, a.pos, c.p, S, 1), cam: c.p, lean: g.pose.lean}); } }
  }
  return {worst, frame, role: wr};
}

// ---------------------------------------------------------------- the registry (bodies + hero frame for the stills + zone + camera data)
export interface ShotDef {id: string; shot: number; zone: 'aisle' | 'register' | 'entrance' | 'garage'; ang: string; Body: React.FC<Ctx>; hero: number; title: string}
export const BODIES: Record<string, {Body: React.FC<Ctx>; hero: number}> = {
  '1': {Body: E1, hero: 120}, '2': {Body: E2, hero: 30}, '3': {Body: E3, hero: 44}, '4': {Body: E4, hero: 60}, '5': {Body: E5, hero: 40}, '6': {Body: E6, hero: 112}, '7': {Body: E7, hero: 40},
  '8': {Body: E8, hero: 70}, '9': {Body: E9, hero: 36}, '10': {Body: E10, hero: 70}, '11': {Body: E11, hero: 30}, '12': {Body: E12, hero: 40}, '13': {Body: E13, hero: 34}, '14': {Body: E14, hero: 60},
  '15a': {Body: E15A, hero: 140}, '15b': {Body: E15B, hero: 25}, '16': {Body: E16, hero: 30}, '17': {Body: E17, hero: 30}, '18': {Body: E18, hero: 130},
};
