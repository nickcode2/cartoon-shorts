// AIRPLANE_WINDOWS: 2220 frames at 30 fps (74.0 s). Audio: public/mix_airplane.mp3 (Silent variant has none).
// Timing is measured on the TRIMMED voice (original minus 1.80 s). Plan rows (narration -> target, shot type, move, angle) are checked by checkPlan.
// Cast: Sun = woman passenger + investigator (coat), Universe = the man beside her, extras = plain white (engineers, 1950s passengers).
import React, {useLayoutEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, Audio, staticFile, useDelayRender} from 'remotion';
import {Bloom, EffectComposer, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {CamFn, Pose, ShotSpec, SingleCanvasVideo, V3, clamp01, lerp} from '../kit/kit';
import {GlowCharacter, Outfit, useGlowTextures} from '../kit/glowChar';
import {EXPR, ManPose, mixExpr} from '../kit/hoodieMan';
import {flapFromSeries, idle, sit} from '../kit/motion';
import {assertLegsClear} from '../kit/collide';
import {listener, nod as nodAt, smile} from '../kit/reactions';
import {Label3D} from '../kit/Label3D';
import {DOF_ENABLED, FocusDof} from '../kit/Dof';
import {FREDOKA, waitForFredoka} from '../kit/PopLabel';
import {Focal, PlanRow, Target, checkPlan, closeUp, eased, focalInSafe, frameFocal, frameTargets, pullOut, pushIn, travelTo, truck} from '../kit/camera';
import {Glow, PAL} from '../kit/finish';
import {Cabin, COMET, Cutaway, Hangar, MODERN, PaneStack, Stage, StressPlate, winZ} from './scenes';
import {MODERN_WIN} from './parts';
import {SEAT_CARD_DZ, SEAT_TOP, SEAT_ZONE} from './seat';
import {Aircraft, SkySet} from './aircraft';
import {VOICE_SERIES} from './voiceSeries';

export const AP_FPS = 30;
export const AP_FRAMES = 2220;
const ease = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const S = 0.84; // card scale

// ================================================================= timeline state (absolute frames)
const FUSE_UP = 4.7, FUSE_SUNK = 1.05, FUSE_OUT = 2.95;
const fuseY = (f: number) => {
  if (f < 653) return FUSE_UP + 0.04 * Math.sin(f * 0.07);
  if (f < 868) return lerp(FUSE_UP, FUSE_SUNK, ease((f - 653) / 54));
  return lerp(FUSE_SUNK, FUSE_OUT, ease((f - 868) / 38));
};
const swellAt = (f: number) => {
  if (f >= 722 && f < 770) return ease((f - 722) / 36); // pressurize like a balloon
  if (f >= 770 && f < 792) return 1 - ease((f - 770) / 22); // release
  if (f >= 813 && f < 862) return 0.5 - 0.5 * Math.cos((2 * Math.PI * (f - 813)) / 16); // again and again
  return 0;
};
const crackAt = (f: number) => ease((f - 906) / 56);
const blueprintAt = (f: number) => ease((f - 1170) / 55);
const sunBreak = (f: number) => clamp01((f - 98) / 130);

// ================================================================= cast
const camRight: V3 = [1, 0, 0];
const SUN_M: V3 = [MODERN.seatX[0], 0, SEAT_CARD_DZ], UNI_M: V3 = [MODERN.seatX[1], 0, SEAT_CARD_DZ]; // cards stand in front of the cushion (SEAT_CARD_DZ)
const SUN_H: V3 = [-2.6, 0, 2.4];
const E1: V3 = [-9.1, 0, 0.5], E2: V3 = [-7.9, 0, 0.5], E3: V3 = [3.8, 0, 1.2];
const ptsC: [V3, Outfit, number][] = [
  [[COMET.seatX[0], 0, SEAT_CARD_DZ], 'suitA', -0.9], [[COMET.seatX[1], 0, SEAT_CARD_DZ], 'dressB', -0.7],
  [[COMET.seatX[0], 0, COMET.rows[1] + SEAT_CARD_DZ], 'dressB', 0.2], [[COMET.seatX[0], 0, COMET.rows[2] + SEAT_CARD_DZ], 'suitA', -0.3], [[COMET.seatX[3], 0, COMET.rows[1] + SEAT_CARD_DZ], 'dressB', 0.4],
];

const base = (t: number, seed: number, o: Partial<ManPose> = {}): ManPose => ({t, expr: EXPR.neutral, ...idle(t, seed), blinkPhase: seed * 1.37 + 0.6, ...o});
/** Seated pose: standing pose fields (idle, face, turn) plus the sit() legs, knees, lap hands and hip drop. */
const seated = (t: number, seed: number, o: Partial<ManPose> = {}): ManPose => {
  const sp = sit({seatTop: SEAT_TOP, scale: S, t, seed});
  const b = base(t, seed, o);
  return {...b, feet: sp.feet, knees: sp.knees, hands: sp.hands ?? b.hands, body: {dx: b.body?.dx ?? 0, dy: (sp.body?.dy ?? 0) + (b.body?.dy ?? 0), lean: b.body?.lean ?? 0}};
};
const speakIn = (f: number, a: number, b: number) => (f >= a && f <= b ? flapFromSeries(VOICE_SERIES, f) : 0);

function sunPose(f: number, role: 'pax' | 'inv'): ManPose {
  const t = f / AP_FPS;
  if (role === 'inv') {
    const surprised = ease((f - 504) / 8) * (1 - ease((f - 534) / 14));
    return base(t, 0, {expr: mixExpr(EXPR.neutral, EXPR.surprised, 0.85 * surprised), turn: f < 538 ? 0.1 : 0.7, nod: 4 * ease((f - 548) / 20)});
  }
  if (f < 1467) return seated(t, 0, {turn: -0.9, nod: f >= 1384 ? nodAt(t, 1394 / 30, 12, 1.1) : 0, expr: f >= 1384 ? mixExpr(EXPR.neutral, EXPR.angry, 0.12) : EXPR.neutral});
  const talking = f >= 1467 && f <= 1566;
  const toward = ease((f - 1574) / 14);
  const turn = f < 1574 ? lerp(-0.5, -0.9, ease((f - 1467) / 20)) : lerp(-0.9, 0.8, toward);
  const exp = f < 1574 ? mixExpr(EXPR.neutral, EXPR.angry, 0.22 * ease((f - 1480) / 20)) : smile(ease((f - 1650) / 15));
  return seated(t, 0, {turn, expr: talking ? exp : exp, speak: speakIn(f, 1467, 1566), headRoll: 0});
}
function uniPose(f: number): ManPose {
  const t = f / AP_FPS;
  if (f < 1384) return seated(t, 1, {turn: -0.8});
  const l = listener(t, {speaker: [SUN_M[0], 0, 0], self: UNI_M, camRight, from: 1470 / 30, to: 2200 / 30, nods: [1596 / 30, 1690 / 30], smileAt: 1585 / 30, index: 1});
  const id = idle(t, 1);
  const talking = f >= 1622 && f <= 1676;
  const sp = sit({seatTop: SEAT_TOP, scale: S, t, seed: 1});
  return {t, expr: l.expr!, turn: (l.turn ?? 0) * 0.85, nod: l.nod, headRoll: (l.headRoll ?? 0) + (id.headRoll ?? 0), body: {dx: id.body?.dx ?? 0, dy: (sp.body?.dy ?? 0) + (id.body?.dy ?? 0), lean: id.body?.lean ?? 0}, feet: sp.feet, knees: sp.knees, hands: sp.hands, blinkPhase: 3.1, speak: talking ? speakIn(f, 1622, 1676) : 0};
}

// ================================================================= camera helpers
const FT = (tg: Target[], yaw: number, pitch = 6, margin = 0.12, fov = 50): Pose => frameTargets(tg, {yaw, pitch, margin, fov});
const endOf = (c: CamFn): Pose => c(1, 0);
/** Focal point of a beat at progress u (null = the camera is mid-travel between two subjects, nothing to check). */
type FocalAt = Focal | ((u: number) => Focal | null);
const warnFrame = (label: string, cam: CamFn, fa: FocalAt, frames: number) => {
  for (const u of [0, 0.5, 1]) {
    const fo = typeof fa === 'function' ? fa(u) : fa;
    if (fo && !focalInSafe(cam(u, (u * frames) / AP_FPS), fo)) console.warn(`[focal-check] ${label}: focal point leaves the safe zone at u=${u}`);
  }
};
/** Frame a focal point: tight, the rest of the object may be cropped. */
const FF = (p: V3, r: number, yaw: number, pitch = 6, span = 0.5, fov = 50): Pose => frameFocal({p, r}, {yaw, pitch, span, fov});

// targets
const T_PLANE: Target = {p: [0, 0, 0], half: [3.0, 0.8, 3.3], name: 'Comet'};
const T_PLANE_BREAK: Target = {p: [-0.6, -0.4, 0], half: [3.0, 1.0, 2.8], name: 'breaking Comet'};
const T_SUN_M: Target = {p: [SUN_M[0], 0.95, 0], half: [0.42, 0.85, 0.2], name: 'Sun'};
const T_UNI_M: Target = {p: [UNI_M[0], 0.95, 0], half: [0.42, 0.85, 0.2], name: 'Universe'};
const T_WIN_M0: Target = {p: [MODERN.wallX, MODERN.winY, winZ(MODERN, 0)], half: [0.08, 0.3, 0.22], name: 'small window'};
const T_HOLE: Target = {p: [MODERN.wallX - 0.03, MODERN.winY, winZ(MODERN, 0)], half: [0.05, 0.27, 0.2], name: 'breather hole in its window'};
const T_WALL_M: Target = {p: [MODERN.wallX, MODERN.winY, 0.8], half: [0.1, 0.45, 0.65], name: 'window row'};
const T_PAX: Target = {p: [(COMET.seatX[0] + COMET.seatX[1]) / 2, 1.0, 0], half: [0.8, 0.85, 0.25], name: 'passengers'};
const T_COMET_ROW: Target = {p: [COMET.wallX, COMET.winY, 1.1], half: [0.1, 0.4, 0.75], name: 'big windows'};
const T_COMET_WIDE: Target = {p: [-0.9, 1.3, -0.5], half: [1.6, 1.0, 2.6], name: 'Comet cabin'};
const T_SUN_H: Target = {p: [SUN_H[0], 1.0, SUN_H[2]], half: [0.42, 0.85, 0.2], name: 'Sun, investigator'};
const T_TANK_HIGH: Target = {p: [0, 4.0, -3], half: [2.8, 1.8, 1.2], name: 'hoisted fuselage'};
const T_FUSE_HI: Target = {p: [0, 3.9, -3], half: [2.7, 1.2, 1.0], name: 'fuselage'};
const T_FUSE_LO: Target = {p: [0, 2.3, -3], half: [2.7, 1.2, 1.0], name: 'fuselage'};
const T_FUSE_SUNK: Target = {p: [0, 1.3, -3], half: [2.7, 1.2, 1.1], name: 'pressurized fuselage'};
const T_TANK_ALL: Target = {p: [0, 2.2, -3], half: [2.8, 2.0, 1.2], name: 'tank and fuselage'};
const T_CRACK: Target = {p: [-0.22, 3.42, -2.2], half: [0.14, 0.22, 0.06], name: 'window corner with crack'};
const T_WINROW_H: Target = {p: [0, 3.15, -2.3], half: [2.7, 0.9, 0.5], name: 'fuselage windows'};
const T_ENG: Target = {p: [0.3, -0.2, 1.1], half: [0.7, 0.35, 0.5], name: 'engine'};
const T_WING: Target = {p: [-0.6, -0.15, 2.4], half: [1.1, 0.3, 1.4], name: 'wing'};
const T_ENG_PAIR: Target[] = [T_ENG];
const T_ENGINEERS: Target = {p: [-8.5, 1.2, 0.5], half: [0.95, 0.8, 0.4], name: 'engineers'};
const T_BOARD: Target = {p: [-8.5, 0.9, 1.4], half: [0.75, 0.2, 0.42], name: 'blueprint board'};
const T_CUT: Target = {p: [0, 1.4, 0], half: [2.4, 1.1, 1.05], name: 'cabin swelling'};
const T_PLATE: Target = {p: [0, 1.1, 0], half: [0.95, 0.95, 0.2], name: 'plate'};
const T_CORNER: Target = {p: [-0.42, 1.52, 0.14], half: [0.28, 0.28, 0.1], name: 'sharp corner'};
const T_ROUND: Target = {p: [0, 1.1, 0.1], half: [0.5, 0.52, 0.1], name: 'rounded corner'};
const T_STACK: Target = {p: [0, 1.15, 0], half: [1.05, 0.95, 0.5], name: 'pane stack'};

// ================================================================= post
const RPost: React.FC<{pose: Pose; focal: Focal}> = ({pose, focal}) => {
  (window as unknown as {__pose?: Pose}).__pose = pose; // debug: current camera pose
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.8} />
      {DOF_ENABLED && !(window as unknown as {__noDof?: boolean}).__noDof ? <FocusDof pose={pose} focal={focal.p} r={focal.r} /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.32} darkness={0.4} />
    </EffectComposer>
  );
};

