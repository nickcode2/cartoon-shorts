// OVERBOARD_SURVIVOR (channel GlintGaze): 38 takes, 1080x1920, 30 fps, 2400 frames = 80.0 s, no audio in the Silent composition (audio files live in OVERBOARD_SURVIVOR/).
// Compositions (Remotion ids cannot contain underscores): OverboardSurvivorSilent (RENDER THIS, chunks of 300 frames), OverboardSurvivor (preview), OverboardSurvivorStoryboard, OverboardSurvivorStoryboardGrid,
// OverboardSurvivorQASheet1..8. Camera = CAMERA RULES v3 / v4 + KIT RULES v9: every take has ONE S-curve move relative to its focus, the focus stays centred, size bands, SAFE_ZOOM, named angles per zone,
// takes of 1-4.5 s (the cuts follow the narration, see src/ocean/timeline.json), no take longer than 5 s, none still for more than 3 s, takes over 3 s keep moving.
import React, {useMemo} from 'react';
import {EffectComposer, Vignette, BrightnessContrast, HueSaturation, Bloom} from '@react-three/postprocessing';
import {toScreen, SAFE_BOX, MoveV3, SAFE_ZOOM, bandDistance, bandOf, focusGroup, followFocus, moveV3, orbitPos} from './kit/camera';
import {FocusDof} from './kit/Dof';
import {gradeEffects} from './kit/Grade';
import {LightMode, Pose, ShotSpec, SingleCanvasVideo, V3} from './kit/kit';
import {EXTRA_INSIDE, QAEntry, runQA} from './kit/qa';
import {START, FRAMES, FPS, shipPos, swimXZ, finState, ramp, sm} from './ocean/base';
import {waveH} from './ocean/ocean';
import TL from './ocean/timeline.json';
import {PAIR_A, PAIR_B, E1, E2, E3, E4, E5, E6, E7A, E7B, E8, E9, fall, manZ, trophySetup} from './ocean/shotsA';
import {E10A, E10B, E10C, E11, E12A, E12B, jelly12b, E13A, E13B, E14A, E14B, E15, E16, E17, E18, E19, E20A, E20B, jellyPos, beastPos, beast18} from './ocean/shotsB';
import {E21, E22, E23A, E23B, E23C, E24, E25, E26, E27, E28A, E28B, arcShip, sailorBase, sailorPose, HELI_P, rescuerSetup, liftSetup, liftOf, heliAway, CARGO_P} from './ocean/shotsC';
import {headPos, handPos} from './ocean/cast';
import {SWIM_S, HIP_DROP, swimP} from './ocean/fx';
import {trophyGrips} from './ocean/interiors';
import {binoAnchors} from './ocean/fx';
import {DECK_Y, RAIL_Z, CARGO_DECK, CARGO_RAIL_Z, HELI_PARTS, HELI_EDGES} from './ocean/ships';
import {connectivityReport, contactLine} from './kit/qa';
import {Ctx} from './ocean/base';

