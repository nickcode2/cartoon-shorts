// Reference motion constants, measured by the user from the reference animation at 30 fps, frame width 540 px (STYLE_NOTES "REFERENCE MOTION AND COLOR CONSTANTS").
// These are measurements, not estimates. Where a mapping to our rig is our own choice it is marked "mapping".
// Card y points DOWN, so a head that rises has a negative headDy.

export const REF_FPS = 30;
export const REF_FRAME_W = 540;

export const WALK_STEP_FRAMES = 5.8; // one full head up-down cycle per step
export const WALK_BOB_PP = 0.16; // peak-to-peak, fraction of head width, sinusoidal
export const DEPTH_SCALE_END = 0.58; // walk into depth: 100% -> 58%
export const DEPTH_FRAMES = 25; // over 25 frames (0.83 s)
export const DEPTH_V0_FRAC = 0.019; // start screen speed, fraction of frame width per frame, decays to about 0 at the door
export const IDLE_SWAY_PP = 0.13; // fraction of head width
export const IDLE_PERIOD_FRAMES = 10;
export const ANTIC_FRAMES = 4; // 3-4 frames of anticipation before walking out
export const ANTIC_RISE = 0.25; // head rises 25% of head width, no x movement
export const OUT_SCALE = 2.2; // walk out toward camera: scale x2.2 over 27 frames, ease-in
export const OUT_FRAMES = 27;
export const OUT_PX_PER_FRAME = [1, 4, 20] as const; // 1 -> 4 -> 15-25 px/frame at 540 px frame width (mid value 20)

/** Vertical head offset (card px) during a walk. `steps` = frames elapsed / WALK_STEP_FRAMES. Phase 0 = head at its lowest (mapping: contact/down pose). */
export const walkBobDy = (steps: number, headW: number) => ((WALK_BOB_PP * headW) / 2) * Math.cos(2 * Math.PI * steps);

/** Horizontal idle sway (card px). Mapping: the reference says "slow head sway"; we apply it to x. */
export const idleSwayDx = (frame: number, headW: number) => ((IDLE_SWAY_PP * headW) / 2) * Math.sin((2 * Math.PI * frame) / IDLE_PERIOD_FRAMES);

/** Walk into depth: progress 0..1 along the path with speed decaying linearly to 0 at the end (ease-out quad). */
export const depthProgress = (frame: number, frames = DEPTH_FRAMES) => { const u = Math.min(1, Math.max(0, frame / frames)); return 1 - (1 - u) * (1 - u); };
/** Speed as a fraction of the path length per frame at `frame`. */
export const depthSpeed = (frame: number, frames = DEPTH_FRAMES) => (frame >= frames ? 0 : (2 / frames) * (1 - frame / frames));

/** Anticipation before walking out: head rises ANTIC_RISE x head width over ANTIC_FRAMES, easeInOut, no x movement. Returns headDy (negative = up). */
export const anticipationDy = (framesSinceStart: number, headW: number) => { const u = Math.min(1, Math.max(0, framesSinceStart / ANTIC_FRAMES)); return -ANTIC_RISE * headW * (u * u * (3 - 2 * u)); };

/** Walk out toward camera: scale factor 1..OUT_SCALE over OUT_FRAMES, ease-in. */
export const walkOutScale = (frameSinceStep: number) => { const u = Math.min(1, Math.max(0, frameSinceStep / OUT_FRAMES)); return 1 + (OUT_SCALE - 1) * u * u; };
/** Screen speed in px/frame at the given frame width (reference values are for 540 px). Accelerates 1 -> 4 -> 20. */
export const walkOutSpeedPx = (frameSinceStep: number, frameW: number) => {
  const u = Math.min(1, Math.max(0, frameSinceStep / OUT_FRAMES)), [a, b, c] = OUT_PX_PER_FRAME, k = frameW / REF_FRAME_W;
  return k * (u < 0.5 ? a + (b - a) * (u / 0.5) ** 2 : b + (c - b) * ((u - 0.5) / 0.5) ** 2);
};