// ================================================================= scenes
interface Ctx {f: number; pose: Pose; ready: boolean; font: boolean; sf: number}
const Char: React.FC<{kind: 'sun' | 'universe' | 'white'; pose: ManPose; p: V3; ready: boolean; outfit?: Outfit}> = ({kind, pose, p, ready, outfit}) => (
  <GlowCharacter kind={kind} pose={pose} p={p} s={S} yawK={0.9} ready={ready} outfit={outfit} />
);

const ModernScene: React.FC<Ctx & {people?: boolean; hole?: number; labelHole?: boolean}> = ({f, pose, ready, font, sf, people = true, hole = 0, labelHole}) => (
  <Cabin era="modern" holeGlow={hole}>
    {people && <Char kind="sun" pose={sunPose(f, 'pax')} p={SUN_M} ready={ready} />}
    {people && <Char kind="universe" pose={uniPose(f)} p={UNI_M} ready={ready} />}
    {labelHole && <Label3D text="BREATHER HOLE" anchor={[MODERN.wallX + 0.02, MODERN.winY - 0.1, winZ(MODERN, 0)]} pose={pose} f={sf} start={24} ready={font} px={140} />}
  </Cabin>
);
const CometScene: React.FC<Ctx & {label?: boolean}> = ({f, pose, ready, font, sf, label}) => {
  const t = f / AP_FPS;
  return (
    <Cabin era="comet">
      {ptsC.map(([p, o, tn], i) => <Char key={i} kind="white" outfit={o} pose={seated(t, 3 + i, {turn: tn, expr: i < 2 ? mixExpr(EXPR.neutral, EXPR.smug, 0.4) : EXPR.neutral})} p={p} ready={ready} />)}
      {label && <Label3D text="1950s" anchor={[-1.0, 2.2, -1.2]} pose={pose} f={sf} start={6} hold={44} ready={font} px={150} />}
    </Cabin>
  );
};
const SkyScene: React.FC<{f: number; breakT: number; modern?: boolean; seed?: number; bank?: number; glows?: boolean}> = ({f, breakT, modern, seed = 0, bank = 0, glows}) => {
  const t = f / AP_FPS;
  return (
    <SkySet>
      <group rotation={[0.04 * Math.sin(t * 0.8), 0.03 * Math.sin(t * 0.5), bank + 0.03 * Math.sin(t * 0.7)]} position={[0, 0.06 * Math.sin(t), 0]}>
        <Aircraft breakT={breakT} modern={modern} seed={seed} />
        {glows && (
          <>
            <Glow p={[0.3, -0.2, 1.15]} size={1.8} color={PAL.glowWarm} intensity={ease((f - 974) / 8) * (1 - ease((f - 1000) / 10))} />
            <Glow p={[-0.6, -0.15, 2.4]} size={2.4} color={PAL.glowWarm} intensity={ease((f - 1003) / 8) * (1 - ease((f - 1030) / 10))} />
          </>
        )}
      </group>
    </SkySet>
  );
};
const HangarScene: React.FC<Ctx & {sun?: boolean; eng?: boolean}> = ({f, ready, sun, eng = true}) => {
  const t = f / AP_FPS;
  const e1 = base(t, 5, {turn: 0.8, nod: nodAt(t, 1105 / 30, 8, 0.6) + nodAt(t, 1135 / 30, 8, 0.6)});
  const e2 = base(t, 6, {turn: -0.8, nod: nodAt(t, 1118 / 30, 8, 0.6)});
  const e3 = base(t, 7, {turn: -0.4});
  return (
    <Hangar fuseY={fuseY(f)} swell={swellAt(f)} crack={crackAt(f)} t={t} blueprint={blueprintAt(f)}>
      {sun && <Char kind="sun" outfit="coat" pose={sunPose(f, 'inv')} p={SUN_H} ready={ready} />}
      {eng && <Char kind="white" outfit="engineer" pose={e1} p={E1} ready={ready} />}
      {eng && <Char kind="white" outfit="engineer" pose={e2} p={E2} ready={ready} />}
      <Char kind="white" outfit="engineer" pose={e3} p={E3} ready={ready} />
    </Hangar>
  );
};

