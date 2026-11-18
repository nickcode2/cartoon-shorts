// ZUMBIS_PARTE_10 extra QA (pure maths + the kit reports), run by `?qa=1` on the composition and by the QA sheets:
//   zombies: cap <= 80, wings never overlap (bone segments >= 0.10 m apart), head leads / nobody moves backward (dot >= 0.7 with the velocity), no flyer below the ground
//   grips: every held prop sits on its grip anchor (< 5.2 cm = 3 % of the height), door leaf never touches the frame, accessory attachment (3D hats / hair, 2D face props), timing, palette (pixels, in the sheet)
import {Pose, V3} from '../kit/kit';
import {attachReport, facialReport, faceVisibilityReport, fitReport} from '../kit/headgear';
import {SPECS, handPos} from './cast';
import {S} from '../shop/shots';
import {CROWD_PAL, ROLE_LIST} from './cast';
import {DOOR} from './props';
import {MAX_ZOMBIES, ZState, headLeads, wingClearance} from './zombie';
import {WALL, chasers, stateOf, wallStates} from './swarm';
import {FALLERS, Z24A, Z24B, circlers, scraper, pose9a, pose9b, pose21, poses4, CAIO_T} from './shots';
import {cutT, groupPos} from './story';
import TL from './timeline.json';

