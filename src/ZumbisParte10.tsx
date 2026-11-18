// ZUMBIS_PARTE_10 (channel FocoProibido): the full video. Compositions ZUMBIS_PARTE_10Silent / ZumbisParte10 (preview): 1080x1920, 30 fps, no audio, no on-screen text, no troll faces.
// Audio in ZUMBIS_PARTE_10/ (narration.mp3 = take 2 of the recording, trimmed; sfx.wav; ambience.wav from scripts/zumbis_audio.py). Beats: src/foco/timeline.json (scripts/zumbis_timeline.py).
// Camera: CAMERA RULES v4 + v3.1 + safe-area zoom: every shot has ONE S-curve 3D move relative to its focus (followFocus), the focus stays centred, size bands, named angles per zone.
import React, {useMemo} from 'react';
import {EffectComposer, Bloom, BrightnessContrast, HueSaturation, Vignette} from '@react-three/postprocessing';
import {MoveV3, SAFE_ZOOM, bandDistance, bandOf, easeS, followFocus, moveV3, orbitPos} from './kit/camera';
import {FocusDof} from './kit/Dof';
import {Pose, ShotSpec, SingleCanvasVideo, V3} from './kit/kit';
import {EXTRA_INSIDE, OCCLUDERS, QAEntry, runQA} from './kit/qa';
import {S} from './shop/shots';
import {DIRS, FocoZone} from './foco/angles';
import {CH, GRADE, useChannelCards} from './foco/common';
import {Person, headPos} from './foco/cast';
import {CROSS_Z, HALL_X, PODIUM_R, TOWER_Z} from './foco/sets';
import {BODIES, CAIO14, CAIO_FACE, CAIO_T, AC, BRUNO9, DOOR_SC, WIN3, Z17, Z24A, Z24B, Z24C, flockCentre, scraper, DOORMAN_P, doorAt, doorHandleS, sleeperPos} from './foco/shots';
import {WING_PTS, wingWorld, bodyWorld} from './foco/zombie';
import {brunoBack, cutF, cutT, fourPos, groupPos} from './foco/story';
import TL from './foco/timeline.json';