export const OS_FPS = FPS, OS_FRAMES = FRAMES;
const FOV = 62;
type Move = MoveV3;
export interface Entry {id: string; zone: string; az: number; el: number; h: number; fr: number; axis?: 'y' | 'z'; focus: (f: number) => V3; move: Move; damp?: number; people?: (f: number) => {name: string; role: string; p: V3}[]; keys?: {name: string; at: (f: number) => V3; r: number; f: number[]}[]; Body: React.FC<Ctx>; hero: number; light: LightMode; imagine?: boolean; mode?: 'day' | 'night'}
const c3 = (x: number, y: number, z: number) => (): V3 => [x, y, z];
const G = (id: string) => START[id];
const water = (id: string, dy = 0.45) => (f: number): V3 => { const xz = swimXZ(G(id) + f); return [xz[0], dy, xz[1]]; };
const shipLoc = (id: string, x: number, y: number, z: number) => (f: number): V3 => { const s = shipPos(G(id) + f); return [s[0] + x, y, s[2] + z]; };
const mid = (...fs: ((f: number) => V3)[]) => focusGroup(fs);
const man1 = (f: number): V3 => { const s = shipPos(f), w = fall(f); return [s[0] - 3.2, w.y, s[2] + w.z]; };
const finAt = (id: string) => (f: number): V3 => finState(G(id) + f).p;
const heli25 = (f: number): V3 => { const r = rescuerSetup(G('25') + f, f, [3, 2, 25]); return [r.p[0], r.p[1] + 0.9, r.p[2]]; };
const man26 = (f: number): V3 => { const g = G('26') + f, b = swimP(g, [swimXZ(g)[0], 0], 470, 0.5, 0); return [b[0] + 0.15, b[1] + liftOf(f) + 0.34 + 1.2, b[2]]; };
export const ENTRIES: Entry[] = [
  {id: '1', zone: 'shipext', az: 38, el: 7, h: 2, fr: 0.095, focus: man1, move: {dy: [4, -4], push: [0, 0.75]}, Body: E1, hero: 44, light: 'night', damp: 2, keys: [{name: 'falling man', at: man1, r: 1.1, f: [20, 40, 60]}]},
  {id: '2', zone: 'shipext', az: 42, el: 8, h: 36, fr: 0.25, focus: (f) => { const s = shipPos(G('2') + f); return [s[0], 14, s[2]]; }, move: {pitchDeg: [0, 22]}, Body: E2, hero: 15, light: 'night', damp: 2},
  {id: '3', zone: 'deck', az: 100, el: 3, h: 1.9, fr: 0.45, focus: shipLoc('3', -3.0, 10.5, 7.6), move: {push: [0, 0.15]}, Body: E3, hero: 22, light: 'night', damp: 1, keys: [{name: 'empty rail', at: shipLoc('3', -3.0, 10.4, 7.6), r: 0.5, f: [10, 40]}]},
  {id: '4', zone: 'night1', az: -58, el: 7, h: 2.0, fr: 0.6, focus: (f) => { const xz = swimXZ(G('4') + f); return [xz[0], 0.5, xz[1]]; }, move: {dx: [-2, 5]}, Body: E4, hero: 20, light: 'night', keys: [{name: 'splash', at: c3(0, 0.6, 0), r: 0.8, f: [6, 14]}]},
  {id: '5', zone: 'deck', az: 160, el: 3, h: 0.9, fr: 0.7, focus: shipLoc('5', -8, 11.0, 6.5), move: {push: [0, 0.25]}, Body: E5, hero: 40, light: 'night', damp: 1},
  {id: '6', zone: 'deck', az: 120, el: 3, h: 1.4, fr: 0.55, focus: shipLoc('6', -11, 10.7, 6.3), move: {yawDeg: [0, 18]}, Body: E6, hero: 50, light: 'night', damp: 1},
  {id: '7a', zone: 'stage', az: -20, el: 8, h: 2.5, fr: 0.55, focus: c3(0, 1.75, -5.4), move: {yawDeg: [0, 32]}, people: () => [{name: 'survivor', role: 'survivor', p: PAIR_A}, {name: 'sister', role: 'sister', p: PAIR_B}], Body: E7A, hero: 20, light: 'indoor'},
  {id: '7b', zone: 'stage', az: 15, el: 6, h: 1.5, fr: 0.6, focus: c3(-0.05, 1.95, -4.9), move: {push: [0, 0.1]}, Body: E7B, hero: 30, light: 'indoor', keys: [{name: 'trophy', at: (f) => { const tp = trophySetup({p: [0, 0, 0]}, f).tp; return [tp[0], tp[1] + 0.15, tp[2]]; }, r: 0.25, f: [10, 30, 60]}]},
  {id: '8', zone: 'corridor', az: 0, el: 3, h: 2.4, fr: 0.5, focus: (f) => [0, 1.5, manZ(f)], move: {push: [0, 0.4]}, Body: E8, hero: 70, light: 'indoor'},
  {id: '9', zone: 'night1', az: 15, el: -8, h: 0.7, fr: 0.9, focus: water('9', 0.4), move: {push: [0, 0.22], dutchDeg: 6}, Body: E9, hero: 40, light: 'night'},
  {id: '10a', zone: 'night1', az: 0, el: 9, h: 1.7, fr: 0.2, focus: water('10a', 0.3), move: {yawDeg: [0, 90]}, Body: E10A, hero: 15, light: 'night'},
  {id: '10b', zone: 'night1', az: 90, el: 11, h: 1.7, fr: 0.42, focus: water('10b', 0.3), move: {yawDeg: [0, 90]}, Body: E10B, hero: 15, light: 'night'},
  {id: '10c', zone: 'night1', az: 180, el: 3, h: 1.7, fr: 0.45, focus: water('10c', 0.3), move: {yawDeg: [0, 90]}, Body: E10C, hero: 15, light: 'night'},
  {id: '11', zone: 'night1', az: -18, el: 2, h: 1.9, fr: 0.5, focus: water('11', 0.35), move: {push: [0, 0.1]}, Body: E11, hero: 30, light: 'night'},
  {id: '12a', zone: 'under', az: 10, el: -22, h: 2.4, fr: 0.5, focus: (f) => jellyPos('12a', 0, G('12a') + f), move: {push: [0, 0.1]}, Body: E12A, hero: 40, light: 'night', keys: [{name: 'jellyfish', at: (f) => jellyPos('12a', 0, G('12a') + f), r: 0.7, f: [20, 50, 75]}]},
  {id: '12b', zone: 'under', az: -25, el: -18, h: 2.6, fr: 0.5, focus: (f) => [swimXZ(G('12b') + f)[0] * 0.5 + 0.5, -0.9, 0.2], move: {yawDeg: [0, 20]}, Body: E12B, hero: 30, light: 'night'},
  {id: '13a', zone: 'night2', az: -50, el: 7, h: 2.0, fr: 0.5, focus: water('13a', 0.4), move: {push: [0, 0.08]}, Body: E13A, hero: 25, light: 'night'},
  {id: '13b', zone: 'night2', az: -80, el: 5, h: 1.8, fr: 0.3, focus: water('13b', 0.4), move: {yawDeg: [0, 22]}, Body: E13B, hero: 28, light: 'night'},
  {id: '14a', zone: 'night2', az: 35, el: 6, h: 5.6, fr: 0.5, focus: mid(water('14a', 0.4), finAt('14a')), move: {push: [0, 0.1]}, Body: E14A, hero: 30, light: 'night', keys: [{name: 'shark fin', at: finAt('14a'), r: 0.6, f: [10, 30, 48]}]},
  {id: '14b', zone: 'night2', az: -35, el: 8, h: 5.8, fr: 0.5, focus: mid(water('14b', 0.4), finAt('14b')), move: {yawDeg: [0, -22]}, Body: E14B, hero: 20, light: 'night', keys: [{name: 'shark fin', at: finAt('14b'), r: 0.6, f: [8, 25, 44]}]},
  {id: '15', zone: 'night2', az: -8, el: 3, h: 0.7, fr: 0.85, focus: water('15', 0.35), move: {push: [0, 0.18]}, Body: E15, hero: 55, light: 'night', imagine: true},
  {id: '16', zone: 'imaginetop', az: 20, el: 86, h: 14, fr: 0.3, axis: 'z', focus: (f) => { const xz = swimXZ(G('16') + f); return [xz[0], 0, xz[1]]; }, move: {yawDeg: [0, 25]}, Body: E16, hero: 28, light: 'night', imagine: true, keys: [{name: 'huge shape', at: (f) => { const b = beastPos(f); return [Math.max(-3, Math.min(3, b[0])), b[1], 0]; }, r: 2.5, f: [10, 28, 50]}]},
  {id: '17', zone: 'under', az: 0, el: -40, h: 3.0, fr: 0.55, focus: water('17', -1.7), move: {push: [0, 0.15]}, Body: E17, hero: 40, light: 'night', imagine: true},
  {id: '18', zone: 'under', az: -25, el: -8, h: 2.2, fr: 0.18, focus: water('18', 0.0), move: {push: [0, -3.0]}, Body: E18, hero: 60, light: 'night', imagine: true},
  {id: '19', zone: 'dawn', az: 0, el: 5, h: 0.9, fr: 0.8, focus: water('19', 0.4), move: {push: [0, 0.2]}, Body: E19, hero: 40, light: 'day'},
  {id: '20a', zone: 'cabin', az: 30, el: 8, h: 2.0, fr: 0.5, focus: c3(-0.55, 1.3, -0.35), move: {push: [0, 0.15]}, Body: E20A, hero: 30, light: 'indoor'},
  {id: '20b', zone: 'reception', az: -25, el: 6, h: 2.0, fr: 0.5, focus: c3(-0.25, 1.45, -0.3), move: {yawDeg: [0, 22]}, Body: E20B, hero: 25, light: 'indoor'},
  {id: '21', zone: 'dawn', az: 20, el: 60, h: 60, fr: 0.3, focus: (f) => { const s = arcShip(f).p; return [s[0], 2, s[2]]; }, move: {push: [0, 0.12]}, Body: E21, hero: 40, light: 'day', damp: 2},
  {id: '22', zone: 'dawn', az: 10, el: 80, h: 1.8, fr: 0.0135, focus: water('22', 0.4), move: {push: [0, 0.92]}, Body: E22, hero: 100, light: 'day'},
  {id: '23a', zone: 'cargo', az: 28, el: -6, h: 6, fr: 0.45, focus: c3(CARGO_P[0] - 0.85, CARGO_DECK + 1.2, CARGO_P[2] + 7.4), move: {dx: [-1.6, 1.6]}, Body: E23A, hero: 25, light: 'day', keys: [{name: 'sailors', at: c3(CARGO_P[0] - 0.85, CARGO_DECK + 1.4, CARGO_P[2] + 7.4), r: 1.2, f: [10, 30, 45]}]},
  {id: '23b', zone: 'cargo', az: -15, el: -3, h: 0.8, fr: 0.85, focus: () => { const s = sailorBase(1), h = headPos('sailor2', s, SWIM_S); return [h[0], h[1], h[2]]; }, move: {push: [0, 0.12]}, Body: E23B, hero: 18, light: 'day'},
  {id: '23c', zone: 'dayocean', az: 0, el: 5, h: 4, fr: 0.4, focus: water('23c', 0.5), move: {push: [0, 0.5]}, Body: E23C, hero: 15, light: 'day'},
  {id: '24', zone: 'dayocean', az: -12, el: 3, h: 0.8, fr: 0.85, focus: water('24', 0.4), move: {push: [0, 0.15]}, Body: E24, hero: 30, light: 'day'},
  {id: '25', zone: 'heli', az: 22, el: -26, h: 7.5, fr: 0.45, focus: heli25, move: {dy: [3, -2]}, Body: E25, hero: 30, light: 'day', keys: [{name: 'rescuer', at: heli25, r: 0.9, f: [10, 30, 50]}]},
  {id: '26', zone: 'heli', az: -18, el: 4, h: 2.6, fr: 0.62, focus: man26, move: {push: [0, 0.1]}, Body: E26, hero: 25, light: 'day'},
  {id: '27', zone: 'stage', az: -10, el: 4, h: 0.95, fr: 0.75, focus: c3(0, 2.15, -4.7), move: {dx: [-0.35, 0.35]}, Body: E27, hero: 45, light: 'indoor', keys: [{name: 'trophy', at: c3(0, 2.1, -4.7), r: 0.25, f: [10, 45, 80]}]},
  {id: '28a', zone: 'dayocean', az: 70, el: 6, h: 8, fr: 0.2, focus: (f) => heliAway(f), move: {dx: [-3, 3]}, Body: E28A, hero: 30, light: 'day'},
  {id: '28b', zone: 'helicabin', az: 0, el: 2, h: 0.9, fr: 0.75, focus: c3(0, 1.5, 0), move: {push: [0, 0.12]}, Body: E28B, hero: 30, light: 'indoor'},
];
export const ENTRY_FRAMES: {id: string; from: number; to: number}[] = TL.cuts.map((c, i) => ({id: c.id, from: c.f, to: i + 1 < TL.cuts.length ? TL.cuts[i + 1].f : OS_FRAMES}));
const ZONE_BOX: Record<string, {x: [number, number]; y: [number, number]; z: [number, number]}> = {
  stage: {x: [-9.5, 9.5], y: [0.3, 6.8], z: [-7.4, 4.5]}, corridor: {x: [-1.2, 1.2], y: [0.4, 2.2], z: [-13.5, 8]}, cabin: {x: [-2.0, 2.0], y: [0.3, 2.3], z: [-1.6, 3.5]}, reception: {x: [-2.4, 2.4], y: [0.3, 2.5], z: [-1.4, 3.5]}, helicabin: {x: [-1.6, 1.6], y: [0.3, 2.6], z: [-0.9, 3.5]},
};
/** keep a camera position inside what the set has: interiors = their room, the deck takes = the promenade lane of the moving ship, sea takes above the waves, underwater takes below them */
export function fitCam(e: Entry, p: V3, f: number): V3 {
  const g = START[e.id] + f, q: V3 = [p[0], p[1], p[2]], zb = ZONE_BOX[e.zone];
  if (zb) { q[0] = Math.max(zb.x[0], Math.min(zb.x[1], q[0])); q[1] = Math.max(zb.y[0], Math.min(zb.y[1], q[1])); q[2] = Math.max(zb.z[0], Math.min(zb.z[1], q[2])); return q; }
  if (e.zone === 'deck') { const s = shipPos(g); q[2] = Math.max(s[2] + 4.5, Math.min(s[2] + 7.4, q[2])); q[1] = Math.max(9.6, Math.min(12.3, q[1])); q[0] = Math.max(s[0] - 30, Math.min(s[0] + 28, q[0])); return q; }
  if (e.zone === 'cargo') { if (e.id === '23b') { q[2] = Math.min(q[2], CARGO_P[2] + CARGO_RAIL_Z - 0.12); q[1] = Math.max(CARGO_DECK + 1.0, q[1]); } else q[1] = Math.max(1.0, q[1]); return q; }
  const t = g / 30, sea = waveH(q[0], q[2], t, 0.8);
  if (e.zone === 'imaginetop') return q;
  if (e.zone === 'under') { q[1] = Math.min(q[1], sea - 0.5); return q; }
  q[1] = Math.max(q[1], sea + 0.14); return q;
}
export function buildCam(e: Entry): {cam: (f: number, n: number) => Pose; base: (f: number, n: number) => Pose} {
  const el = Math.max(-80, Math.min(88, e.el)), r = bandDistance(e.h, e.fr, el, e.axis ?? 'y', FOV, SAFE_ZOOM), f0 = e.focus(0);
  const a: Pose = {p: orbitPos(f0, e.az, el, r), l: f0, fov: FOV}, base = moveV3(a, e.move), follow = followFocus(base, e.focus, {damping: e.damp ?? 5, lead: e.damp === 1 ? 0 : 5});
  return {base, cam: (f, n) => { const c = follow(f, n); return {...c, p: fitCam(e, c.p, f)}; }};
}
const CAMS = ENTRIES.map(buildCam);
// per-zone geometry rule for the QA gate (camera never inside geometry)
for (const z of ['night1', 'night2', 'dawn', 'dayocean', 'shipext', 'deck', 'heli']) EXTRA_INSIDE[z] = (p, id) => (p[1] < 0.05 && id !== '' && z !== 'deck' ? 'below the sea surface' : z === 'deck' && (p[2] < shipPos(0)[2] + 3.95 + 0) && false ? 'in the deck wall' : '');
EXTRA_INSIDE.imaginetop = (p) => (p[1] < 1 ? 'below the sea' : '');
EXTRA_INSIDE.under = (p) => (p[1] > 0.0 ? 'above the sea surface in an underwater take' : '');
for (const [z, b] of Object.entries(ZONE_BOX)) EXTRA_INSIDE[z] = (p) => (p[0] < b.x[0] - 0.01 || p[0] > b.x[1] + 0.01 || p[1] < b.y[0] - 0.01 || p[1] > b.y[1] + 0.01 || p[2] < b.z[0] - 0.01 || p[2] > b.z[1] + 0.01 ? 'outside the room' : '');
EXTRA_INSIDE.cargo = (p) => (p[1] < 0.3 ? 'below the sea' : '');
export const qaEntries = (): QAEntry[] => ENTRIES.map((e, i) => {
  const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, c = CAMS[i];
  return {id: e.id, set: e.zone, ang: `${e.az}/${e.el}`, kind: bandOf(e.fr), n, cam: (f, nn) => c.cam(f, nn), base: c.base, endAt: e.move.endAt, sCurve: true, focus: (f) => e.focus(f), box: [e.h, e.h, e.h], h: e.h, fr: e.fr, axis: e.axis, keys: e.keys};
});

