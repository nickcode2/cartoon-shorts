// OVERBOARD_SURVIVOR takes 1 - 9 (ship, deck, stage, corridor, first seconds in the water). Every body is a function of its local frame f; the world frame g = START[id] + f.
// MOTION SOURCES (searched 2026-11-17, see STYLE_NOTES OVERBOARD_SURVIVOR): a fall = free fall under gravity with the ship's forward speed kept (the man keeps moving with the ship until the water stops him);
// a tumble = a whole-figure roll about the view axis (limbs follow, no stretching); air guitar = strumming hand + fretting hand + head bob (estimates, no frame counts anywhere, untested).
import React from 'react';
import * as THREE from 'three';
import {V3} from '../kit/kit';
import {CX, GROUND, HIP_Y, PXM} from '../kit/rickRig';
import {Ctx, START, sm, ramp, mix, clamp, shipPos, swimXZ, Sea, WarmPoint, idleExtra, HANDS_UP, rippleSrc} from './base';
import {Person, poseOf, dirTo, handPos, headPos, DECK, STAGE, ROLE} from './cast';
import {Swimmer, swimHands, swimP, Splash, Cocktail, LuggageTag, SWIM_S, HIP_DROP, cardPoint} from './fx';
import {CruiseShip, Wake, DECK_Y, RAIL_Z} from './ships';
import {Corridor, Cabin, Reception, Stage, Trophy, trophyGrips} from './interiors';
import {handTo, gaitR, kf, stepBounce, clampHand} from '../shop/shots';

const S = SWIM_S;
export const fall = (f: number) => { // the man: local ship coordinates (x, y, z) of his hips over the take + the roll angle
  const rail = f < 14 ? 0 : sm((f - 14) / 10), tau = Math.max(0, (f - 24) / 30);
  const y = f < 24 ? mix(DECK_Y + HIP_DROP, DECK_Y + HIP_DROP + 1.45, rail) : DECK_Y + HIP_DROP + 1.45 - 0.5 * 5.2 * tau * tau;
  const z = mix(6.9, 8.5, ramp(f, 12, 26)) + 1.1 * tau;
  const roll = 0.3 * ramp(f, 0, 12) + 1.0 * ramp(f, 12, 24) + 5.0 * ramp(f, 24, 72);
  return {y, z, roll};
};
/** A whole figure rolled about the view axis through its hip: the card keeps facing the camera, limbs follow. */
export const Rolled: React.FC<{hip: V3; cam: V3; angle: number; children: React.ReactNode}> = ({hip, cam, angle, children}) => {
  const q = React.useMemo(() => new THREE.Quaternion(), []), ax = new THREE.Vector3(cam[0] - hip[0], cam[1] - hip[1], cam[2] - hip[2]).normalize();
  q.setFromAxisAngle(ax, angle);
  return <group position={hip} quaternion={q.clone()}><group position={[-hip[0], -hip[1], -hip[2]]}>{children}</group></group>;
};