// ================================================================= shot table (plan rows + camera + render, one place)
type Render = (c: Ctx) => React.ReactNode;
interface Def {
  fa: FocalAt;
  from: number; to: number; row: Omit<PlanRow, 'from' | 'to' | 'focal'>; focal: Focal; cam: CamFn; render: Render; dip?: boolean; dipColor?: string;
}
const row = (line: string, target: string, targets: Target[], shot: PlanRow['shot'], moveKind: PlanRow['moveKind'], move: PlanRow['move'], angle: string, why: string): Omit<PlanRow, 'from' | 'to' | 'focal'> => ({line, target, targets, shot, moveKind, move, angle, why});

// FOCAL POINT of every plan row (rule "FOCAL POINT v8"): the camera keeps it inside the safe zone; the rest of the object may be cropped.
const NOSE: V3 = [3.3, 0, 0], BREAK: V3 = [-2.5, 0, 0];
const CRACK_P: V3 = [-0.3, 3.4, -2.2], BOARD_P: V3 = [-8.62, 0.9, 1.4];
const HOLE_P: V3 = [MODERN.wallX - 0.06, MODERN.winY - MODERN_WIN.h / 2 + 0.07, winZ(MODERN, 0)];
const WIN_P: V3 = [MODERN.wallX, MODERN.winY, winZ(MODERN, 0)];
const fo = (p: V3, r = 0.4, name?: string): Focal => ({p, r, name});
const FOCAL: Record<string, FocalAt> = {
  'They made airplane windows smaller': (u) => (u < 0.3 ? fo(WIN_P, 0.3, 'small window') : u > 0.8 ? fo([SUN_M[0], 1.32, 0], 0.5, 'Sun') : null),
  '...on purpose, right after planes started falling apart in the sky': fo(BREAK, 1.8, 'tail break'),
  "It's the 1950s": fo([COMET.seatX[0], 1.32, 0], 0.6, 'passenger by a big window'),
  'The Comet, the first jet airliner': fo(NOSE, 1.2, 'nose'),
  '...has big, elegant windows': (u) => fo([COMET.wallX, COMET.winY, lerp(1.1, -1.3, ease(u))], 0.5, 'big window'),
  'Passengers love it': fo([-1.34, 1.3, 0], 0.7, 'faces'),
  'Then one breaks apart mid-flight': fo(BREAK, 1.8, 'tail break'),
  'Then another': fo(BREAK, 1.8, 'tail break'),
  'Wait, what?': fo([SUN_H[0], 1.32, SUN_H[2]], 0.5, 'Sun face'),
  'Nobody can explain it': fo([SUN_H[0], 1.32, SUN_H[2]], 0.5, 'Sun face'),
  'So investigators take a whole plane': fo([0, 4.5, -3], 1.2, 'hoisted fuselage'),
  '...sink it in a giant water tank': (u) => fo([0, lerp(4.0, 1.5, u), -3], 1.2, 'sinking fuselage'),
  '...and pressurize it like a balloon': fo([0, 1.2, -3], 1.4, 'swelling hull'),
  'Then release it': fo([0, 1.3, -3], 1.4, 'hull'),
  'Again and again, thousands of times': fo([0, 2.0, -3], 1.5, 'hull'),
  'Until one day, a crack appears': fo(CRACK_P, 0.15, 'crack'),
  'Not in the engine. Not in the wings.': (u) => (u < 0.4 ? fo([0.3, -0.2, 1.1], 0.8, 'engine') : u > 0.6 ? fo([-0.6, -0.15, 2.4], 1.0, 'wing') : null),
  'At the corner of a window': fo(CRACK_P, 0.15, 'crack'),
  'So engineers redesign everything': fo([-8.5, 1.35, 0.5], 0.9, 'engineers'),
  'Rounder corners. Smaller windows.': (u) => (u < 0.3 ? null : fo(BOARD_P, 0.45, 'circled corner')),
  'And a tiny hole at the bottom of every pane': fo(HOLE_P, 0.12, 'breather hole'),
  "...which looks like a mistake, but isn't": (u) => (u < 0.2 ? fo(HOLE_P, 0.12, 'breather hole') : u > 0.8 ? fo(WIN_P, 0.4, 'window') : null),
  'Years later, a woman on a plane sighs': fo([-0.96, 1.32, 0], 0.9, 'both faces'),
  '"Why are these windows so tiny? I paid for this view."': fo([SUN_M[0], 1.32, 0], 0.5, 'Sun face'),
  'The man beside her smiles. "Trust me. You\'re lucky they are."': (u) => (u < 0.6 ? fo([UNI_M[0], 1.32, 0], 0.5, 'Universe face') : fo([-0.96, 1.32, 0], 0.9, 'both faces')),
  'You see, every flight, the cabin swells like a balloon': fo([0, 1.4, 0], 1.3, 'swelling cabin'),
  'A sharp corner is where all that stress piles up': fo([-0.42, 1.52, 0.14], 0.2, 'sharp corner'),
  'A rounded one spreads it out': fo([-0.3, 1.46, 0.15], 0.3, 'rounded corner'),
  'And that little hole makes the outer pane carry the pressure': (u) => fo([lerp(0, 0.75, u), lerp(0.71, 1.15, u), 0], 0.4, 'hole to outer pane'),
  '...so the inner ones stay protected': fo([-0.75, 1.15, 0], 0.45, 'inner pane'),
  "The small window isn't a cheap trick": fo([-0.96, 1.32, 0], 0.9, 'both faces'),
  "It's the reason the plane stays in one piece": fo(NOSE, 1.5, 'nose'),
};

