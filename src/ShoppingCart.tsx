// SHOPPING_CART: the full video. Compositions ShoppingCart (preview) and ShoppingCartSilent (render this one, 300-frame chunks): 1080x1920, 30 fps, 2055 frames = 68.5 s, no audio.
// Audio in SHOPPING_CART/ (narration.mp3 trimmed: first word at 0.4 s, padded to the video length; sfx.wav; ambience.wav). No troll faces, no on-screen text.
// Camera: CAMERA RULES v4 + v3.1: every shot has ONE S-curve 3D move relative to its focus (the narrated object / action = focusGroup), the focus stays centred, size bands (no zooming out
// to fit), named angles per zone. Timing: src/shop/timeline.json (trimmed-narration times measured with ffmpeg silencedetect, 2026-11-17).
import React, {useMemo} from 'react';
import {EffectComposer} from '@react-three/postprocessing';
import {MoveV3, SAFE_ZOOM, bandDistance, bandOf, focusGroup, followFocus, moveV3, orbitPos} from './kit/camera';
import {FocusDof} from './kit/Dof';
import {gradeEffects} from './kit/Grade';
import {Pose, ShotSpec, SingleCanvasVideo, V3} from './kit/kit';
import {QAEntry, runQA} from './kit/qa';
import {DIRS, ShopSet} from './shop/angles';
import {BODIES, gripScan, GRIP_DBG, Ctx, BENCH_Z, CART7, CHAIR6, CART8, CART9, CART11, CART10, D5, G14, L14, L15, M10, OWN12, OWN16, OWN6, OWN7, OWN8, P3, P4, CART4, V1, V13, W9, pos5, p1, p2, mix, clamp} from './shop/shots';
import {headPos} from './shop/cast';
import TL from './shop/timeline.json';

