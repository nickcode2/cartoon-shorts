// Reactions between characters: head turns toward the other, small nods/tilts, soft smile, staggered blinks.
// Pure functions of time; add the returned fields to ManPose. Rules in STYLE_NOTES.md "ANIMATION v5".
import {EXPR, Expr, ManPose, mixExpr} from './hoodieMan';
import {V3, clamp01} from './kit';
import {easeInOut} from './motion';

/** Head turn toward another character, -1..1 for ManPose.turn. `selfFacing` = which way the card faces on screen (+1 = right).
 *  Computed from the card-space x of the other relative to self, so two characters side by side look AT each other. */
export function lookToward(self: V3, other: V3, camRight: V3 = [1, 0, 0], k = 1): number {
  const dx = (other[0] - self[0]) * camRight[0] + (other[2] - self[2]) * camRight[2];
  return Math.max(-1, Math.min(1, dx * 1.2)) * clamp01(k);
}
/** Ease the turn in over `dur` seconds from `start` (the speaker's first word: listeners react after the speaker, they do not anticipate). */
export const turnIn = (t: number, start: number, dur = 0.45) => easeInOut((t - start) / dur);

/** One small nod (px head dip) per call: bell-shaped over `dur`. Per the listener-timing references nods are DELAYED and fall at the
 *  speaker's pauses (phrase ends), so start them about 0.2 to 0.4 s after a phrase ends, not on stressed words. Sum calls for several nods. */
export function nod(t: number, start: number, amp = 10, dur = 0.5): number {
  const u = (t - start) / dur;
  return u <= 0 || u >= 1 ? 0 : amp * Math.sin(Math.PI * u) * (1 - 0.3 * u);
}
/** Gentle head tilt (degrees) toward the other speaker while listening. */
export const listenTilt = (t: number, from: number, to: number, side: 1 | -1 = 1, amp = 4): number => {
  const k = easeInOut((t - from) / 0.5) * (1 - easeInOut((t - to) / 0.5));
  return side * amp * k + side * 0.8 * k * Math.sin(t * 1.3);
};
/** Soft smile: neutral -> smug blended up to 0.55 (never the full smug smirk), k 0..1. */
export const smile = (k: number): Expr => mixExpr(EXPR.neutral, EXPR.smug, 0.55 * clamp01(k));
/** Blink clocks for N characters: staggered so they never blink together. Pass as ManPose.blinkPhase. */
export const blinkPhase = (index: number) => index * 1.37 + 0.6;

/** Listener reaction bundle: look at the speaker (starts with the first word), nods at the given times (speaker pauses), a soft smile that
 *  follows almost at once (mimicry is near-instant in the references), tilt while listening. */
export function listener(t: number, o: {speaker: V3; self: V3; camRight?: V3; from: number; to: number; nods?: number[]; smileAt?: number; index?: number}): Pick<ManPose, 'turn' | 'nod' | 'headRoll' | 'expr' | 'blinkPhase'> {
  const turn = lookToward(o.self, o.speaker, o.camRight, turnIn(t, o.from));
  const nd = (o.nods ?? []).reduce((a, s) => a + nod(t, s), 0);
  return {turn, nod: nd, headRoll: listenTilt(t, o.from, o.to), expr: smile(o.smileAt === undefined ? 0 : easeInOut((t - o.smileAt) / 0.25)), blinkPhase: blinkPhase(o.index ?? 0)};
}
