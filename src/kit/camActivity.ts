// KIT RULES v9, rule 1: THE CAMERA NEVER SITS STILL FOR LONG (kit default for every FUTURE video; existing videos are not re-rendered).
//  - Default take 2-3 s. The camera may be still for at most 3 s (hard). No take longer than 5 s. Any take longer than 3 s keeps a continuous visible move with the S-curve ease for its whole length.
//  - A narration beat longer than 3 s is split into several takes (new angle, new height, closer to something else, never the same angle twice in a row) by `planTakes`, or it keeps one continuous move.
// Pure maths on a camera function `(frame, n) -> {p, l, fov?}`: no GPU, runs in node and in Studio. Used by `runQA` (qa.ts) and by `planTakes` when a video builds its shot list.
export interface CamPose {p: [number, number, number]; l: [number, number, number]; fov?: number; roll?: number}
export const FPS = 30;
export const TAKE_DEFAULT_S: [number, number] = [2, 3];
export const STILL_MAX_S = 3; // the camera may be effectively still for at most this long (hard)
export const TAKE_MAX_S = 5; // no take longer than this, ever
export const LONG_TAKE_S = 3; // a take longer than this must have a continuous move with the S-curve
export const LONG_STILL_TOL_S = 1; // inside a long take, a still stretch (ease-in / ease-out tails of the S-curve) may last at most this long
// "Effectively still" = per frame the view changes by less than about 1 px at 1080x1920 (fov 60): look direction < 0.0006 rad, camera position < 3 mm, fov < 0.01 deg, roll < 0.01 deg.
export const STILL_EPS = {pos: 0.003, dir: 0.0006, fov: 0.01, roll: 0.01};

export interface TakeActivity {id: string; frames: number; seconds: number; moving: boolean; longestStillS: number; stillFrom: number; maxStep: {pos: number; dir: number; fov: number}; fails: string[]}
const dirOf = (c: CamPose): [number, number, number] => { const d: [number, number, number] = [c.l[0] - c.p[0], c.l[1] - c.p[1], c.l[2] - c.p[2]], m = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / m, d[1] / m, d[2] / m]; };
/** Per-frame activity of one take. A frame counts as still when position, look direction, FOV and roll all change by less than `STILL_EPS` against the previous frame. */
export function takeActivity(id: string, cam: (f: number, n: number) => CamPose, n: number, fps = FPS): TakeActivity {
  let run = 0, best = 0, bestAt = 0, moved = 0; const maxStep = {pos: 0, dir: 0, fov: 0};
  let prev = cam(0, n);
  for (let f = 1; f < n; f++) {
    const c = cam(f, n), dp = Math.hypot(c.p[0] - prev.p[0], c.p[1] - prev.p[1], c.p[2] - prev.p[2]), a = dirOf(prev), b = dirOf(c), dd = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), df = Math.abs((c.fov ?? 0) - (prev.fov ?? 0)), dr = Math.abs((c.roll ?? 0) - (prev.roll ?? 0));
    maxStep.pos = Math.max(maxStep.pos, dp); maxStep.dir = Math.max(maxStep.dir, dd); maxStep.fov = Math.max(maxStep.fov, df);
    const still = dp < STILL_EPS.pos && dd < STILL_EPS.dir && df < STILL_EPS.fov && dr < STILL_EPS.roll;
    if (still) { run++; if (run > best) { best = run; bestAt = f - run + 1; } } else { run = 0; moved++; }
    prev = c;
  }
  const seconds = n / fps, longestStillS = best / fps, fails: string[] = [];
  if (longestStillS > STILL_MAX_S) fails.push(`still for ${longestStillS.toFixed(1)} s (max ${STILL_MAX_S} s)`);
  if (seconds > TAKE_MAX_S + 1e-9) fails.push(`take is ${seconds.toFixed(1)} s (max ${TAKE_MAX_S} s)`);
  if (seconds > LONG_TAKE_S && longestStillS > LONG_STILL_TOL_S) fails.push(`take over ${LONG_TAKE_S} s needs a continuous move: still stretch ${longestStillS.toFixed(1)} s (max ${LONG_STILL_TOL_S} s)`);
  return {id, frames: n, seconds, moving: moved > 0, longestStillS, stillFrom: bestAt, maxStep, fails};
}
/** QA lines + the per-shot table (duration, motion yes / no, longest still stretch). */
export function cameraActivity(takes: {id: string; n: number; cam: (f: number, n: number) => CamPose}[], fps = FPS): {lines: string[]; fails: string[]; table: string[]; rows: TakeActivity[]} {
  const rows = takes.map((t) => takeActivity(t.id, t.cam, t.n, fps)), fails = rows.flatMap((r) => r.fails.map((m) => `${r.id}: ${m}`));
  const table = ['shot | duration | motion | longest still stretch', ...rows.map((r) => `${r.id} | ${r.seconds.toFixed(2)} s | ${r.moving ? 'yes' : 'NO'} | ${r.longestStillS.toFixed(2)} s${r.fails.length ? ' FAIL' : ''}`)];
  const long = rows.filter((r) => r.seconds > TAKE_MAX_S).length, still = rows.filter((r) => r.longestStillS > STILL_MAX_S).length;
  return {lines: [`${fails.length === 0 ? 'PASS' : 'FAIL'} camera activity: ${rows.length} takes, longest ${Math.max(...rows.map((r) => r.seconds)).toFixed(1)} s, ${long} over ${TAKE_MAX_S} s, ${still} still for more than ${STILL_MAX_S} s${fails.length ? ' ' + fails.slice(0, 8).join('; ') : ''}`], fails, table, rows};
}

/** SHOT PLANNING: split one narration beat (frames) into takes of 2-3 s (60-90 frames at 30 fps), none longer than 5 s, none shorter than 2 s unless the beat itself is shorter. Returns the take lengths in frames.
 *  A beat of 3 s or less stays one take. The caller gives each take its own angle (never the same angle twice in a row, `pickAngles`) or, when one take must run past 3 s (up to 5 s), a continuous S-curve move. */
export function planTakes(beatFrames: number, fps = FPS): number[] {
  const lo = TAKE_DEFAULT_S[0] * fps, hi = TAKE_DEFAULT_S[1] * fps; if (beatFrames <= hi) return [beatFrames];
  const k = Math.ceil(beatFrames / hi), out: number[] = []; let left = beatFrames;
  for (let i = 0; i < k; i++) { const len = Math.round(left / (k - i)); out.push(len); left -= len; }
  if (out.some((x) => x < lo) && out.length > 1) { const m = Math.max(1, Math.floor(beatFrames / lo)); out.length = 0; let l2 = beatFrames; for (let i = 0; i < m; i++) { const len = Math.round(l2 / (m - i)); out.push(len); l2 -= len; } }
  return out;
}
/** Assign angles to consecutive takes: never the same angle twice in a row, least-used first. */
export function pickAngles(count: number, angles: string[], last?: string): string[] {
  const used: Record<string, number> = {}, out: string[] = []; let prev = last;
  for (let i = 0; i < count; i++) { const a = [...angles].filter((x) => x !== prev).sort((x, y) => (used[x] ?? 0) - (used[y] ?? 0))[0]; out.push(a); used[a] = (used[a] ?? 0) + 1; prev = a; }
  return out;
}