export const SC_FPS = 30;
export const SC_FRAMES = TL.frames;
const FOV = 62;
type Move = MoveV3 | ((a: Pose) => (f: number, n: number) => Pose);
interface Entry {id: string; zone: ShopSet; ang: string; h: number; fr: number; axis?: 'y' | 'z'; focus: (f: number) => V3; move: Move; keys?: {name: string; at: (f: number) => V3; r: number; f: number[]}[]}
const c3 = (x: number, y: number, z: number) => (): V3 => [x, y, z];
const head3 = headPos('pusher', P3, 0.9), headL = headPos('greenLady', L15, 0.9);
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export const ENTRIES: Entry[] = [
  {id: '1', zone: 'aisle', ang: 'C', focus: (f) => [0.6, 0.9, p1(f)[2] + 0.55], h: 1.9, fr: 0.5, move: {yawDeg: [0, 18], push: [0, 0.08]}, keys: [{name: 'man and cart', at: (f) => [0.6, 0.9, p1(f)[2] + 0.55], r: 0.8, f: [0, 100, 200]}]},
  {id: '2', zone: 'aisle', ang: 'D', focus: c3(-0.05, 1.0, -2.9), h: 1.9, fr: 0.45, move: {dx: [-0.5, 0.5]}},
  {id: '3', zone: 'aisle', ang: 'A', focus: focusGroup([c3(head3[0], head3[1], head3[2]), c3(P3[0], 0.75, P3[2] + 0.65)]), h: 1.45, fr: 0.55, move: {push: [0, 0.08]}},
  {id: '4', zone: 'register', ang: 'A', focus: focusGroup([c3(P4[0], 1.0, P4[2]), c3(CART4[0], 0.7, CART4[2])]), h: 2.5, fr: 0.5, move: {yawDeg: [0, 20], push: [0, 0.06]}, keys: [{name: 'cart', at: c3(CART4[0], 0.6, CART4[2]), r: 0.4, f: [60, 100]}, {name: 'owner', at: c3(P4[0], 1.1, P4[2]), r: 0.4, f: [60, 100]}]},
  {id: '5', zone: 'aisle', ang: 'F', focus: (f) => { const p = pos5(D5(f)).p; return [p[0], 0.75, p[2]]; }, h: 1.7, fr: 0.5, move: {yawDeg: [0, 26], push: [0, 0.06]}, keys: [{name: 'heavy basket', at: (f) => { const p = pos5(D5(f)).p; return [p[0], 0.5, p[2]]; }, r: 0.35, f: [60, 150, 230]}]},
  {id: '6', zone: 'garage', ang: 'A', focus: c3(1.38, 1.2, BENCH_Z), h: 1.2, fr: 0.55, move: {pitchDeg: [0, 32], push: [0, 0.05]}, keys: [{name: 'chair', at: c3(CHAIR6[0], 1.2, CHAIR6[2]), r: 0.3, f: [30, 70, 110, 130]}]},
  {id: '7', zone: 'garage', ang: 'D', focus: focusGroup([c3(OWN7[0], 1.0, OWN7[2]), c3(CART7[0], 0.7, CART7[2])]), h: 2.3, fr: 0.5, move: {push: [0, 0.1]}, keys: [{name: 'finished cart', at: c3(CART7[0], 0.65, CART7[2]), r: 0.55, f: [20, 55]}]},
  {id: '8', zone: 'entrance', ang: 'A', focus: focusGroup([c3(OWN8[0], 1.0, OWN8[2]), c3(CART8[0], 0.7, CART8[2])]), h: 2.3, fr: 0.5, move: {push: [0, 0.06], endAt: 0.7}, keys: [{name: 'lone cart', at: c3(CART8[0], 0.6, CART8[2]), r: 0.5, f: [30, 80]}]},
  {id: '9', zone: 'entrance', ang: 'C', focus: focusGroup([c3(W9[0], 1.0, W9[2]), c3(CART9[0], 0.7, CART9[2])]), h: 2.4, fr: 0.5, move: {yawDeg: [0, 18], push: [0, 0.05]}, keys: [{name: 'cart', at: c3(CART9[0], 0.6, CART9[2]), r: 0.55, f: [30, 60]}]},
  {id: '10', zone: 'aisle', ang: 'D', focus: focusGroup([c3(M10[0], 1.1, M10[2]), c3(CART10[0], 0.7, CART10[2])]), h: 2.1, fr: 0.5, move: {push: [0, 0.1]}, keys: [{name: 'cart', at: c3(CART10[0], 0.6, CART10[2]), r: 0.55, f: [40, 100]}]},
  {id: '11', zone: 'entrance', ang: 'B', focus: c3(CART11[0], 0.7, CART11[2]), h: 1.9, fr: 0.25, move: {push: [0, -0.12]}, keys: [{name: 'cart alone', at: c3(CART11[0], 0.6, CART11[2]), r: 0.6, f: [0, 30, 65]}]},
  {id: '12', zone: 'register', ang: 'C', focus: focusGroup([c3(OWN12[0], 1.0, OWN12[2]), c3(0.7, 1.0, OWN12[2])]), h: 2.2, fr: 0.4, move: {dx: [-0.3, 0.3]}},
  {id: '13', zone: 'aisle', ang: 'B', focus: (f) => [-0.56, 0.9, -3.0 + V13 * f], h: 2.3, fr: 0.45, move: {dx: [-0.25, 0.25]}},
  {id: '14', zone: 'entrance', ang: 'E', focus: focusGroup([c3(G14[0], 1.0, G14[2]), c3(L14[0], 1.0, L14[2])]), h: 2.3, fr: 0.5, move: {yawDeg: [0, 20], push: [0, 0.05]}},
  {id: '15a', zone: 'entrance', ang: 'F', focus: focusGroup([c3(headL[0], headL[1], headL[2]), c3(L15[0] + 0.3, 0.6, L15[2] + 0.9)]), h: 1.85, fr: 0.55, move: {push: [0, 0.1]}},
  {id: '15b', zone: 'entrance', ang: 'A', focus: c3(0, 0.9, -4.0), h: 1.9, fr: 0.25, move: {dy: [0, 1.2], pitchDeg: [0, 8]}},
  {id: '16', zone: 'register', ang: 'B', focus: c3(3.8, 1.2, -3.4), h: 1.9, fr: 0.5, move: {yawDeg: [0, 20], push: [0, 0.05]}, keys: [{name: 'register', at: c3(3.4, 1.3, -3.3), r: 0.4, f: [10, 30, 42]}]},
  {id: '17', zone: 'entrance', ang: 'D', focus: c3(0, 0.8, -6.0), h: 1.9, fr: 0.33, move: {dy: [0, 1.0]}},
  {id: '18', zone: 'aisle', ang: 'A', focus: (f) => [0.38, 1.05, -4.2 + 0.02 * Math.min(f, 130) - 0.95], h: 2.3, fr: 0.5, move: {push: [0, 0.04], endAt: 0.9}, keys: [{name: 'shopper', at: (f) => [0.25, 1.0, -4.2 + 0.02 * Math.min(f, 130)], r: 0.3, f: [60, 110]}, {name: 'shopper (last frame)', at: (f) => [0.25, 1.0, -4.2 + 0.02 * Math.min(f, 130)], r: 0.2, f: [190]}, {name: 'actor', at: (f) => [0.85, 1.0, -6.1 + 0.02 * Math.min(f, 130)], r: 0.3, f: [110, 150, 190]}]},
];
// frames of every entry (explicit: narration beats from timeline.json)
export const ENTRY_FRAMES: {id: string; from: number; to: number}[] = TL.cuts.map((c, i) => ({id: c.id, from: c.f, to: i + 1 < TL.cuts.length ? TL.cuts[i + 1].f : SC_FRAMES}));
void V1; void p2; void OWN6; void mix; void clamp; void mid;