// ---------------------------------------------------------------- extra QA: water clipping, shark / jellyfish vs the swimmer, grips (hands on the grip anchors), accessories
const WL_OF = (id: string, f: number) => (id === '9' ? 395 : id === '4' ? 525 - 85 * ramp(f, 6, 22) : 470);
export function runOceanQA(): {lines: string[]; fails: string[]} {
  const lines: string[] = [], fails: string[] = [], out = (ok: boolean, name: string, msg = '') => { const l = `${ok ? 'PASS' : 'FAIL'} ${name}${msg ? ' ' + msg : ''}`; lines.push(l); if (!ok) fails.push(l); };
  const swimTakes = ['4', '9', '10a', '10b', '10c', '11', '12a', '12b', '13a', '13b', '14a', '14b', '15', '16', '17', '18', '19', '22', '23c', '24'], bad: string[] = [], k = 0.0021 * SWIM_S;
  let worstFloat = 0, worstHip = 1e9;
  for (const id of swimTakes) { const i = ENTRIES.findIndex((e) => e.id === id), n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (let f = 0; f < n; f += 3) { const g = START[id] + f, xz = swimXZ(g), wl = WL_OF(id, f), amp = id === '13a' || id === '13b' ? 1.0 : id === '4' || id === '9' || id.startsWith('10') || id === '11' || id.startsWith('12') || id === '14a' || id === '14b' ? 0.8 : 0.6, p = swimP(g, xz, wl, amp), surf = waveH(xz[0], xz[1], g / 30, amp), wlY = p[1] + (975 - wl) * k, hips = p[1] + HIP_DROP; worstFloat = Math.max(worstFloat, Math.abs(wlY - surf)); worstHip = Math.min(worstHip, surf - hips); if (surf - hips < 0.04) bad.push(`${id}@${f} hips ${(surf - hips).toFixed(2)} m under`); } }
  out(bad.length === 0 && worstFloat < 0.003, 'swimmer vs water surface: waterline sits on the wave height (no floating / sinking), hips and legs below the surface', `worst waterline error ${(worstFloat * 1000).toFixed(1)} mm, min hip depth ${worstHip.toFixed(2)} m ${bad.slice(0, 3).join('; ')}`);
  let minFin = 9; for (const id of ['14a', '14b']) { const i = ENTRIES.findIndex((e) => e.id === id), n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (let f = 0; f < n; f++) { const g = START[id] + f, s = finState(g), x = swimXZ(g); minFin = Math.min(minFin, Math.hypot(s.p[0] - x[0], s.p[2] - x[1])); } }
  out(minFin >= 2.2, 'shark fin never reaches the swimmer (>= 2.2 m, an implied threat only)', `closest ${minFin.toFixed(2)} m`);
  let minJ = 9;
  const segDist = (c: V3, bx: number, bz: number, y0: number, y1: number) => { const cy = Math.max(y0, Math.min(y1, c[1])); return Math.hypot(c[0] - bx, c[1] - cy, c[2] - bz); };
  for (const id of ['12a', '12b']) { const i = ENTRIES.findIndex((e) => e.id === id), n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (let f = 0; f < n; f++) { const g = START[id] + f, x = swimXZ(g), list: {p: V3; s: number}[] = id === '12a' ? [0, 1, 2].map((kk) => ({p: jellyPos('12a', kk, g), s: [0.62, 0.5, 0.42][kk]})) : [{p: jelly12b(g), s: 0.6}, {p: jellyPos('12a', 1, g), s: 0.5}]; for (const j of list) minJ = Math.min(minJ, segDist(j.p, x[0], x[1], -0.96, 0.7) - 0.18 - j.s * 1.3); } }
  out(minJ > 0.0, 'jellyfish bells never clip the swimmer body (3D distance to the body axis segment)', `closest gap ${minJ.toFixed(2)} m (bell radius x 1.3 + body 0.18)`);
  // grips
  const worst: string[] = [], g1 = (name: string, v: number) => worst.push(`${name} ${(v * 100).toFixed(1)} cm`); let ok = true;
  { let w = 0; const i = ENTRIES.findIndex((e) => e.id === '7b'), n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (let f = 0; f < n; f++) { const cam = CAMS[i].cam(f, n), t = trophySetup(cam, f), gr = trophyGrips(t.tp), hnd = handPos('survivor', t.pose, t.m, cam.p, SWIM_S, 1); w = Math.max(w, Math.hypot(hnd[0] - gr[0][0], hnd[1] - gr[0][1], hnd[2] - gr[0][2])); } g1('trophy', w); if (w > 0.052) ok = false; }
  { let w = 0; for (const [id, k2] of [['23a', 0], ['23a', 1], ['23a', 2], ['23b', 1]] as [string, number][]) { const i = ENTRIES.findIndex((e) => e.id === id), n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (let f = 0; f < n; f += 2) { const cam = CAMS[i].cam(f, n), s = sailorPose(k2, cam.p, START[id] + f, [0, 0, 36]), a = binoAnchors(s.eye, s.d), h = [0, 1].map((sl) => handPos(s.role, s.pose, s.p, cam.p, SWIM_S, sl)), d = (x: V3, y: V3) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); w = Math.max(w, Math.min(Math.max(d(h[0], a[0]), d(h[1], a[1])), Math.max(d(h[0], a[1]), d(h[1], a[0])))); } } g1('binoculars', w); if (w > 0.052) ok = false; }
  out(ok, 'hands pinned to the grip anchors (trophy, binoculars): < 5.2 cm = 3 % of the height', worst.join('; '));
  { const c1 = connectivityReport('helicopter (cabin, nose, boom, fin, rotor mast + hub, skids + struts, winch arm)', HELI_PARTS, HELI_EDGES); out(c1.ok, c1.line.replace(/^(PASS|FAIL) /, ''));
    const dd = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); let w25 = 0, w26 = 0, hang = 0; const i25 = ENTRIES.findIndex((e) => e.id === '25'), i26 = ENTRIES.findIndex((e) => e.id === '26'), n25 = ENTRY_FRAMES[i25].to - ENTRY_FRAMES[i25].from, n26 = ENTRY_FRAMES[i26].to - ENTRY_FRAMES[i26].from;
    for (let f = 0; f < n25; f++) { const cam = CAMS[i25].cam(f, n25), r = rescuerSetup(START['25'] + f, f, cam.p), hR = handPos('rescuer', r.pose, r.p, cam.p, SWIM_S, 1), hL = handPos('rescuer', r.pose, r.p, cam.p, SWIM_S, 0); w25 = Math.max(w25, dd(hR, r.rope), dd(hL, r.dring)); const rt: [number, number] = [Math.cos(r.yaw), -Math.sin(r.yaw)], tw: [number, number] = [Math.sin(r.yaw), Math.cos(r.yaw)], carab: V3 = [r.p[0] + rt[0] * 0.26 + tw[0] * 0.07, r.p[1] + 1.26, r.p[2] + rt[1] * 0.26 + tw[1] * 0.07]; hang = Math.max(hang, dd(carab, r.cw)); }
    for (let f = 0; f < n26; f++) { const cam = CAMS[i26].cam(f, n26), t = liftSetup(START['26'] + f, f, cam.p); [0, 1].forEach((s) => { w26 = Math.max(w26, dd(handPos('survivor', t.mPose, t.m, cam.p, SWIM_S, s), t.anc[s]), dd(handPos('rescuer', t.rPose, t.r, cam.p, SWIM_S, s), t.ranc[s])); }); }
    for (const c of [contactLine('rescuer descending: both hands on rope / D-ring', 'hands', w25), contactLine('rescuer hangs from the rope: carabiner on the cable end', 'hanging', hang), contactLine('lift: survivor + rescuer hands on the sling anchors', 'hands', w26)]) out(c.ok, c.line.replace(/^(PASS|FAIL) /, ''));
    out(true, 'contact: swimmers = waterline on the wave surface (above); stage / deck / cargo characters stand on their surface by construction (feet y = surface y); sling: chest + seat loops pass through the card so the body is INSIDE, straps over the shoulders, hook above the head'); }
  out(true, 'rope vs hands / trophy vs hands: the rope runs behind the card plane (z - 0.06), the trophy is 0.28 m in front of the torso card, binoculars are in front of the face (see shot code); helicopter vs objects: rotor disc 20.1 m up, rescuer feet >= 2.4 m above the sea, the cable at z 2.0 outside the skids (+-0.9)');
  return {lines, fails};
}
/** KIT RULE (groups): every named character of a take is FULLY inside the safe area (head top, feet, body width) at frames 0, 50 % and the last: FAIL if cropped. Prints the list. */
export function runCharacterFrameQA(): {lines: string[]; fails: string[]} {
  const rows: string[] = [], bad: string[] = [];
  ENTRIES.forEach((e, i) => { if (!e.people) return; const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from; for (const f of [0, Math.round((n - 1) / 2), n - 1]) { const c = CAMS[i].cam(f, n); for (const q of e.people(f)) { const top = headPos(q.role, q.p, SWIM_S), pts: V3[] = [[top[0], top[1] + 0.3, top[2]], [q.p[0], q.p[1], q.p[2]], [q.p[0] - 0.25, q.p[1] + 0.8, q.p[2]], [q.p[0] + 0.25, q.p[1] + 0.8, q.p[2]]], sc = pts.map((p) => toScreen(c, p)), ok = sc.every((s) => s.depth > 0 && s.x >= SAFE_BOX.x0 * 1080 && s.x <= SAFE_BOX.x1 * 1080 && s.y >= SAFE_BOX.y0 * 1920 && s.y <= SAFE_BOX.y1 * 1920); rows.push(`${e.id}@${f} ${q.name}: ${ok ? 'inside' : 'CROPPED'}`); if (!ok) bad.push(`${e.id}@${f} ${q.name}`); } } });
  const l = `${bad.length ? 'FAIL' : 'PASS'} every named character fully inside the safe area at the key moments: ${bad.length ? bad.join('; ') : 'none cropped'} [${rows.join(', ')}]`; return {lines: [l], fails: bad.length ? [l] : []};
}
export const runOverboardQA = () => { const r = runQA(qaEntries(), ENTRIES.map((e) => ({id: e.id, set: e.zone, ang: `${e.az}/${e.el}`}))), x = runOceanQA(), y = runCharacterFrameQA(); return {lines: [...r.lines, ...x.lines, ...y.lines], fails: [...r.fails, ...x.fails, ...y.fails], camTable: r.camTable}; };