const L = (ok: boolean, name: string, msg = '') => `${ok ? 'PASS' : 'FAIL'} ${name}${msg ? ' ' + msg : ''}`;
void CROWD_PAL; void CAIO_T; void ROLE_LIST;
export function zombieAudit(): string[] {
  const out: string[] = [];
  const gens: [string, (t: number) => ZState[], number, number][] = [
    ['wall + flock', (t) => wallStates(t), 18.8, 37], ['chasers (shot 1-4)', (t) => chasers(t, 30, 3, (tt) => groupPos('caio', tt), {behind: 16, height: 10, dive: 6}), 0.2, 16], ['scraper', (t) => [scraper(t)], cutT('2'), cutT('3')],
    ['fallers', (t) => FALLERS.map((p) => stateOf(p, t)), cutT('19'), cutT('20a')], ['circlers', (t) => circlers(t, 16, 5, 28), 66, 75], ['hero flyer', (t) => [Z24A(t)], cutT('24a'), cutT('24b')], ['runner', (t) => [Z24B(t)], cutT('24b'), cutT('24c')],
  ];
  out.push(L(WALL.length <= MAX_ZOMBIES, `zombie swarm cap <= ${MAX_ZOMBIES} (wall = ${WALL.length}, chasers 33, fallers 10, circlers 28)`));
  let worstDot = 1, worstWho = '', minGround = 9, minClear = 9, clearWho = '';
  for (const [name, g, t0, t1] of gens) {
    for (let t = t0; t < t1; t += 0.1) { const a = g(t), b = g(t + 0.1), hl = headLeads(a, b, 0.1); if (hl.worst < worstDot) { worstDot = hl.worst; worstWho = `${name} #${hl.idx} @${t.toFixed(1)} s`; } for (const z of a) minGround = Math.min(minGround, z.p[1]); }
    for (let t = t0; t < t1; t += (t1 - t0) / 6) { const w = wingClearance(g(t), t); if (w.min < minClear) { minClear = w.min; clearWho = `${name} @${t.toFixed(1)} s (#${w.a}/#${w.b})`; } }
  }
  out.push(L(worstDot >= 0.7, 'zombies: the head leads (forward . velocity >= 0.7 whenever they move, none flies backward)', `worst ${worstDot.toFixed(2)} ${worstWho}`));
  out.push(L(minClear >= 0.1, 'zombies: wings never interpenetrate (bone segments of different flyers >= 0.10 m apart)', `closest ${minClear.toFixed(2)} m ${clearWho}`));
  out.push(L(minGround >= 0.02, 'zombies: nobody below the ground', `lowest ${minGround.toFixed(2)} m`));
  return out;
}
/** hand-to-anchor distance (m) of every held object over every frame of its shot: radio handle + knob (9a), radio hung from the running hand (9b), the door handle (21), Caio's grip on Ana's arm (4). */
export function gripAudit(camOf: (id: string, f: number, n: number) => Pose, nOf: (id: string) => number, gOf: (id: string) => number): string[] {
  const rows: string[] = []; let worst = 0, who = '';
  const upd = (e: number, name: string) => { if (e > worst) { worst = e; who = name; } };
  { const n = nOf('9a'); for (let f = 0; f < n; f++) { const c = camOf('9a', f, n), r = pose9a(f, c); upd(dist(handPos('bruno', r.pose, r.b, c.p, S, 0), r.handle), `radio handle @${f}`); upd(dist(handPos('bruno', r.pose, r.b, c.p, S, 1), r.knob), `radio knob @${f}`); } }
  { const n = nOf('9b'); for (let f = 0; f < n; f++) { const c = camOf('9b', f, n), r = pose9b(f, n, gOf('9b'), c); upd(dist(handPos('bruno', r.pose, r.p, c.p, S, r.slot), r.hang), `radio carry @${f}`); } }
  { const n = nOf('21'); for (let f = 0; f < n; f++) { const c = camOf('21', f, n), r = pose21(f, n, c); upd(dist(handPos('doorMan', r.pose, r.p, c.p, S, r.slot), r.handle), `door handle @${f}`); } }
  { const n = nOf('4'); for (let f = 60; f < 86; f++) { const c = camOf('4', f, n), r = poses4(f, n, c); if (r.grab > 0.95) { upd(dist(handPos('caio', r.caio, r.pc, c.p, S, r.slotC), r.H), `Caio hand on Ana's arm @${f}`); upd(dist(handPos('ana', r.ana, r.pa, c.p, S, r.slotA), r.H), `Ana hand @${f}`); } } }
  rows.push(L(worst < 0.052, 'hands pinned to the grip anchors (radio handle / knob, running radio, door handle, the grab): < 5.2 cm = 3 % of the height', `worst ${(worst * 100).toFixed(1)} cm (${who})`));
  return rows;
}
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The open door leaf never touches the frame: plan-view sweep of the leaf (and its studs / wheel, 0.21 m thick on the inner face) against both jambs for every opening angle. */
export function doorFrameAudit(): string[] {
  const hx = -DOOR.w / 2, x1 = DOOR.w - DOOR.hinge; let min = 9, who = '';
  const feats: [string, number, number, number, number][] = [['leaf plate + panels', DOOR.hinge, x1, -0.06, 0.09], ['studs (hinge side)', 0.47, 0.6, -0.03, 0.18], ['studs (free side)', 1.5, 1.7, -0.03, 0.18], ['wheel handle', 1.4, 1.72, 0.05, 0.22]];
  const jambs = [[hx - 0.24, hx, -(DOOR.t + 0.3) / 2, (DOOR.t + 0.3) / 2], [-hx, -hx + 0.24, -(DOOR.t + 0.3) / 2, (DOOR.t + 0.3) / 2]];
  for (let a = 0; a <= 1.0001; a += 0.02) for (const [name, xa, xb, za, zb] of feats) for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) {
    const x = xa + ((xb - xa) * i) / 8, z = za + ((zb - za) * j) / 2, th = -a, X = hx + x * Math.cos(th) + z * Math.sin(th), Z = -x * Math.sin(th) + z * Math.cos(th);
    for (const [ax, bx, az, bz] of jambs) { const dx = Math.max(ax - X, 0, X - bx), dz = Math.max(az - Z, 0, Z - bz); const d = (X >= ax && X <= bx && Z >= az && Z <= bz) ? -Math.min(X - ax, bx - X, Z - az, bz - Z) : Math.hypot(dx, dz); if (d < min) { min = d; who = `${name} @${a.toFixed(2)} rad`; } }
  }
  return [L(min >= 0.005, 'door leaf vs frame never interpenetrate (plan sweep 0..1.0 rad: leaf, panels, studs, wheel)', `clearance ${(min * 100).toFixed(1)} cm (${who})`)];
}
/** Accessory attachment (kit reports): 3D hats / hair on the head, 2D face props inside the face silhouette, nothing over the eyes, hair under the hat. */
export function attachAudit(): string[] {
  const roles = [...ROLE_LIST, 'doorMan', 'kidA', 'kidB', 'kidC', 'elderLady', ...Object.keys(SPECS).filter((k) => k.startsWith('fc'))]; let n = 0; const bad: string[] = [];
  for (const r of roles) { const sp = SPECS[r]; if (!sp) continue; for (const row of [...attachReport(r, sp.kind, sp.gear), ...facialReport(r, sp.kind, sp.facial), ...faceVisibilityReport(r, sp.kind, sp.gear), ...fitReport(r, sp.kind, sp.gear)]) { n++; if (!row.ok) bad.push(`${r}@${row.yaw}: ${row.note}`); } }
  return [L(bad.length === 0, `accessory attachment (3D hats / hair, 2D face props): ${n} checks over ${roles.length} characters`, bad.slice(0, 6).join('; '))];
}
export function timingAudit(): string[] {
  const c = TL.cuts, bad: string[] = []; c.forEach((k, i) => { if (i && k.f - c[i - 1].f < 12) bad.push(`${k.id} only ${k.f - c[i - 1].f} frames`); }); const last = TL.frames - c[c.length - 1].f;
  return [L(bad.length === 0 && last >= 60, `cuts follow the narration (sentence starts from the transcript, ${c.length} entries, shortest ${Math.min(...c.slice(1).map((k, i) => k.f - c[i].f))} frames, final hold ${last} frames)`, bad.join('; '))];
}