export const ZP_FPS = 30;
export const ZP_FRAMES = TL.frames;
const FOV = 62;
type Move = MoveV3;
interface Key {name: string; at: (f: number) => V3; r: number; f: number[]}
export interface Entry {id: string; shot: number; zone: FocoZone; ang: string; h: number; fr: number; axis?: 'y' | 'z'; focus: (f: number) => V3; move: Move; cam0?: Pose; follow?: boolean; damp?: number; lead?: number; keys?: Key[]; title: string}
const tt = (id: string, f: number) => (cutF(id) + f) / ZP_FPS;
const V = (x: number, y: number, z: number): V3 => [x, y, z];
const four = (t: number): V3 => { const r = ['caio', 'ana', 'davi', 'lia'].map((k) => fourPos(k, t)); return [r.reduce((a, b) => a + b[0], 0) / 4, 1.0, r.reduce((a, b) => a + b[2], 0) / 4]; };
const nOf = (id: string) => { const i = TL.cuts.findIndex((c) => c.id === id); return (i + 1 < TL.cuts.length ? TL.cuts[i + 1].f : TL.frames) - TL.cuts[i].f; };
const tilt = (n: number, f: number, a: number, b: number) => a + (b - a) * easeS(f / Math.max(1, n - 1));
const wingMid = (t: number): V3 => { const z = Z17(t, cutT('17') + 0.2), pt = WING_PTS[2], mid: V3 = [(WING_PTS[1][0][0] + pt[0][0]) / 2, (WING_PTS[1][0][1] + pt[0][1]) / 2, (WING_PTS[1][0][2] + pt[0][2]) / 2]; return wingWorld(z, mid, -1, t, 0.7); };
const HP = (role: string, p: V3): V3 => headPos(role, p, S);
const B8 = groupPos('bruno', cutT('7') + 0.75);
const dist0 = (c: Pose) => Math.hypot(c.p[0] - c.l[0], c.p[1] - c.l[1], c.p[2] - c.l[2]);
const cam5: Pose = {p: V(0, 2.0, -18), l: V(0, 12, -140), fov: FOV}, cam15: Pose = {p: V(0, 1.8, -110), l: V(0, 17, -132), fov: FOV}, cam23: Pose = {p: V(4.3, 24.7, -138), l: V(0, 18, -82), fov: FOV};
const hOf = (c: Pose, fr: number) => fr * 2 * Math.tan((FOV * Math.PI) / 360) * dist0(c);
export const ENTRIES: Entry[] = [
  {id: '1', shot: 1, zone: 'avenue', ang: 'A', h: 2.3, fr: 0.5, title: 'Num apocalipse', focus: (f) => V(0.15, 0.95, groupPos('caio', tt('1', f))[2] + 1.0), move: {yawDeg: [0, 18], push: [0, 0.08]}, keys: [{name: 'the group', at: (f) => V(0.15, 0.95, groupPos('caio', tt('1', f))[2] + 1.0), r: 0.8, f: [0, 100, 200]}]},
  {id: '2', shot: 2, zone: 'avenue', ang: 'B', h: 2.2, fr: 0.6, damp: 2, lead: 1.5, title: 'Garras raspam o asfalto', focus: (f) => bodyWorld(scraper(tt('2', f)), V(0, -0.2, 0.72)), move: {push: [0, 0.1]}, keys: [{name: 'claws', at: (f) => bodyWorld(scraper(tt('2', f)), V(0, -0.2, 0.72)), r: 0.22, f: [10, 30, 50]}]},
  {id: '3', shot: 3, zone: 'avenue', ang: 'C', h: 6.0, fr: 0.45, title: 'Vidro explode nas janelas', focus: () => V(WIN3.x + 0.3, WIN3.y, WIN3.z), move: {dy: [0, 2.5]}, keys: [{name: 'window burst', at: () => V(WIN3.x + 0.3, WIN3.y, WIN3.z), r: 1.6, f: [34, 44, 56]}]},
  {id: '4', shot: 4, zone: 'avenue', ang: 'D', h: 2.5, fr: 0.5, title: 'A Ana tropeca, o Caio puxa ela', focus: (f) => { const a = AC.a(f), c = AC.c(f); return V((a[0] + c[0]) / 2, 1.0, (a[2] + c[2]) / 2); }, move: {push: [0, 0.06]}, keys: [{name: 'the grip', at: (f) => { const a = AC.a(f), c = AC.c(f); return V((a[0] + c[0]) / 2, 1.0, (a[2] + c[2]) / 2); }, r: 0.5, f: [62, 76]}]},
  {id: '5', shot: 5, zone: 'tower', ang: 'A', h: hOf(cam5, 0.3), fr: 0.3, title: 'a torre da luz dourada', cam0: cam5, follow: false, focus: (f) => V(0, tilt(nOf('5'), f, 12, 56), -140), move: {dy: [0, 9], tilt: [0, 44]}, keys: [{name: 'the tower', at: () => V(0, 56, TOWER_Z), r: 10, f: [nOf('5') - 1]}]},
  {id: '6', shot: 6, zone: 'tower', ang: 'B', h: 16, fr: 0.36, title: 'uma parede de zumbis', focus: () => V(0, 12, TOWER_Z + 31), move: {yawDeg: [0, -25], push: [0, 0.1]}, keys: [{name: 'the wall', at: () => V(0, 12, TOWER_Z + 31), r: 9, f: [30, 70]}]},
  {id: '7', shot: 7, zone: 'march', ang: 'A', h: 2.3, fr: 0.5, title: 'O Bruno para', focus: (f) => { const p = groupPos('bruno', tt('7', f)); return V(p[0], 1.0, p[2]); }, move: {push: [0, 0.08]}, keys: [{name: 'Bruno', at: (f) => { const p = groupPos('bruno', tt('7', f)); return V(p[0], 1.0, p[2]); }, r: 0.5, f: [0, 20, 36]}]},
  {id: '8', shot: 8, zone: 'march', ang: 'B', h: 0.7, fr: 0.75, title: 'Olha pro grupo', focus: () => HP('bruno', B8), move: {push: [0, 0.12]}, keys: [{name: 'Bruno face', at: () => HP('bruno', B8), r: 0.17, f: [10, 25, 34]}]},
  {id: '9a', shot: 9, zone: 'march', ang: 'C', h: 0.62, fr: 0.6, title: 'Liga um radio velho', focus: () => { const b = BRUNO9(); return V(b[0] - 0.02, 0.91, b[2] + 0.26); }, move: {yawDeg: [0, 22]}, keys: [{name: 'radio', at: () => { const b = BRUNO9(); return V(b[0] - 0.02, 0.91, b[2] + 0.26); }, r: 0.2, f: [20, 45, 70]}]},
  {id: '9b', shot: 9, zone: 'march', ang: 'D', h: 2.3, fr: 0.5, title: 'corre para o lado oposto', focus: (f) => { const p = brunoBack(tt('9b', f)); return V(p[0], 1.0, p[2]); }, move: {yawDeg: [0, 30], push: [0, 0.08]}, keys: [{name: 'Bruno + radio', at: (f) => { const p = brunoBack(tt('9b', f)); return V(p[0], 0.95, p[2]); }, r: 0.7, f: [8, 26, 46]}]},
  {id: '10', shot: 10, zone: 'march', ang: 'E', h: 26, fr: 0.4, title: 'O enxame inteiro vira', focus: (f) => flockCentre(tt('10', f)), move: {yawDeg: [0, 30], push: [0, 0.05]}},
  {id: '11', shot: 11, zone: 'crossing', ang: 'A', h: 2.4, fr: 0.22, title: 'O Bruno some na avenida', focus: (f) => { const p = brunoBack(tt('11', f)); return V(p[0], 1.0, p[2]); }, move: {dy: [10, 0]}, keys: [{name: 'Bruno', at: (f) => { const p = brunoBack(tt('11', f)); return V(p[0], 1.0, p[2]); }, r: 0.8, f: [6, 34, 62]}]},
  {id: '12', shot: 12, zone: 'march', ang: 'F', h: 12, fr: 0.4, title: 'E o caminho abre', focus: (f) => V(0, 4.5, -112 - 12 * easeS(f / Math.max(1, nOf('12') - 1))), move: {push: [0, 0.12]}},
  {id: '13', shot: 13, zone: 'tower', ang: 'C', h: 2.8, fr: 0.5, title: 'Os quatro correm', focus: (f) => four(tt('13', f)), move: {yawDeg: [0, 16], push: [0, 0.06]}},
  {id: '14', shot: 14, zone: 'tower', ang: 'D', h: 0.65, fr: 0.78, title: 'E ai o Caio entende', focus: () => HP('caio', CAIO14), move: {push: [0, 0.12]}, keys: [{name: 'Caio face', at: () => HP('caio', CAIO14), r: 0.17, f: [20, 60, 82]}]},
  {id: '15', shot: 15, zone: 'base', ang: 'A', h: hOf(cam15, 0.35), fr: 0.35, title: 'chuveiros gigantes', cam0: cam15, follow: false, focus: (f) => V(0, tilt(nOf('15'), f, 17, 26), -132), move: {dy: [0, 8], tilt: [0, 9]}, keys: [{name: 'sprinklers', at: () => V(0, 26, TOWER_Z + 17.3), r: 4.5, f: [nOf('15') - 40, nOf('15') - 1]}]},
  {id: '16', shot: 16, zone: 'base', ang: 'B', h: 26, fr: 0.45, title: 'cortina de chuva', focus: () => V(0, 12, TOWER_Z + 19.5), move: {push: [0, 0.1]}},
  {id: '17', shot: 17, zone: 'base', ang: 'C', h: 2.4, fr: 0.7, title: 'Asa molhada nao voa', focus: (f) => wingMid(tt('17', f)), move: {push: [0, 0.1]}, keys: [{name: 'wet wing', at: (f) => wingMid(tt('17', f)), r: 0.6, f: [30, 60, 84]}]},
  {id: '18', shot: 18, zone: 'base', ang: 'D', h: 2.8, fr: 0.5, title: 'Eles atravessam a agua', focus: (f) => four(tt('18', f)), move: {yawDeg: [0, -25], push: [0, 0.06]}},
  {id: '19', shot: 19, zone: 'base', ang: 'E', h: 10, fr: 0.5, title: 'despencam um por um', focus: () => V(0, 4.5, TOWER_Z + 21), move: {dx: [-9, 9]}},
  {id: '20a', shot: 20, zone: 'hall', ang: 'A', h: 4.5, fr: 0.5, title: 'centenas de pessoas', focus: () => V(HALL_X - 1.5, 1.0, -3.5), move: {dy: [2.5, 0]}},
  {id: '20b', shot: 20, zone: 'hall', ang: 'B', h: 1.9, fr: 0.6, title: 'criancas dormindo', focus: () => { const a = sleeperPos(0), b = sleeperPos(2); return V((a[0] + b[0]) / 2, 0.55, (a[2] + b[2]) / 2); }, move: {push: [0, 0.12]}, keys: [{name: 'sleeping kids', at: () => { const a = sleeperPos(0), b = sleeperPos(2); return V((a[0] + b[0]) / 2, 0.55, (a[2] + b[2]) / 2); }, r: 0.5, f: [20, 60]}]},
  {id: '21', shot: 21, zone: 'hall', ang: 'C', h: 6.2, fr: 0.5, title: 'fecha a porta', focus: (f) => { const m = DOORMAN_P(doorAt(f)); return V((HALL_X + m[0]) / 2, 1.8, (-13.3 + m[2]) / 2); }, move: {push: [0, 0.06]}, keys: [{name: 'the door', at: () => V(HALL_X, 2.0, -13.3), r: 1.6, f: [30, 50, 70]}]},
  {id: '22', shot: 22, zone: 'terrace', ang: 'A', h: 2.2, fr: 0.5, title: 'o Caio sobe ao terraco', focus: () => V(CAIO_T[0], CAIO_T[1] + 1.2, CAIO_T[2]), move: {push: [0, 0.15]}},
  {id: '23', shot: 23, zone: 'terrace', ang: 'B', h: hOf(cam23, 0.3), fr: 0.3, title: 'a cidade inteira', cam0: cam23, follow: false, focus: (f) => V(0, tilt(nOf('23'), f, 18, 24), -82), move: {dy: [0, 10], tilt: [0, 6]}},
  {id: '24a', shot: 24, zone: 'night', ang: 'A', h: 3, fr: 0.55, title: 'Eles voam', focus: (f) => Z24A(tt('24a', f)).p, move: {yawDeg: [0, 20], push: [0, 0.05]}},
  {id: '24b', shot: 24, zone: 'night', ang: 'B', h: 2.2, fr: 0.5, title: 'eles correm', focus: (f) => Z24B(tt('24b', f)).p, move: {push: [0, 0.08]}},
  {id: '24c', shot: 24, zone: 'night', ang: 'C', h: 1.6, fr: 0.6, title: 'eles nao dormem', focus: (f) => bodyWorld(Z24C(tt('24c', f)), V(0, 0.08, 0.7)), move: {push: [0, 0.1]}},
  {id: '24d', shot: 24, zone: 'terrace', ang: 'C', h: 0.65, fr: 0.8, title: 'Caio sorri', focus: () => HP('caio', CAIO_FACE), move: {push: [0, 0.22], endAt: 0.75}},
];
export const ENTRY_FRAMES: {id: string; from: number; to: number}[] = TL.cuts.map((c, i) => ({id: c.id, from: c.f, to: i + 1 < TL.cuts.length ? TL.cuts[i + 1].f : ZP_FRAMES}));

