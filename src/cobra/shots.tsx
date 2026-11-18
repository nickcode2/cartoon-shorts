// COBRA_EFFECT storyboard: the 15 shots as single STATIC hero poses (final camera angle of each shot, characters in place, snakes as static poses,
// troll face / tint / pop-up label already visible). No animation, no narration timing. Phase 2 reuses SETS + CAST + the camera poses below.
// Narration order of the brief: shot n -> frames (n-1)*15 .. n*15-1 in CobraStoryboard.
import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {useDelayRender} from 'remotion';
import {Pose, V3} from '../kit/kit';
import {CX} from '../kit/rickRig';
import {LABEL_PX, Label3D, upperThirdAnchor} from '../kit/Label3D';
import {waitForFredoka} from '../kit/PopLabel';
import {sitPose} from '../kit/sit';
import {yawTo} from '../kit/rickRig';
import {B, Coin, CoinBag, CoinStack, Cy, Pl, SnakeField, SnakeSpec, Sp, C, scatter} from './common';
import {Person, Role, dirTo, handPos, poseOf} from './cast';
import {Desk, Garage, Lights, Office, Poster, Street} from './sets';

// ---------------------------------------------------------------- cameras (3 per street, 2 per office, 2 per garage; fov 62 for 9:16)
const cam = (p: V3, l: V3, fov = 62): Pose => ({p, l, fov});
export const ANGLES = {
  street: {A: cam([0, 0.85, 3.5], [0, 1.1, -3]), B: cam([0, 5.6, 8.5], [0, 0.4, -4]), C: cam([0, 24, -3.5], [0, 0, -4.2]), D: cam([0.5, 0.3, 1.9], [0, 0.45, -0.2])}, // D = low close angle on the feet (4th and last named street angle)
  office: {A: cam([0, 1.35, 1.5], [0, 1.25, -2.4]), B: cam([0.2, 1.45, 0.2], [0, 1.3, -2.0])},
  garage: {A: cam([0, 1.3, 0.9], [0, 1.1, -3.5]), B: cam([0, 0.55, 8.4], [0, 1.5, 2.0])},
} as const;

export interface BodyProps {cam: Pose; ready: boolean; ss: number}
export interface ShotDef {n: number; title: string; set: 'STREET' | 'OFFICE' | 'GARAGE'; angle: string; cam: Pose; focal: V3; r: number; troll: string; Body: React.FC<BodyProps>}

