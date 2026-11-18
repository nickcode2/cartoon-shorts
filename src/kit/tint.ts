// HEAD TINT TRACK (narration -> target plan). By default EVERY head is white (with the normal crescent shadow). A tint exists only when the narration says so:
// angry (red), sick (pale green / pastel), embarrassed (pink), cold (blue). A troll face does NOT tint a head by itself.
// A row = { state, zone, intensity 0-1, from, to } (frames, from <= f < to), eased in and out. One API for a partial tint (cheeks only, around the eyes) or the whole head.
export type TintState = 'angry' | 'sick' | 'embarrassed' | 'cold';
export type TintZone = 'cheeks' | 'around-eyes' | 'forehead' | 'upper-half' | 'full';
export interface TintRow { state: TintState; zone: TintZone; intensity: number; from: number; to: number; easeIn?: number; easeOut?: number; why?: string }
export interface ActiveTint { state: TintState; zone: TintZone; k: number }
/** Gradient colours per state: [light, mid, deep]. The gradient runs inside the head, clipped to the outline: never a flat fill. */
export const TINT_COLORS: Record<TintState, [string, string, string]> = {
  angry: ['#ff7a66', '#e0301f', '#8c1008'],
  sick: ['#f2f7c4', '#d8e8a0', '#b4cc78'],
  embarrassed: ['#ffc2d6', '#ff7fa8', '#e0457d'],
  cold: ['#d6ecff', '#8fc4ff', '#4f86d8'],
};
export const TINT_STATES = Object.keys(TINT_COLORS) as TintState[];
export const TINT_ZONES: TintZone[] = ['cheeks', 'around-eyes', 'forehead', 'upper-half', 'full'];
const ease = (x: number) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
/** Strength 0..intensity of one row at a frame (smoothstep in over easeIn frames, out over easeOut frames; default 4). */
export const tintK = (r: TintRow, f: number) => (f < r.from || f >= r.to ? 0 : r.intensity * ease((f - r.from + 1) / (r.easeIn ?? 4)) * ease((r.to - f) / (r.easeOut ?? 4)));
/** Active tints of one character at a frame. Empty array = a white head (the default). */
export const tintAt = (rows: TintRow[], f: number): ActiveTint[] => rows.map((r) => ({state: r.state, zone: r.zone, k: tintK(r, f)})).filter((t) => t.k > 0.001);
/** Throws on a malformed row. Rows are only written when the narration mentions the state (angry, sick, embarrassed, cold), never by default. */
export function checkTintRows(label: string, rows: TintRow[]): void {
  for (const r of rows) {
    if (!TINT_STATES.includes(r.state)) throw new Error(`[tint] ${label}: unknown state ${r.state}`);
    if (!TINT_ZONES.includes(r.zone)) throw new Error(`[tint] ${label}: unknown zone ${r.zone}`);
    if (!(r.intensity > 0 && r.intensity <= 1)) throw new Error(`[tint] ${label}: intensity must be in (0, 1]`);
    if (!(r.to > r.from)) throw new Error(`[tint] ${label}: to must be after from`);
  }
}