// ---------------------------------------------------------------- camera limits per zone (the city is one world; these keep the lens inside the streets, the plaza, the hall and the roof deck)
const cl = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const inCrossGap = (z: number) => z < CROSS_Z + 10 && z > CROSS_Z - 10;
export function clampCam(zone: FocoZone, p: V3): V3 {
  let [x, y, z] = p; y = Math.max(0.12, y);
  if (zone === 'hall') return [cl(x, HALL_X - 8.4, HALL_X + 8.4), cl(y, 0.3, 8.3), cl(z, -12.8, 13.4)];
  if (zone === 'terrace') { const dx = x, dz = z - TOWER_Z, r = Math.hypot(dx, dz) || 1, rr = cl(r, 8.6, 17.6); return [(dx / r) * rr, cl(y, 22.5, 70), TOWER_Z + (dz / r) * rr]; }
  if (z > -117.5 && z < 66 && !(zone === 'crossing' && inCrossGap(z))) x = cl(x, -10.4, 10.4);
  const dx = x, dz = z - TOWER_Z, r = Math.hypot(dx, dz);
  if (r < 19.8 && y < 23.2) { const k = 19.8 / (r || 1); return [dx * k, y, TOWER_Z + dz * k]; }
  if (r < 8 && y < 108) return [(dx / (r || 1)) * 8, y, TOWER_Z + (dz / (r || 1)) * 8];
  return [x, y, z];
}
const insideReason = (zone: FocoZone) => (p: V3): string => {
  const [x, y, z] = p, r = Math.hypot(x, z - TOWER_Z);
  if (y < 0.1) return 'below the floor';
  if (zone === 'hall') return Math.abs(x - HALL_X) > 8.6 || z < -13 || z > 13.6 || y > 8.6 ? 'outside the hall' : '';
  if (zone === 'terrace') return y < 22.4 ? 'below the roof deck' : r > 18.4 ? 'outside the parapet' : r < 8 ? 'inside the tower' : '';
  if (r < PODIUM_R + 0.6 && y < 22.6) return 'inside the podium';
  if (r < 7.6 && y < 108) return 'inside the tower core';
  if (Math.abs(x) > 11.7 && z < 66 && z > -118.3 && y < 20 && !inCrossGap(z)) return 'inside a building';
  return '';
};
(['avenue', 'march', 'crossing', 'tower', 'base', 'hall', 'terrace', 'night'] as FocoZone[]).forEach((z) => { EXTRA_INSIDE[z] = insideReason(z); });
const poleBox = (x: number, z: number) => ({name: 'lamp pole', min: [x - 0.1, 0, z - 0.1] as V3, max: [x + 0.1, 6.4, z + 0.1] as V3});
for (const z of ['avenue', 'march', 'crossing', 'tower', 'base']) OCCLUDERS[z] = [58, 44, 30, 16, 2, -12, -26, -40, -78, -92, -106].flatMap((zz) => [poleBox(-11.6, zz), poleBox(11.6, zz + 7)]);