/** Fredoka ready flag (holds the frame until the font is loaded). */
export function useFredoka(): boolean {
  const {delayRender, continueRender} = useDelayRender();
  const [ready, setReady] = useState(false);
  const [h] = useState(() => delayRender('fredoka'));
  useEffect(() => { let live = true; waitForFredoka().then(() => { if (live) { setReady(true); continueRender(h); } }, () => continueRender(h)); return () => { live = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

const S = 0.9; // character scale (1.74 m tall)
/** Pop-up label: upper part of the frame, centred, above the focal point, 60 % of the first size (kit default). */
const lab = (text: string, focal: V3, c: Pose, ready: boolean, px = LABEL_PX) => <Label3D text={text} anchor={upperThirdAnchor(c, focal)} pose={c} f={30} start={0} ready={ready} px={px} lift={0} />;

// ---------------------------------------------------------------- static snake data (module level: stable references, no per-render rebuild)
const pile = (n: number, cx: number, cz: number, rx: number, rz: number, hMax: number, seed: number, dead: boolean, scale = 1): SnakeSpec[] => Array.from({length: n}, (_, i) => {
  const a = (i * 2.399963) % (Math.PI * 2), r = Math.sqrt((i + 0.5) / n), layer = Math.floor((i / n) * 6) / 5; // golden-angle spread, the first ones form the outer, lower ring
  const h = (1 - r) * hMax * (0.6 + 0.4 * layer) + 0.03;
  return {x: cx + Math.cos(a) * rx * r, z: cz + Math.sin(a) * rz * r, y: h, yaw: a * 3.1, shape: dead ? 'limp' : (['S', 'tight', 'coil'] as const)[i % 3], dead, s: scale * (0.85 + 0.3 * ((i * 7) % 5) / 5), flip: i % 2 === 0};
});
const SN7 = scatter(70, 7, {x0: -2.0, x1: 2.0, z0: -9, z1: 1.8}, {avoid: [[0.2, -0.8, 0.6]], scale: 1});
const SN3 = scatter(42, 3, {x0: -2.4, x1: 2.4, z0: -26, z1: 2}, {scale: 1.5}).concat(scatter(12, 31, {x0: -12, x1: 12, z0: -9.4, z1: -6.9}, {scale: 1.5}));
const SN13 = scatter(80, 13, {x0: -2.7, x1: 2.7, z0: -16, z1: 3}, {scale: 1.7});
const SN12 = (() => { const o: SnakeSpec[] = []; for (let i = 0; i < 78; i++) { const t = ((i * 0.6180339) % 1), z = 2.5 + t * t * 4.8, hw = 1.5 + 0.55 * (z - 2.4), x = ((((i * 0.7548776) % 1) * 2) - 1) * hw; o.push({x, z, y: 0, yaw: Math.atan2(x * 0.3, 1) + (i % 7) * 0.6, shape: (['S', 'tight', 'coil', 'S', 'up'] as const)[i % 5], s: 1.05, flip: i % 2 === 0}); } return o; })();
const SN11 = pile(60, 0, -2.0, 1.45, 0.95, 0.62, 11, false);
const SN6 = pile(34, -0.85, -2.45, 0.6, 0.4, 0.8, 6, true, 0.9);
const SN2: SnakeSpec[] = [{x: -0.3, z: -0.1, y: 0, yaw: 0.5, shape: 'up', s: 0.9}, {x: 0.35, z: -0.15, y: 0, yaw: -0.4, shape: 'up', s: 0.9, flip: true}, {x: 0.9, z: -0.7, y: 0, yaw: 1.2, shape: 'S'}];
const SN14: SnakeSpec[] = [[-0.7, -0.1], [0.9, 0.1], [-1.1, -1.7], [1.2, -1.9], [0.2, -2.9]].map(([x, z], i) => ({x, z: z + 0.15, y: 0, yaw: i, shape: 'up' as const, s: 0.95, flip: i % 2 === 0}));
const C14 = [[-0.7, -0.1], [0.9, 0.1], [-1.1, -1.7], [1.2, -1.9], [0.2, -2.9]] as const;
const SN1: SnakeSpec[] = [{x: 0.04, z: -0.74, y: 0.0, yaw: Math.PI / 2 + 0.2, shape: 'S', s: 0.95}];

// ---------------------------------------------------------------- bodies
const B1: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0.1, 0, -0.4], head = dirTo(p, c.p);
  const pose = poseOf(p, c.p, {fwd: [0, -1], torsoFwd: [0, -1], headFwd: head, legSw: [0.5, -0.28], toe: [0.35, 0], hands: [[CX - 178, 150], [CX + 178, 150]], lean: -0.04, face: 'shock'});
  return (<><Lights mode="street" /><Street /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN1} cam={c.p} /></>);
};
const B2: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0, 0.3, -0.2];
  const pose = poseOf(p, c.p, {legSw: [0.25, -0.25], legOut: [-0.45, 0.45], bend: [0.8, 0.8], hands: [[CX - 190, 300], [CX + 190, 215]], lean: 0.06, headRoll: 0.08, face: 'shock'});
  return (<><Lights mode="street" /><Street /><Person role="man" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN2} cam={c.p} /></>);
};
const B3: React.FC<BodyProps> = ({cam: c}) => (<><Lights mode="street" /><Street /><SnakeField snakes={SN3} cam={c.p} /></>);
const B4: React.FC<BodyProps> = ({cam: c, ready}) => {
  const p: V3 = [0, 0, -2.0];
  const pose = poseOf(p, c.p, {hands: [[CX - 100, 545], [CX + 195, 215]], handsZ: [105, null], lean: -0.03, headRoll: 0.06, face: 'smug'});
  const h = handPos('official', pose, p, c.p, S, 0);
  return (<><Lights mode="office" /><Office /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><Coin p={[h[0], 0.81, h[2]]} r={0.085} /><CoinStack p={[-0.65, 0.8, -1.35]} n={4} /><CoinStack p={[0.7, 0.8, -1.5]} n={2} />{lab('1 COIN', [0, 1.5, -2.0], c, ready)}</>);
};
const B5: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0, 0, -2.0];
  const pose = poseOf(p, c.p, {hands: [[CX - 50, 470], [CX + 50, 470]], handsZ: [95, 95], lean: 0.02, headRoll: -0.07, face: 'teeth'});
  return (<><Lights mode="office" /><Office /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><CoinBag p={[0, 0.78, -1.72]} size={0.17} /><CoinStack p={[-0.7, 0.8, -1.25]} n={5} /><CoinStack p={[0.75, 0.8, -1.3]} n={3} /></>);
};
const B6: React.FC<BodyProps> = ({cam: c, ready}) => {
  const p: V3 = [0.2, 0, -2.0];
  const pose = poseOf(p, c.p, {hands: [[CX - 110, 520], [CX + 100, 520]], handsZ: [60, 60], lean: 0.02, face: 'smug'});
  return (<><Lights mode="office" /><Office /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN6} cam={c.p} /><CoinBag p={[0.6, 0.8, -1.1]} size={0.2} /><CoinStack p={[-0.55, 0.8, -1.4]} n={9} /><CoinStack p={[-0.2, 0.8, -1.0]} n={6} />{lab('1000', [0.2, 1.5, -2.0], c, ready)}</>);
};
const B7: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0.2, 0, -0.8];
  const pose = poseOf(p, c.p, {hands: [null, [CX + 215, 200]], lean: 0.05, headRoll: 0.3, headDx: 12, face: 'confused'});
  return (<><Lights mode="street" /><Street /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN7} cam={c.p} /></>);
};
const B8: React.FC<BodyProps> = ({cam: c}) => {
  const p0: V3 = [-0.2, 0, -2.0], sp = sitPose('c12', {seat: 'bench', view: 'front', camYaw: yawTo(c.p, p0), scale: S}), p: V3 = [p0[0], sp.yOffset, p0[2]];
  const snake: SnakeSpec[] = [{x: 0.85, z: -2.0, y: 0.42, yaw: 0.3, shape: 'coil', s: 0.9}];
  return (<><Lights mode="garage" /><Garage /><B p={[-0.2, 0.225, -2.2]} s={[0.9, 0.45, 0.5]} c="#8A5A3A" ink={0.012} /><Person role="man" p={p} s={S} cam={c.p} pose={{...sp.pose, face: 'happyArc'}} /><B p={[0.85, 0.2, -2.0]} s={[0.6, 0.4, 0.5]} c="#C99A5B" ink={0.012} /><SnakeField snakes={snake} cam={c.p} /></>);
};
const BOXES9: {p: V3; s: V3; c: string}[] = (() => { const o: {p: V3; s: V3; c: string}[] = []; for (const [z, hi] of [[-5.1, 2], [-4.1, 1], [-3.1, 1]] as [number, number][]) for (let i = 0; i < 9; i++) for (let l = 0; l < hi; l++) o.push({p: [-3.2 + i * 0.8, 0.2 + l * 0.4, z], s: [0.62, 0.38, 0.5], c: (i + l) % 2 ? '#C99A5B' : '#D6A96A'}); return o; })();
const SN9: SnakeSpec[] = BOXES9.filter((_, i) => i % 2 === 0).map((b, i) => ({x: b.p[0], z: b.p[2], y: b.p[1] + 0.19, yaw: i, shape: 'coil' as const, s: 0.7, flip: i % 2 === 0}));
const B9: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0, 0, -1.8];
  const pose = poseOf(p, c.p, {hands: [[CX - 100, 560], [CX + 100, 560]], handsZ: [90, 90], lean: 0.04, headRoll: 0.05, face: 'teeth'});
  return (<><Lights mode="garage" /><Garage /><Person role="b1" p={p} s={S} cam={c.p} pose={pose} />{BOXES9.map((b, i) => <B key={i} p={b.p} s={b.s} c={b.c} ink={0.008} />)}<SnakeField snakes={SN9} cam={c.p} />
    <B p={[0, 0.78, -1.15]} s={[1.5, 0.06, 0.8]} c="#8A5A3A" ink={0.01} />{[-0.65, 0.65].map((x) => [-0.25, 0.25].map((z) => <B key={`${x}${z}`} p={[x, 0.38, -1.15 + z]} s={[0.07, 0.76, 0.07]} c="#6B4A32" />))}
    <CoinStack p={[-0.45, 0.81, -1.1]} n={7} /><CoinStack p={[-0.15, 0.81, -1.0]} n={4} /><CoinStack p={[0.2, 0.81, -1.15]} n={9} /><CoinStack p={[0.5, 0.81, -1.0]} n={5} /></>);
};
const B10: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0, 0, -2.0];
  const pose = poseOf(p, c.p, {hands: [[CX - 160, 262], [CX + 160, 262]], handsZ: [85, 85], lean: -0.05, headRoll: -0.08, face: 'annoyed'});
  const hl = handPos('official', pose, p, c.p, S, 0), hr = handPos('official', pose, p, c.p, S, 1);
  return (<><Lights mode="office" /><Office poster={false} /><B p={[1.45, 1.95, -3.12]} s={[1.14, 1.48, 0.02]} c="#F7E7C6" cast={false} /><Person role="official" p={p} s={S} cam={c.p} pose={pose} tint={{state: 'angry', zones: ['full'], k: 0.85}} />
    <Poster p={[hl[0] - 0.12, hl[1] + 0.22, hl[2] + 0.06]} w={0.36} h={0.5} half="left" rot={[0, 0, 0.3]} /><Poster p={[hr[0] + 0.12, hr[1] + 0.22, hr[2] + 0.06]} w={0.36} h={0.5} half="right" rot={[0, 0, -0.3]} />
    <Pl p={[0.5, 0.01, -0.3]} w={0.25} h={0.3} c="#F6E9C8" rot={[-Math.PI / 2, 0, 0.5]} /><Pl p={[-0.6, 0.01, 0.1]} w={0.2} h={0.25} c="#F6E9C8" rot={[-Math.PI / 2, 0, -0.8]} /></>);
};
const B11: React.FC<BodyProps> = ({cam: c}) => {
  const p0: V3 = [0, 0, -2.0], sp = sitPose('c14', {seat: 'bench', view: 'front', camYaw: yawTo(c.p, p0), scale: S}), p: V3 = [0, sp.yOffset, -2.0];
  return (<><Lights mode="garage" /><Garage /><B p={[0, 0.225, -2.2]} s={[1.3, 0.45, 0.55]} c="#8A5A3A" ink={0.012} /><Person role="b2" p={p} s={S} cam={c.p} pose={{...sp.pose, headRoll: 0.12, headDy: 10, face: 'sad'}} tint={{state: 'sick', zones: ['cheeks', 'around-eyes'], k: 0.9}} /><SnakeField snakes={SN11} cam={c.p} /></>);
};
const B12: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [-0.8, 0, 4.4];
  const pose = poseOf(p, c.p, {hands: [[CX - 205, 410], [CX + 205, 410]], handsZ: [30, 30], headRoll: 0.16, lean: 0.03, face: 'happyArc'});
  return (<><Lights mode="garage" /><Garage open={1} /><Person role="b3" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN12} cam={c.p} /></>);
};
const B13: React.FC<BodyProps> = ({cam: c, ready}) => (<><Lights mode="street" /><Street /><SnakeField snakes={SN13} cam={c.p} />{lab('DELHI, INDIA', [0, 1.5, -4.5], c, ready)}</>);
const B14: React.FC<BodyProps> = ({cam: c}) => {
  const p: V3 = [0.1, 0, -1.0];
  const pose = poseOf(p, c.p, {hands: [[CX - 215, 235], [CX - 10, 190]], handsZ: [null, 70], lean: -0.06, headRoll: -0.1, headDy: 8, face: 'fear'});
  const h = handPos('official', pose, p, c.p, S, 0);
  return (<><Lights mode="street" /><Street /><Person role="official" p={p} s={S} cam={c.p} pose={pose} /><SnakeField snakes={SN14} cam={c.p} />{C14.map(([x, z], i) => <Coin key={i} p={[x + 0.28, 0.07, z + 0.1]} r={0.09} rot={[0.1, 0, 0.1]} />)}<Coin p={[h[0] - 0.12, h[1] + 0.25, h[2] + 0.05]} r={0.1} rot={[Math.PI / 2.4, 0.3, 0]} /></>);
};
const B15: React.FC<BodyProps> = ({cam: c}) => {
  const snakes: SnakeSpec[] = [{x: 0.4, z: 1.62, y: 0, yaw: Math.PI / 2, shape: 'S', s: 0.9}];
  return (<><Lights mode="garage" /><Garage open={0.05} /><SnakeField snakes={snakes} cam={c.p} />
    <Sp p={[-0.7, 0.07, 1.6]} s={[0.1, 0.05, 0.03]} c={C.lime} basic cast={false} /><Sp p={[-0.74, 0.08, 1.64]} s={[0.018, 0.018, 0.01]} c={C.ink} basic cast={false} /><Sp p={[-0.66, 0.08, 1.64]} s={[0.018, 0.018, 0.01]} c={C.ink} basic cast={false} /></>);
};
void Cy; void useMemo; void THREE; void Desk;