/** PALETTE CHECK (pixels): hue classes of one drawn cell against the FocoProibido profile. Skips the pure-white character cards. */
export interface PalStat {purple: number; orange: number; other: number; off: number; lum: number; darkTint: number; n: number}
export function paletteStat(d: Uint8ClampedArray): PalStat {
  let purple = 0, orange = 0, other = 0, off = 0, lum = 0, dark = 0, darkTint = 0, n = 0;
  for (let q = 0; q < d.length; q += 16) {
    const r = d[q] / 255, g = d[q + 1] / 255, b = d[q + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0; let h = 0;
    if (mx !== mn) { const dd = mx - mn; h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h = (h * 60 + 360) % 360; }
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++;
    if (s < 0.2 && v > 0.78) continue; // white cards / pale lavender haze
    if (v < 0.24) { dark++; if (h >= 215 && h <= 315 && s >= 0.22) darkTint++; }
    if (h >= 215 && h <= 315) purple++; else if (h >= 12 && h <= 62 && s > 0.3) orange++; else if (h >= 70 && h <= 200 && s > 0.28 && v > 0.2) off++; else other++;
  }
  const t = purple + orange + other + off || 1;
  return {purple: purple / t, orange: orange / t, other: other / t, off: off / t, lum: lum / n, darkTint: dark ? darkTint / dark : 1, n};
}
export function paletteLines(stats: PalStat[]): string[] {
  const k = stats.length || 1, avg = (f: (s: PalStat) => number) => stats.reduce((a, s) => a + f(s), 0) / k, p = avg((s) => s.purple), o = avg((s) => s.orange), ot = avg((s) => s.other), off = avg((s) => s.off), lum = avg((s) => s.lum), dt = avg((s) => s.darkTint), worstOff = Math.max(...stats.map((s) => s.off)), worstLum = Math.max(...stats.map((s) => s.lum));
  return [
    L(off <= 0.02 && worstOff <= 0.06, 'palette: no off-palette hues (green / cyan share)', `mean ${(off * 100).toFixed(1)} %, worst cell ${(worstOff * 100).toFixed(1)} %`),
    L(p >= 0.5 && p <= 0.92 && o >= 0.04 && o <= 0.36, 'palette ratio about 70 % purple / indigo, 20 % orange / gold, 10 % other', `purple ${(p * 100).toFixed(0)} %, orange / gold ${(o * 100).toFixed(0)} %, other ${(ot * 100).toFixed(0)} %`),
    L(lum <= 0.4 && worstLum <= 0.55, 'dark mood (mean luminance)', `mean ${(lum).toFixed(2)}, brightest cell ${(worstLum).toFixed(2)}`),
    L(dt >= 0.55, 'shadows are purple, never black / neutral (dark pixels with a purple hue)', `${(dt * 100).toFixed(0)} % of the dark pixels`),
  ];
}