/** Camera of an entry: base pose from the named angle (or cam0) + the band distance, the move relative to the focus, the damped follow, kept inside the world. */
export function buildCam(e: Entry): {cam: (f: number, n: number) => Pose; base: (f: number, n: number) => Pose} {
  const f0 = e.focus(0);
  let a: Pose;
  if (e.cam0) a = e.cam0; else { const d = DIRS[e.zone][e.ang], r = bandDistance(e.h, e.fr, d.el, e.axis ?? 'y', FOV, SAFE_ZOOM); a = {p: orbitPos(f0, d.az, d.el, r), l: f0, fov: FOV}; }
  const base = moveV3(a, e.move), follow = e.follow === false ? base : followFocus(base, e.focus, {damping: e.damp ?? 5, lead: e.lead ?? 4.5});
  const fit = (f: number, n: number): Pose => { const c = follow(f, n); return {...c, p: clampCam(e.zone, c.p)}; };
  return {base, cam: fit};
}
const CAMS = ENTRIES.map(buildCam);
export const camOfEntry = (id: string, f: number, n: number): Pose => CAMS[ENTRIES.findIndex((e) => e.id === id)].cam(f, n);
export const qaEntries = (): QAEntry[] => ENTRIES.map((e, i) => {
  const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, c = CAMS[i];
  return {id: e.id, set: e.zone, ang: e.ang, kind: bandOf(e.fr), n, cam: (f, nn) => c.cam(f, nn), base: c.base, endAt: e.move.endAt, sCurve: true, focus: (f) => e.focus(f), box: [e.h, e.h, e.h], h: e.h, fr: e.fr, axis: e.axis, keys: e.keys};
});