function buildDefs(): Def[] {
  const defs: Def[] = [];
  // sitting keep-out check (rule v8): no knee or foot of a seated card may be inside its seat, at any card yaw up to 0.8 rad
  const seatZone = (x: number, z: number) => ({kind: 'box' as const, name: 'seat', c: [x + SEAT_ZONE.c[0], z + SEAT_ZONE.c[1]] as [number, number], half: SEAT_ZONE.half});
  const sp0 = sit({seatTop: SEAT_TOP, scale: S});
  assertLegsClear('Sun', sp0, SUN_M, S, seatZone(MODERN.seatX[0], 0), SEAT_TOP);
  assertLegsClear('Universe', sp0, UNI_M, S, seatZone(MODERN.seatX[1], 0), SEAT_TOP);
  ptsC.forEach(([p], i) => assertLegsClear('passenger ' + i, sp0, p, S, seatZone(p[0], p[2] - SEAT_CARD_DZ), SEAT_TOP));
  const add = (from: number, to: number, r: Omit<PlanRow, 'from' | 'to' | 'focal'>, cam: CamFn, render: Render, dip?: string) => {
    const fa = FOCAL[r.line];
    if (!fa) throw new Error(`[plan] no focal point declared for: "${r.line}"`);
    const first = typeof fa === 'function' ? fa(0) ?? fa(1) : fa;
    defs.push({fa, from, to, row: r, focal: first!, cam, render, dip: !!dip, dipColor: dip});
    warnFrame(r.line, cam, fa, to - from);
  };
  const INDIGO = '#1E1448', LAV = '#DCDDF3';

  // ---- 1 hook: small window, pull to Sun beside it
  {
    const a = FT([T_WIN_M0], 80, 3, 0.3, 56), b = FT([T_SUN_M, T_WIN_M0], 10, 6, 0.1, 56);
    add(0, 64, row('They made airplane windows smaller', 'small modern window, then Sun beside it', [T_WIN_M0, T_SUN_M], 'insert', 'pull', 'pull-out', 'front, level', 'open on the object of the title, then reveal who is looking through it'),
      travelTo(a, b, {center: [-1.3, 1.2, 0.4], arc: 8, rise: 0.1}), (c) => <ModernScene {...c} />);
  }
  // ---- 2 planes falling apart (sky)
  {
    const cam = travelTo(FF(BREAK, 2.0, 30, -10), FF(BREAK, 2.0, -25, -10), {center: BREAK});
    add(64, 176, row('...on purpose, right after planes started falling apart in the sky', 'Comet in the sky', [T_PLANE_BREAK], 'wide', 'orbit', 'orbit', 'low, from below', 'a large flying thing stays wide; the orbit shows the tail start to go'),
      cam, (c) => <SkyScene f={c.f} breakT={sunBreak(c.f)} />, INDIGO);
  }
  // ---- 3 1950s cabin
  {
    const cam = truck({p: [0.9, 1.6, 7.6], l: [-1.0, 1.25, -2.0], fov: 66}, -0.9, 0);
    add(176, 226, row("It's the 1950s", 'Comet cabin with big square windows', [T_COMET_WIDE], 'wide', 'follow', 'truck', 'front, along the aisle', 'establish the era and the room; truck gives depth'),
      cam, (c) => <CometScene {...c} label />, INDIGO);
  }
  // ---- 4 Comet exterior
  {
    const cam = eased(FF(NOSE, 1.3, -40, 18), FT([T_PLANE], -40, 18, 0.05));
    add(226, 298, row('The Comet, the first jet airliner', 'Comet exterior', [T_PLANE], 'wide', 'pull', 'pull-out', '3/4 front, high', 'reveal the whole aircraft with sky around it'),
      cam, (c) => <SkyScene f={c.f} breakT={0} bank={-0.12} />, INDIGO);
  }
  // ---- 5 big elegant windows
  {
    const cam = truck(FT([T_COMET_ROW], 80, 4, 0.1, 56), 0, -2.4);
    add(298, 354, row('...has big, elegant windows', 'row of big windows', [T_COMET_ROW], 'medium', 'follow', 'truck', 'side, low', 'travel along the wall so the size of the windows reads'),
      cam, (c) => <CometScene {...c} />, INDIGO);
  }
  // ---- 6 passengers love it
  {
    const cam = pushIn(FT([T_PAX], 14, 4, 0.2, 56), 0.18);
    add(354, 398, row('Passengers love it', '1950s passengers', [T_PAX], 'medium', 'push', 'push-in', 'front, low', 'emphasise the happy faces'),
      cam, (c) => <CometScene {...c} />);
  }
  // ---- 7 first break-up
  {
    const cam = travelTo(FF(BREAK, 2.2, -90, 20), FF(BREAK, 2.2, -60, 20), {center: BREAK});
    add(398, 468, row('Then one breaks apart mid-flight', 'Comet breaking up', [T_PLANE_BREAK], 'wide', 'orbit', 'orbit', 'behind, high', 'from behind we see the tail tear away; wide so the viewer follows the pieces'),
      cam, (c) => <SkyScene f={c.f} breakT={clamp01((c.f - 402) / 60)} />, INDIGO);
  }
  // ---- 8 another
  {
    const cam = truck(FF(BREAK, 2.2, 90, 5), 0, 0.5);
    add(468, 502, row('Then another', 'second Comet breaking up', [T_PLANE_BREAK], 'wide', 'follow', 'truck', 'side, level', 'a new angle says it happened again'),
      cam, (c) => <SkyScene f={c.f} breakT={0.15 + 0.7 * clamp01((c.f - 470) / 32)} seed={1} />);
  }
  // ---- 9-10 Sun the investigator
  const P9a = FT([T_SUN_H], 12, 2, 0.28), P9b = pushIn(P9a, 0.2)(1, 0), P10b = FT([T_SUN_H], -35, 4, 0.28);
  add(502, 538, row('Wait, what?', 'Sun, investigator', [T_SUN_H], 'medium', 'push', 'push-in', 'front', 'react with her: push in on the surprised face'),
    eased(P9a, P9b), (c) => <HangarScene {...c} sun eng={false} />, INDIGO);
  add(538, 587, row('Nobody can explain it', 'Sun, investigator', [T_SUN_H], 'medium', 'orbit', 'orbit', 'over-shoulder, drifting to side', 'slow orbit while she thinks'),
    travelTo(P9b, P10b, {center: [SUN_H[0], 1, SUN_H[2]]}), (c) => <HangarScene {...c} sun eng={false} />);
  // ---- 11-15 tank sequence: one continuous camera path through the same set
  const P11b = FT([T_TANK_HIGH], 8, 10, 0.05, 64), P12a = FT([T_FUSE_HI], 20, 26, 0.1, 64), P12b = FT([T_FUSE_LO], -15, 24, 0.1, 64);
  const P13b = FT([T_FUSE_SUNK], -12, 24, 0.12, 64), P14b = truck(FT([T_FUSE_SUNK], -6, 22, 0.12, 64), 0.7, 0)(1, 0), P15b = pushIn(FT([T_TANK_ALL], 0, 20, 0.15, 64), 0.15)(1, 0);
  add(587, 651, row('So investigators take a whole plane', 'fuselage hanging from the crane', [T_TANK_HIGH], 'wide', 'pull', 'pull-out', 'high front', 'pull back from the investigators to reveal the plane and the tank'),
    eased(FT([{...T_TANK_HIGH, half: [2.2, 1.4, 1.0]}], 8, 10, 0.1, 64), P11b), (c) => <HangarScene {...c} sun eng={false} />);
  add(651, 712, row('...sink it in a giant water tank', 'tank and sinking fuselage', [T_FUSE_HI, T_FUSE_LO], 'wide', 'follow', 'follow', 'side, high to low', 'camera descends with the fuselage so we see it go under'),
    travelTo(P12a, P12b, {center: [0, 2.5, -3]}), (c) => <HangarScene {...c} />);
  add(712, 768, row('...and pressurize it like a balloon', 'swelling fuselage', [T_FUSE_SUNK], 'wide', 'orbit', 'orbit', '3/4 orbit', 'orbit to show the hull swell from several sides'),
    travelTo(P12b, P13b, {center: [0, 1.2, -3]}), (c) => <HangarScene {...c} />);
  add(768, 811, row('Then release it', 'deflating fuselage', [T_FUSE_SUNK], 'wide', 'follow', 'truck', 'side', 'lateral move while the hull sags back'),
    eased(P13b, P14b), (c) => <HangarScene {...c} />);
  add(811, 902, row('Again and again, thousands of times', 'fuselage cycling', [T_TANK_ALL], 'wide', 'push', 'push-in', 'front, low', 'slow push-in while the pulses repeat; ends as the hull is lifted out'),
    eased(P14b, P15b), (c) => <HangarScene {...c} />);
  // 16 crack: continuous travel from the tank shot to the window corner
  {
    const total = 972 - 902;
    const cu = closeUp(T_CRACK, {from: P15b, focal: fo(CRACK_P, 0.12), span: 0.55, duration: 40, hold: total - 40, arc: 28, rise: 0.2, yaw: -28, pitch: 10});
    console.info('[closeUp] crack fill', cu.fill.toFixed(2), 'inSafe', cu.inSafe);
    add(902, 972, row('Until one day, a crack appears', 'window corner, crack growing', [T_CRACK], 'close', 'travel', 'travel', 'front to 3/4 left, arc', 'continuous travel into the corner where the crack starts'),
      cu.cam, (c) => <HangarScene {...c} />);
  }
  // 17 engine, wings (sky)
  {
    const a = FF([0.3, -0.2, 1.1], 0.8, 70, 12), b = FF([-0.6, -0.15, 2.4], 1.0, 70, 12);
    add(972, 1041, row('Not in the engine. Not in the wings.', 'engine, then wing', [T_ENG, T_WING], 'medium', 'follow', 'truck', 'side', 'move from the engine to the wing as each is named; both highlighted'),
      travelTo(a, b, {center: [0, 0, 1.5], arc: 6}), (c) => <SkyScene f={c.f} breakT={0} glows bank={0} />, INDIGO);
  }
  // 18 corner again from the other side
  {
    const from = FT([T_WINROW_H], 0, 10, 0.15, 60);
    const total = 1096 - 1041;
    const cu = closeUp(T_CRACK, {from, focal: fo(CRACK_P, 0.12), span: 0.55, duration: 30, hold: total - 30, arc: -24, rise: 0.12, yaw: 32, pitch: 8});
    add(1041, 1096, row('At the corner of a window', 'cracked window corner', [T_CRACK], 'close', 'travel', 'travel', 'right 3/4, reverse arc', 'return to the corner from the opposite side'),
      cu.cam, (c) => <HangarScene {...c} />, INDIGO);
  }
  // 19-20 engineers and the blueprint
  const P19a = FT([T_ENGINEERS], 15, 4, 0.12, 60), P19b = FT([T_ENGINEERS], -20, 4, 0.12, 60);
  add(1096, 1166, row('So engineers redesign everything', 'white engineers at the drafting board', [T_ENGINEERS], 'medium', 'orbit', 'orbit', 'front, drifting left', 'orbit the team to show who does the redesign'),
    travelTo(P19a, P19b, {center: [-8.45, 1, 1.8]}), (c) => <HangarScene {...c} />, INDIGO);
  {
    const total = 1232 - 1166;
    const cu = closeUp(T_BOARD, {from: P19b, focal: fo(BOARD_P, 0.4), span: 0.6, duration: 36, hold: total - 36, arc: 14, rise: 0.1, yaw: 6, pitch: 40});
    console.info('[closeUp] blueprint fill', cu.fill.toFixed(2), 'inSafe', cu.inSafe);
    add(1166, 1232, row('Rounder corners. Smaller windows.', 'blueprint board', [T_BOARD], 'insert', 'travel', 'travel', 'high, looking down', 'travel onto the board where the square windows turn round and shrink'),
      cu.cam, (c) => <HangarScene {...c} />);
  }
  // 21-22 modern window and the breather hole
  let P21e: Pose;
  {
    const total = 1314 - 1232;
    const from = FT([T_WALL_M], 75, 4, 0.1, 56);
    const cu = closeUp(T_HOLE, {from, focal: fo(HOLE_P, 0.1), span: 0.5, duration: 40, hold: total - 40, arc: 20, rise: 0.05, yaw: 84, pitch: 3, center: HOLE_P});
    P21e = cu.endPose;
    console.info('[closeUp] hole fill', cu.fill.toFixed(2), 'inSafe', cu.inSafe);
    add(1232, 1314, row('And a tiny hole at the bottom of every pane', 'breather hole in the middle pane', [T_HOLE], 'close', 'travel', 'travel', 'side, arc up', 'travel from the window row into the hole; label names it'),
      cu.cam, (c) => <ModernScene {...c} people={false} hole={ease((c.f - 1262) / 20)} labelHole />, INDIGO);
  }
  add(1314, 1384, row('...which looks like a mistake, but isn\'t', 'whole window wall', [T_WALL_M], 'medium', 'pull', 'pull-out', 'side', 'pull back to see the hole is one tiny detail in a normal window'),
    eased(P21e, FT([T_WALL_M], 75, 4, 0.1, 56)), (c) => <ModernScene {...c} people={false} hole={1 - ease((c.f - 1330) / 30)} />);
  // 23-25 the woman and the man
  add(1384, 1467, row('Years later, a woman on a plane sighs', 'Sun and Universe in the modern cabin', [T_SUN_M, T_UNI_M], 'medium', 'follow', 'truck', 'front-left', 'two-shot introduces both; a lateral move shows the window beside her'),
    truck(FT([T_SUN_M, T_UNI_M], 10, 5, 0.2, 56), 0.2, 0), (c) => <ModernScene {...c} />, LAV);
  add(1467, 1572, row('"Why are these windows so tiny? I paid for this view."', 'Sun speaking', [T_SUN_M], 'medium', 'push', 'push-in', 'front-right 3/4, low', 'push in on her complaint'),
    pushIn(FT([T_SUN_M], 26, 3, 0.22, 56), 0.22), (c) => <ModernScene {...c} />);
  add(1572, 1681, row('The man beside her smiles. "Trust me. You\'re lucky they are."', 'Universe, then both', [T_UNI_M, T_SUN_M], 'medium', 'push', 'push-in', 'front, level', 'start on his smile, widen to both as he answers'),
    eased(FT([T_UNI_M], -5, 3, 0.22, 56), FT([T_SUN_M, T_UNI_M], 8, 4, 0.12, 56)), (c) => <ModernScene {...c} />);
  // 26 cutaway swell
  add(1681, 1788, row('You see, every flight, the cabin swells like a balloon', 'cabin cutaway swelling', [T_CUT], 'wide', 'orbit', 'orbit', 'high 3/4', 'wide orbit so the whole hull is seen swelling'),
    travelTo(FT([T_CUT], 20, 22, 0.03, 70), FT([T_CUT], -25, 22, 0.03, 70), {center: [0, 1.4, 0]}), (c) => <Stage><Cutaway swell={ease((c.f - 1692) / 78)} /></Stage>, INDIGO);
  // 27-28 corners
  {
    const total = 1873 - 1788;
    const cu = closeUp(T_CORNER, {from: FT([T_PLATE], 10, 4, 0.15, 56), focal: fo([-0.42, 1.52, 0.14], 0.17), span: 0.55, duration: 40, hold: total - 40, arc: 18, rise: 0.08, yaw: -25, pitch: 6});
    console.info('[closeUp] corner fill', cu.fill.toFixed(2), 'inSafe', cu.inSafe);
    add(1788, 1873, row('A sharp corner is where all that stress piles up', 'sharp window corner with stress', [T_CORNER], 'close', 'travel', 'travel', 'front to left 3/4', 'travel into the corner while the stress glows'),
      cu.cam, (c) => <Stage><StressPlate kind="square" heat={ease((c.f - 1796) / 60)} /></Stage>, INDIGO);
  }
  add(1873, 1927, row('A rounded one spreads it out', 'rounded corner with spread stress', [T_ROUND], 'close', 'orbit', 'orbit', 'side, arcing right', 'orbit the round opening so the even glow reads'),
    travelTo(FF([-0.3, 1.46, 0.15], 0.28, -30, 6, 0.55, 56), FF([-0.3, 1.46, 0.15], 0.28, 22, 6, 0.55, 56), {center: [-0.3, 1.46, 0.15]}), (c) => <Stage><StressPlate kind="round" heat={ease((c.f - 1878) / 40)} /></Stage>, INDIGO);
  // 29-30 pane stack
  const P29a = FT([{...T_STACK, p: [-0.9, 1.15, 0], half: [0.8, 0.95, 0.5]}], 0, 4, 0.1, 62), P29b = FT([{...T_STACK, p: [0.1, 1.15, 0], half: [0.8, 0.95, 0.5]}], 0, 4, 0.1, 62);
  add(1927, 2017, row('And that little hole makes the outer pane carry the pressure', 'pane stack cutaway', [T_STACK], 'insert', 'travel', 'travel', 'side cut', 'travel across the stack following the air through the hole to the outer pane'),
    eased(P29a, P29b), (c) => <Stage><PaneStack flow={ease((c.f - 1945) / 20)} load={ease((c.f - 1978) / 30)} t={c.f / AP_FPS} /></Stage>, INDIGO);
  add(2017, 2073, row('...so the inner ones stay protected', 'inner panes', [T_STACK], 'insert', 'push', 'push-in', 'side cut, 3/4', 'push toward the inner panes that stay calm'),
    eased(P29b, FT([{...T_STACK, p: [-0.5, 1.15, 0], half: [0.7, 0.9, 0.5]}], 18, 5, 0.12, 62)), (c) => <Stage><PaneStack flow={1} load={1} t={c.f / AP_FPS} /></Stage>);
  // 31 payoff in the cabin
  add(2073, 2138, row("The small window isn't a cheap trick", 'Sun and Universe', [T_SUN_M, T_UNI_M], 'medium', 'pull', 'pull-out', 'front, low', 'pull back from the two of them, relaxed and smiling'),
    pullOut(FT([T_SUN_M, T_UNI_M], 8, -4, 0.14, 56), 0.3), (c) => <ModernScene {...c} />, LAV);
  // 32 whole plane
  add(2138, 2220, row("It's the reason the plane stays in one piece", 'whole modern airliner', [T_PLANE], 'wide', 'pull', 'pull-out', '3/4 front, high', 'end wide on the intact plane'),
    pullOut(FT([T_PLANE], -40, 18, 0.05), 0.35), (c) => <SkyScene f={c.f} breakT={0} modern bank={-0.08} />, INDIGO);
  return defs;
}