// 1 "A man falls off a cruise ship." low wide of the lit ship, he tumbles over the rail (crane-down follow)
export const E1: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['1'] + f, sp = shipPos(g), w = fall(f), hip: V3 = [sp[0] - 3.2, w.y, sp[2] + w.z], feet: V3 = [hip[0], hip[1] - HIP_DROP, hip[2]];
  const k = ramp(f, 8, 20), pose = poseOf(feet, c.p, {...swimHands('survivor', 'flail', g, 470, k), face: f < 10 ? 'smug' : f < 22 ? 'confused' : 'shock', legSw: [0.5 * Math.sin(f * 0.5) * k, -0.5 * Math.sin(f * 0.5) * k], bend: [0.6, 0.2], headRoll: 0.2 * k * Math.sin(f * 0.4)});
  return (
    <>
      <Sea mode="night" g={g} focus={[sp[0], 3, sp[2] + 10]} ss={ss} amp={0.7} />
      <CruiseShip p={sp} /><Wake p={[sp[0] - 47, 0.3, sp[2]]} len={90} spread={14} />
      <WarmPoint p={[sp[0] - 3, 11.5, sp[2] + 8]} i={10} d={9} />
      <Rolled hip={hip} cam={c.p} angle={w.roll}><Person role="survivor" p={feet} s={S} cam={c.p} pose={pose} noCane /></Rolled>
    </>
  );
};
// 2 "At night." crane-up to a high wide: the ship tiny in the endless dark ocean under the stars
export const E2: React.FC<Ctx> = ({f, ss}) => {
  const g = START['2'] + f, sp = shipPos(g);
  return (<><Sea mode="night" g={g} focus={[sp[0], 3, sp[2]]} ss={ss} amp={0.7} fogNear={95} fogFar={210} /><CruiseShip p={sp} deck={false} /><Wake p={[sp[0] - 47, 0.3, sp[2]]} len={90} spread={14} /></>);
};
// deck bystanders: a seeded mixed-age crowd standing in the promenade lane, chatting with each other (nobody looks at the rail)
const DeckFolk: React.FC<{sp: V3; g: number; cam: V3; list: [number, number, number, number][]}> = ({sp, g, cam, list}) => (
  <>{list.map(([i, x, z, face], k) => { const p: V3 = [sp[0] + x, DECK_Y, sp[2] + z], role = ROLE(DECK, i), look = dirTo(p, [sp[0] + x + (face > 0 ? 1 : -1) * 2, DECK_Y, sp[2] + z - 0.5]); return <Person key={k} role={role} p={p} s={S} cam={cam} noCane={false} pose={poseOf(p, cam, {...idleExtra(g, i + k), face: k % 2 ? 'happyArc' : 'deadpan', headFwd: look, headPitch: 0.25, torsoFwd: look})} />; })}</>
);
// 3 "Nobody sees it." deck passengers, nobody looks at the rail; push-in on the empty rail (his glass is still on it)
export const E3: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['3'] + f, sp = shipPos(g);
  return (
    <>
      <Sea mode="night" g={g} focus={[sp[0], 10, sp[2] + 6]} ss={ss} amp={0.7} moon={false} />
      <CruiseShip p={sp} />
      <Cocktail p={[sp[0] - 3.1, DECK_Y + 1.1, sp[2] + RAIL_Z]} />
      <DeckFolk sp={sp} g={g} cam={c.p} list={[[0, -6.0, 5.9, 1], [1, -7.4, 6.3, -1], [4, -9.0, 5.8, 1]]} />
      <WarmPoint p={[sp[0] - 5, 11.5, sp[2] + 6]} i={9} d={9} />
    </>
  );
};
// 4 "He hits the water... and the ship keeps sailing." splash with a foam ring, then a truck-back as the ship's lights slide away
export const E4: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['4'] + f, sp = shipPos(g), age = f / 30, up = ramp(f, 6, 22), wl = mix(525, 440, up), xz = swimXZ(g);
  const surface: V3 = [0, 0, 0];
  return (
    <>
      <Sea mode="night" g={g} ripples={[{x: 0, z: 0, t0: START['4'] / 30, k: 2.4}, {x: 0, z: 0, t0: START['4'] / 30 + 0.5, k: 1.4}, ...rippleSrc(g).slice(0, 2)]} focus={[0, 1, 2]} ss={ss} amp={0.7} />
      <CruiseShip p={sp} /><Wake p={[sp[0] - 47, 0.3, sp[2]]} len={90} spread={14} />
      <Splash p={surface} age={age} size={1.3} />
      {f > 4 && <Swimmer g={g} xz={xz} wl={wl} cam={c.p} arms={f < 20 ? 'flail' : 'tread'} armK={ramp(f, 6, 26)} face={f < 22 ? 'shock' : 'fear'} amp={0.7} look={dirTo([0, 0, 0], [sp[0], 0, sp[2]])} extra={{headFwd: dirTo([0, 0, 0], [sp[0] + 20, 0, sp[2]])}} />}
    </>
  );
};
// 5 "Wait, what? Nobody noticed?" close on an oblivious passenger enjoying the night (punch-in)
export const E5: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['5'] + f, sp = shipPos(g), p: V3 = [sp[0] - 8, DECK_Y, sp[2] + 6.5], hd = poseOf(p, c.p, {...idleExtra(g, 3, 0.8), hands: [null, [CX + 165, 500]], handsZ: [null, 40], face: 'happyArc', headPitch: 0.32, headRoll: 0.06 * Math.sin(f * 0.12)});
  const hp = handPos('cruiser', hd, p, c.p, S, 1);
  return (
    <>
      <Sea mode="night" g={g} focus={[sp[0], 10, sp[2] + 6]} ss={ss} amp={0.7} moon={false} />
      <CruiseShip p={sp} />
      <Person role="cruiser" p={p} s={S} cam={c.p} pose={hd} />
      <Cocktail p={[hp[0], hp[1] - 0.02, hp[2]]} />
      <WarmPoint p={[p[0] - 1.2, 11.6, p[2] - 1.5]} i={8} d={7} />
    </>
  );
};
// 6 "You see, he'd only been on board for a day." the man smiling on deck with a luggage tag (arc-in)
export const E6: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['6'] + f, sp = shipPos(g), p: V3 = [sp[0] - 11, DECK_Y, sp[2] + 6.3], hd = poseOf(p, c.p, {...idleExtra(g, 9, 0.8), hands: [null, [CX + 170, 405 + 12 * Math.sin(f * 0.1)]], handsZ: [null, 40], face: f < 40 ? 'happyArc' : 'thrilled', headRoll: 0.07 * Math.sin(f * 0.1)});
  const hp = handPos('survivor', hd, p, c.p, S, 1);
  return (
    <>
      <Sea mode="night" g={g} focus={[sp[0], 10, sp[2] + 6]} ss={ss} amp={0.7} moon={false} />
      <CruiseShip p={sp} />
      <Person role="survivor" p={p} s={S} cam={c.p} pose={hd} />
      <LuggageTag p={[hp[0], hp[1] + 0.02, hp[2] + 0.04]} />
      <WarmPoint p={[p[0] + 1.4, 11.6, p[2] - 1.4]} i={8} d={7} />
    </>
  );
};