// ---------------------------------------------------------------- the video
export const FOCO_POST = (pose: Pose, focal: V3, r: number) => (
  <EffectComposer multisampling={4}>
    <FocusDof pose={pose} focal={focal} r={r} />
    <Bloom intensity={GRADE.bloom} luminanceThreshold={GRADE.bloomThreshold} luminanceSmoothing={0.15} mipmapBlur />
    <HueSaturation hue={0} saturation={GRADE.saturation} />
    <BrightnessContrast brightness={GRADE.brightness} contrast={GRADE.contrast} />
    <Vignette offset={GRADE.vignetteOffset} darkness={GRADE.vignetteDarkness} />
  </EffectComposer>
);
const EntryView: React.FC<{i: number; f: number; n: number; c: Pose; ss: number}> = ({i, f, n, c, ss}) => { const B = BODIES[ENTRIES[i].id].Body; return <B f={f} n={n} c={c} ss={ss} g={ENTRY_FRAMES[i].from} />; };
export const ZumbisParte10: React.FC = () => {
  useChannelCards();
  const shots: ShotSpec[] = useMemo(() => ENTRIES.map((e, i) => {
    const {from, to} = ENTRY_FRAMES[i], n = to - from;
    return {from, to, light: 'foco', ownLights: true, cam: (_u: number, t: number) => CAMS[i].cam(Math.min(n - 1, Math.round(t * ZP_FPS)), n), post: (_fr: number, pose: Pose) => FOCO_POST(pose, e.focus(0), e.h * 0.5), render: (t: number) => <EntryView i={i} f={Math.min(n - 1, Math.round(t * ZP_FPS))} n={n} c={CAMS[i].cam(Math.min(n - 1, Math.round(t * ZP_FPS)), n)} ss={2048} />};
  }), []);
  return <SingleCanvasVideo shots={shots} fps={ZP_FPS} />;
};
export const EntryBody: React.FC<{i: number; f: number; n: number; c: Pose; ss: number}> = EntryView;

/** QA contact sheet cells: shot k (1..24, sub-shots included) sampled at 0, 25, 50, 75, 100 % of its span. */
export function sheetCells(shot: number) {
  const idx = ENTRIES.map((e, i) => ({e, i, fr: ENTRY_FRAMES[i]})).filter((x) => x.e.shot === shot), from = idx[0].fr.from, to = idx[idx.length - 1].fr.to;
  return [0, 0.25, 0.5, 0.75, 1].map((q) => {
    const g = Math.min(to - 1, from + Math.round(q * (to - from - 1))), k = idx.find((x) => g >= x.fr.from && g < x.fr.to) ?? idx[idx.length - 1], n = k.fr.to - k.fr.from, f = Math.min(n - 1, g - k.fr.from), pose = CAMS[k.i].cam(f, n);
    return {i: k.i, id: k.e.id, f, n, pose, focus: k.e.focus(f), h: k.e.h, axis: k.e.axis, kind: bandOf(k.e.fr), ang: k.e.ang, g, zone: k.e.zone};
  });
}
void Person; void DOORMAN_P; void doorAt; void doorHandleS; void DOOR_SC; void CH; void cutT; void CAIO_T;
