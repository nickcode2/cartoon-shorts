// BOUNCE ON ALL MOVEMENT (reference ref_bounce_*): every movement (walk, turn, reach, sit, stop) adds secondary motion to the TORSO card:
//  - vertical bob 16 % of the head width (peak to peak), squash / stretch +-4 % with the opposite scale on the other axis, rocking +-3-5 degrees,
//  - the head lags the torso by 2-3 frames (2.5),
//  - heavier bodies bounce slower (period x sqrt(mass)) and a bit more (amplitude x (1 + 0.2 (mass - 1))),
//  - a stop gets a small settle of 3 frames, no long wobble.
// The numbers 16 % and 5.8 frames come from the user's measured reference (STYLE_NOTES); +-4 %, 3-5 deg, 2-3 frames, the 3-frame settle are the brief's; the impulse shapes are ours (estimates, untested).
import type {Bounce} from './rickRig';
import {NO_BOUNCE} from './rickRig';

export type BounceKind = 'step' | 'turn' | 'reach' | 'sit' | 'stop' | 'start';
export interface BounceEvent { kind: BounceKind; f0: number; f1?: number; k?: number; dir?: 1 | -1 } // step needs f1; k = strength 0..1; dir = side of the rocking
export const BOUNCE = {BOB: 0.16, SQUASH: 0.04, ROCK_DEG: 4, HEAD_LAG: 2.5, STEP_FRAMES: 5.8, SETTLE: {stop: 3, turn: 4, reach: 4, sit: 5, start: 4}};
const ease = (x: number) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
const bump = (u: number) => (u < 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) * (1 - u)); // rises and settles to exactly 0 at u = 1

/** Torso motion at frame f: up = lift (px, + up), q = stretch (-1..1), rock (rad). */
function torso(events: BounceEvent[], f: number, headW: number, mass: number): {up: number; q: number; rock: number} {
  const amp = BOUNCE.BOB * headW * (1 + 0.2 * (mass - 1)), slow = Math.sqrt(mass), rockMax = ((BOUNCE.ROCK_DEG + 0.5 * (mass - 1)) * Math.PI) / 180;
  let up = 0, q = 0, rock = 0;
  for (const e of events) {
    const k = e.k ?? 1;
    if (e.kind === 'step') {
      const f1 = e.f1 ?? e.f0 + 1, P = BOUNCE.STEP_FRAMES * slow;
      if (f < e.f0 || f >= f1) continue;
      const fade = ease((f - e.f0) / (P / 2)) * ease((f1 - f) / (P / 2)), u = (f - e.f0) / P, w = Math.cos(2 * Math.PI * u) * fade; // one bob per step: peak to peak = amp
      up += (amp / 2) * w * k; q += w * k; rock += rockMax * Math.sin(Math.PI * u) * fade * k; // the rocking alternates every step
    } else {
      const Ts = BOUNCE.SETTLE[e.kind] * slow, b = bump((f - e.f0) / Ts) * k, d = e.dir ?? 1;
      if (e.kind === 'stop') { up -= 0.5 * amp * b; q -= b; } // the body dips and settles
      else if (e.kind === 'sit') { up -= 0.8 * amp * b; q -= b; rock += d * 0.5 * rockMax * b; }
      else if (e.kind === 'start') { up -= 0.3 * amp * b; q -= 0.6 * b; }
      else if (e.kind === 'turn') { up += 0.3 * amp * b; q += 0.5 * b; rock += d * rockMax * b; }
      else { up += 0.5 * amp * b; q += 0.8 * b; rock += d * 0.6 * rockMax * b; } // reach
    }
  }
  return {up, q: Math.max(-1, Math.min(1, q)), rock: Math.max(-rockMax * 1.1, Math.min(rockMax * 1.1, rock))};
}
/** The secondary motion of the torso card at frame f (feed it to RickPose.bounce). `headW` = head width in card px; `mass` 1 = normal, > 1 heavier. */
export function bounceAt(events: BounceEvent[], f: number, headW: number, mass = 1): Bounce {
  if (events.length === 0) return NO_BOUNCE;
  const t = torso(events, f, headW, mass), h = torso(events, f - BOUNCE.HEAD_LAG, headW, mass); // the head follows the same signal 2.5 frames later
  return {dy: -t.up, sx: 1 - BOUNCE.SQUASH * t.q, sy: 1 + BOUNCE.SQUASH * t.q, rock: t.rock, headDy: -h.up};
}