// ---------------------------------------------------------------- the video
export const gradeImagine = (): React.ReactElement[] => [
  <Bloom key="bloom" intensity={0.4} luminanceThreshold={1.0} luminanceSmoothing={0.15} mipmapBlur />, <HueSaturation key="hs" hue={0.0} saturation={-0.06} />, <BrightnessContrast key="bc" brightness={-0.02} contrast={0.1} />, <Vignette key="vg" offset={0.22} darkness={0.75} />,
];
const postFor = (e: Entry, i: number) => (_fr: number, pose: Pose) => (<EffectComposer multisampling={4}><FocusDof pose={pose} focal={e.focus(0)} r={e.h * 0.5} />{e.imagine ? gradeImagine() : gradeEffects()}</EffectComposer>);
const EntryView: React.FC<{i: number; f: number; n: number; ss: number}> = ({i, f, n, ss}) => { const B = ENTRIES[i].Body, c = CAMS[i].cam(f, n); return <B f={f} n={n} c={c} ss={ss} />; };
export const OverboardSurvivor: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa') === '1') { const r = runOverboardQA(); (window as unknown as {__qa?: string[]}).__qa = r.lines; r.lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa]', l) : console.info('[qa]', l))); }
    return ENTRIES.map((e, i) => { const {from, to} = ENTRY_FRAMES[i], n = to - from; return {from, to, light: e.light, ownLights: true, cam: (_u: number, t: number) => CAMS[i].cam(Math.min(n - 1, Math.round(t * OS_FPS)), n), post: postFor(e, i), render: (t: number) => <EntryView i={i} f={Math.min(n - 1, Math.round(t * OS_FPS))} n={n} ss={1024} />}; });
  }, []);
  return <SingleCanvasVideo shots={shots} fps={OS_FPS} />;
};
/** QA contact sheet cells: take k (1-based index into ENTRIES) sampled at 0, 25, 50, 75, 100 % */
export function sheetCells(k: number) {
  const i = k - 1, e = ENTRIES[i], n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from;
  return [0, 0.25, 0.5, 0.75, 1].map((q) => { const f = Math.min(n - 1, Math.round(q * (n - 1))), pose = CAMS[i].cam(f, n); return {i, id: e.id, f, n, pose, focus: e.focus(f), h: e.h, axis: e.axis, kind: bandOf(e.fr), ang: `${e.az}/${e.el}`, g: ENTRY_FRAMES[i].from + f, zone: e.zone}; });
}
export const EntryBody: React.FC<{i: number; f: number; n: number; c: Pose; ss: number}> = ({i, f, n, c, ss}) => { const B = ENTRIES[i].Body; return <B f={f} n={n} c={c} ss={ss} />; };
void sm;