// ================================================================= composition
const Video: React.FC = () => {
  const ready = useGlowTextures();
  const [font, setFont] = useState(false);
  const {delayRender, continueRender} = useDelayRender();
  useLayoutEffect(() => {
    const h = delayRender('Fredoka font', {timeoutInMilliseconds: 15000});
    waitForFredoka().then(() => document.fonts.load(`700 100px ${FREDOKA}`)).catch(() => undefined).then(() => { setFont(true); continueRender(h); });
  }, [delayRender, continueRender]);
  const shots: ShotSpec[] = useMemo(() => {
    const defs = buildDefs();
    checkPlan(defs.map((d) => ({...d.row, focal: d.focal, from: d.from, to: d.to})));
    return defs.map((d) => ({
      from: d.from, to: d.to, light: 'dark' as const, ownLights: true, cam: d.cam,
      dip: d.dip ? {frames: 6, color: d.dipColor} : undefined,
      post: (frame: number, pose: Pose) => {
        const u = clamp01((frame - d.from) / Math.max(1, d.to - d.from));
        const fa = d.fa, fo = typeof fa === 'function' ? fa(u) ?? fa(u < 0.5 ? 0 : 1) ?? d.focal : fa; // mid-travel (null): hold the nearest end's focal point
        return <RPost pose={pose} focal={fo} />;
      },
      render: (t: number, u: number, absT: number) => {
        const f = Math.round(absT * AP_FPS);
        return d.render({f, pose: d.cam(u, t), ready, font, sf: f - d.from});
      },
    }));
  }, [ready, font]);
  return <SingleCanvasVideo shots={shots} fps={AP_FPS} />;
};

export const AirplaneWindows: React.FC<{audio?: boolean}> = ({audio = true}) => (
  <AbsoluteFill style={{background: '#000'}}>
    <Video />
    {audio && <Audio src={staticFile('mix_airplane.mp3')} />}
  </AbsoluteFill>
);