/** Camera of an entry: base pose from the named angle + the band distance, the move relative to the focus, then the damped follow, kept inside the hall. */
export function buildCam(e: Entry): {cam: (f: number, n: number) => Pose; base: (f: number, n: number) => Pose} {
  const d = DIRS[e.zone][e.ang], r = bandDistance(e.h, e.fr, d.el, e.axis ?? 'y', FOV, SAFE_ZOOM), f0 = e.focus(0);
  const a: Pose = {p: orbitPos(f0, d.az, d.el, r), l: f0, fov: FOV}, base = typeof e.move === 'function' ? e.move(a) : moveV3(a, e.move), follow = followFocus(base, e.focus, {damping: 5, lead: 5});
  const fit = (f: number, n: number): Pose => {
    const c = follow(f, n), p: V3 = [c.p[0], c.p[1], c.p[2]];
    if (e.zone === 'garage') { p[1] = Math.max(0.22, Math.min(2.7, p[1])); p[2] = Math.min(p[2], 1.2); p[0] = Math.max(-3.7, Math.min(3.7, p[0])); }
    else { p[0] = Math.max(-4.4, Math.min(4.4, p[0])); p[1] = Math.max(0.22, Math.min(2.35, p[1])); p[2] = Math.max(-8.5, Math.min(14, p[2])); }
    return {...c, p};
  };
  return {base, cam: fit};
}
const CAMS = ENTRIES.map(buildCam);
export const qaEntries = (): QAEntry[] => ENTRIES.map((e, i) => {
  const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, c = CAMS[i];
  return {id: e.id, set: e.zone, ang: e.ang, kind: bandOf(e.fr), n, cam: (f, nn) => c.cam(f, nn), base: c.base, endAt: typeof e.move === 'function' ? undefined : e.move.endAt, sCurve: typeof e.move !== 'function', focus: (f) => e.focus(f), box: [e.h, e.h, e.h], h: e.h, fr: e.fr, axis: e.axis, keys: e.keys};
});
/** GRIP QA: hand-to-anchor distance of every held cart at every frame of its shot must stay < 3 % of the character height (0.052 m). */
export function runGripQA(): string[] {
  const bad: string[] = [], ok: string[] = [];
  ENTRIES.forEach((e, i) => { if (!['1', '2', '3', '13', '14', '15a', '15b', '18'].includes(e.id)) return; const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, r = gripScan(e.id, n, (f) => CAMS[i].cam(f, n)); (r.worst < 0.052 ? ok : bad).push(`${e.id}: worst ${(r.worst * 100).toFixed(1)} cm (${r.role} @${r.frame})`); });
  console.info('[grip-dbg]', GRIP_DBG);
  return [`${bad.length ? 'FAIL' : 'PASS'} hands pinned to the grip anchors of every held cart, all frames (< 5.2 cm = 3 % of the height): ${[...bad, ...ok].join('; ')}`];
}
export const runShopQA = () => { const r = runQA(qaEntries(), ENTRIES.map((e) => ({id: e.id, set: e.zone, ang: e.ang}))), g = runGripQA(); return {lines: [...r.lines, ...g], fails: [...r.fails, ...g.filter((l) => l.startsWith('FAIL'))]}; };