export const SHOTS: ShotDef[] = [
  {n: 1, title: 'man steps on a snake', set: 'STREET', angle: 'A', cam: ANGLES.street.A, focal: [0.1, 1.55, -0.4], r: 0.45, troll: 'scared', Body: B1},
  {n: 2, title: 'second and third snake, hop', set: 'STREET', angle: 'A', cam: ANGLES.street.A, focal: [0, 1.85, -0.2], r: 0.5, troll: '-', Body: B2},
  {n: 3, title: 'house / street / town (final: top-down)', set: 'STREET', angle: 'C', cam: ANGLES.street.C, focal: [0, 0, -4.2], r: 6, troll: '-', Body: B3},
  {n: 4, title: 'official slaps ONE coin, points at the drawing', set: 'OFFICE', angle: 'A', cam: ANGLES.office.A, focal: [0, 1.5, -2.0], r: 0.5, troll: 'smug', Body: B4},
  {n: 5, title: 'crowd kills snakes (final: official hugs the coin bag)', set: 'OFFICE', angle: 'B', cam: ANGLES.office.B, focal: [0, 1.5, -2.0], r: 0.5, troll: 'thrilled', Body: B5},
  {n: 6, title: 'pile of limp snakes + coin bag grow, counter 1000', set: 'OFFICE', angle: 'A', cam: ANGLES.office.A, focal: [0.2, 1.5, -2.0], r: 0.6, troll: '-', Body: B6},
  {n: 7, title: 'still full of snakes, official looks out', set: 'STREET', angle: 'A', cam: ANGLES.street.A, focal: [0.2, 1.5, -0.8], r: 0.5, troll: 'confused', Body: B7},
  {n: 8, title: 'hard vs easy (final: man sits calm, snake nests in a box)', set: 'GARAGE', angle: 'A', cam: ANGLES.garage.A, focal: [-0.2, 1.1, -2.0], r: 0.5, troll: '-', Body: B8},
  {n: 9, title: 'rows of boxes, breeder counts coins', set: 'GARAGE', angle: 'A', cam: ANGLES.garage.A, focal: [0, 1.5, -1.8], r: 0.5, troll: 'evil grin', Body: B9},
  {n: 10, title: 'official reads the report, rips the drawing', set: 'OFFICE', angle: 'A', cam: ANGLES.office.A, focal: [0, 1.5, -2.0], r: 0.5, troll: 'angry + red tint', Body: B10},
  {n: 11, title: 'breeder sits in snakes up to the waist', set: 'GARAGE', angle: 'A', cam: ANGLES.garage.A, focal: [0, 1.15, -2.0], r: 0.5, troll: 'sad + sick green tint', Body: B11},
  {n: 12, title: 'big door opens, snakes pour out', set: 'GARAGE', angle: 'B', cam: ANGLES.garage.B, focal: [-1.35, 1.5, 3.4], r: 0.55, troll: 'innocent shrug', Body: B12},
  {n: 13, title: 'even more snakes, DELHI, INDIA (final: street B)', set: 'STREET', angle: 'B', cam: ANGLES.street.B, focal: [0, 1.5, -4.5], r: 3, troll: '-', Body: B13},
  {n: 14, title: 'official throws coins, snakes pop up', set: 'STREET', angle: 'A', cam: ANGLES.street.A, focal: [0.1, 1.55, -1.0], r: 0.5, troll: 'fear / facepalm', Body: B14},
  {n: 15, title: 'closed door, a lime snake peeks from under it', set: 'GARAGE', angle: 'B', cam: ANGLES.garage.B, focal: [0, 0.2, 2.0], r: 1.2, troll: '-', Body: B15},
];
export type {Role};