// ---------------------------------------------------------------- the stage: air guitar
const airGuitar = (g: number, seed: number, mir: number) => { // strumming hand (card slot 1 for mir = 1) + fretting hand up front + knees bent + head bob
  const a = g * 0.42 + seed, strum = Math.sin(a), other = mir > 0 ? 0 : 1, hands: ([number, number] | null)[] = [null, null], z: [number | null, number | null] = [null, null];
  hands[1 - other] = [CX + mir * (70 + 18 * strum), 600 + 26 * Math.cos(a)]; z[1 - other] = 60;
  hands[other] = [CX - mir * (200 + 8 * Math.sin(a * 0.5)), 380 + 20 * Math.sin(a * 0.7)]; z[other] = 50;
  const c2 = other === 0 ? [hands[0], hands[1]] : [hands[0], hands[1]];
  return {hands: c2 as ([number, number] | null)[], handsZ: z, crouch: 0.22 + 0.06 * Math.sin(a), legOut: [0.16, -0.16] as [number, number], headRoll: 0.16 * Math.sin(a * 0.5), headPitch: 0.1 * Math.sin(a * 0.5), lean: 0.07 * Math.sin(a * 0.5), face: 'thrilled' as const};
};
const Crowd: React.FC<{g: number; cam: V3; ring?: boolean}> = ({g, cam}) => (
  <>{[[0, -4.6, -2.2], [1, -3.4, -1.1], [2, -2.9, -2.6], [3, 2.9, -2.3], [4, 3.7, -1.2], [5, 4.9, -2.6], [6, -5.6, -0.9], [7, 5.8, -1.5]].map(([i, x, z], k) => { const p: V3 = [x, 0, z], to = dirTo(p, [x * 0.2, 0, -5.6]); return <Person key={k} role={ROLE(STAGE, i)} p={p} s={S} cam={cam} pose={poseOf(p, cam, {...HANDS_UP(g, k * 1.3), fwd: to, torsoFwd: to, headFwd: to, face: k % 3 ? 'thrilled' : 'happyArc', bend: [0.3, 0.3], lean: 0.05 * Math.sin(g * 0.3 + k), crouch: 0.1 + 0.08 * Math.sin(g * 0.5 + k)})} />; })}</>
);
const StageLights: React.FC<{}> = () => (<><hemisphereLight args={['#FFE9D0', '#7A5A6A', 2.4]} /><directionalLight color="#FFD9B0" intensity={1.4} position={[-4, 8, 6]} /><WarmPoint p={[0, 4.5, -4]} color="#FFD9A0" i={14} d={12} /></>);
export const PAIR_A: V3 = [-0.42, 0.8, -5.4], PAIR_B: V3 = [0.42, 0.8, -5.4]; // shoulder to shoulder: about one body width apart
// 7a "Minutes earlier, he'd won an air guitar contest..." man and sister air-guitaring, the crowd cheering (arc around)
export const E7A: React.FC<Ctx> = ({f, c}) => {
  const g = START['7a'] + f, a: V3 = PAIR_A, b: V3 = PAIR_B;
  return (
    <>
      <StageLights /><Stage f={g} />
      <Person role="survivor" p={a} s={S} cam={c.p} pose={poseOf(a, c.p, airGuitar(g, 0, 1))} />
      <Person role="sister" p={b} s={S} cam={c.p} pose={poseOf(b, c.p, airGuitar(g, 1.7, -1))} />
      <Crowd g={g} cam={c.p} />
    </>
  );
};
// 7b trophy held up (both hands on the trophy grip anchors)
export const trophySetup = (c: {p: V3}, f: number) => {
  const m: V3 = [-0.4, 0.8, -4.9], tp: V3 = [m[0] + 0.42 + 0.01 * Math.sin(f * 0.2), 0.8 + 1.0, m[2] + 0.22], grips = trophyGrips(tp), r = handTo('survivor', 1, m, {p: c.p, l: m}, grips[0]), up = clampHand('survivor', 0, [CX - 190 + 15 * Math.sin(f * 0.4), 215 + 25 * Math.sin(f * 0.5), 20], 1, 14);
  return {m, tp, grips, pose: poseOf(m, c.p, {hands: [[up[0], up[1]], r.xy], handsZ: [up[2], r.z], face: 'thrilled', headRoll: 0.05 * Math.sin(f * 0.15), lean: 0.03 * Math.sin(f * 0.2)})};
};
export const E7B: React.FC<Ctx> = ({f, c}) => {
  const g = START['7b'] + f, t = trophySetup(c, f), s: V3 = [1.7, 0.8, -5.3];
  return (
    <>
      <StageLights /><Stage f={g} />
      <Person role="survivor" p={t.m} s={S} cam={c.p} pose={t.pose} />
      <Trophy p={t.tp} s={1} />
      <Person role="sister" p={s} s={S} cam={c.p} pose={poseOf(s, c.p, {...HANDS_UP(g, 2), face: 'thrilled', headRoll: 0.1 * Math.sin(f * 0.3), crouch: 0.1 + 0.05 * Math.sin(f * 0.5)})} />
    </>
  );
};
// 8 "Then he went to the bathroom. And that's the last thing he remembers." corridor, push-in to the restroom door; hard cut at the end
export const manZ = (f: number) => -8.3 - (1.4 * Math.min(f, 112)) / 30 - 0.0 * f;
export const E8: React.FC<Ctx> = ({f, c}) => {
  const z = manZ(f), p: V3 = [0, 0, z], d: [number, number] = [0, -1], door = ramp(f, 96, 116), step = Math.min(f, 112);
  const pose = poseOf(p, c.p, {fwd: d, torsoFwd: d, headFwd: d, ...gaitR('survivor', (1.4 * step) / 30, 0.3, 1 - ramp(f, 100, 112)), bounce: stepBounce(f, 0, 112, 17, 'survivor'), hands: door > 0 ? [null, [CX + 130, 540 - 90 * door]] : undefined, handsZ: door > 0 ? [null, 70] : undefined, face: 'deadpan'});
  return (
    <>
      <hemisphereLight args={['#FFE9D0', '#8A6A50', 2.6]} /><directionalLight color="#FFE2B0" intensity={1.0} position={[1, 4, 6]} />
      <Corridor open={door} />
      {f < 138 && <Person role="survivor" p={p} s={S} cam={c.p} pose={pose} />}
    </>
  );
};
// 9 "He wakes up alone in the dark water." face at water level, eyes opening (low push-in, slight dutch)
export const E9: React.FC<Ctx> = ({f, c, ss}) => {
  const g = START['9'] + f, xz = swimXZ(g), face = f < 14 ? 'annoyed' : f < 30 ? 'deadpan' : f < 46 ? 'confused' : 'sad';
  return (
    <>
      <Sea mode="night" g={g} ripples={rippleSrc(g)} focus={[0, 0.5, 0]} ss={ss} amp={0.8} />
      <Swimmer g={g} xz={xz} wl={395} cam={c.p} arms="rest" face={face} pitch={f < 14 ? 0.1 : 0} roll={f < 14 ? 0.12 : 0.02} lean={0.04} amp={0.8} look={dirTo([0, 0, 0], c.p)} />
    </>
  );
};
void cardPoint; void headPos; void swimP; void GROUND; void HIP_Y; void PXM; void kf; void clamp; void Cabin; void Reception;