const EntryView: React.FC<{i: number; f: number; n: number; ss: number}> = ({i, f, n, ss}) => {
  const e = ENTRIES[i], B = BODIES[e.id].Body, c = CAMS[i].cam(f, n), ctx: Ctx = {f, n, c, ss};
  return <B {...ctx} />;
};
export const ShoppingCart: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa') === '1') { const r = runShopQA(); (window as unknown as {__qa?: string[]}).__qa = r.lines; r.lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa]', l) : console.info('[qa]', l))); }
    return ENTRIES.map((e, i) => {
      const {from, to} = ENTRY_FRAMES[i], n = to - from;
      return {from, to, light: 'day', ownLights: true, cam: (_u: number, t: number) => CAMS[i].cam(Math.min(n - 1, Math.round(t * SC_FPS)), n), post: (_fr: number, pose: Pose) => (<EffectComposer multisampling={4}><FocusDof pose={pose} focal={e.focus(0)} r={e.h * 0.5} />{gradeEffects()}</EffectComposer>), render: (t: number) => <EntryView i={i} f={Math.min(n - 1, Math.round(t * SC_FPS))} n={n} ss={2048} />};
    });
  }, []);
  return <SingleCanvasVideo shots={shots} fps={SC_FPS} />;
};

/** QA contact sheet cells: shot k (1..18) sampled at 0, 25, 50, 75, 100 % of its whole span. */
export function sheetCells(shot: number) {
  const idx = ENTRIES.map((e, i) => ({e, i, fr: ENTRY_FRAMES[i]})).filter((x) => parseInt(x.e.id, 10) === shot), from = idx[0].fr.from, to = idx[idx.length - 1].fr.to;
  return [0, 0.25, 0.5, 0.75, 1].map((q) => {
    const g = Math.min(to - 1, from + Math.round(q * (to - from - 1))), k = idx.find((x) => g >= x.fr.from && g < x.fr.to) ?? idx[idx.length - 1], n = k.fr.to - k.fr.from, f = Math.min(n - 1, g - k.fr.from), pose = CAMS[k.i].cam(f, n);
    return {i: k.i, id: k.e.id, f, n, pose, focus: k.e.focus(f), h: k.e.h, axis: k.e.axis, kind: bandOf(k.e.fr), ang: k.e.ang, g, zone: k.e.zone};
  });
}
export const EntryBody: React.FC<{i: number; f: number; n: number; c: Pose; ss: number}> = ({i, f, n, c, ss}) => { const B = BODIES[ENTRIES[i].id].Body; return <B f={f} n={n} c={c} ss={ss} />; };
