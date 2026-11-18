// SEEDED CROWD GENERATOR (kit default 2026-11-17): picks age, gender, outfit, headwear, hair, colours, head SVG and body SVG for N background characters so that no two look the same and
// no two NEIGHBOURS (consecutive entries) share a hat or a silhouette. Women only use the original body shapes (index 0 and 1). Children are 0.68-0.75 scale with a bigger head ratio,
// elders get gray / white hair, glasses, a cane or a shawl. Every video's crowd mixes ages and genders. Roles are registered as `${prefix}${i}` (i from 1).
import {CharSpec, Persona, Style, registerRole} from './person';
import {GearSpec, HatKind} from './headgear';
import {FacialSpec} from './rickRig';

const mul = (a: number) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const CLOTH = ['#E8745A', '#43A98B', '#8E6BBF', '#E0B03A', '#3FA7C9', '#C9657A', '#7A8F4A', '#6E8BA8', '#D9663F', '#2FA7A0', '#B8506A', '#5A7FB0'];
const BOT = ['#2F3B57', '#5A4A3A', '#3A3F55', '#4A4036', '#6B4A32', '#2B3640'];
const HAT = ['#2B2630', '#7A5C3E', '#8A8A7A', '#8E4B7A', '#E8B23A', '#4A4036', '#C9657A', '#F2D08A'], BAND = ['#2B2630', '#E0302A', '#F6E8C8', '#E8B23A'], TRIM = ['#E0302A', '#F2C230', '#F6E8C8', '#3FA7C9'];
const HAIR = ['#3A2A22', '#5A3A22', '#7A4A2A', '#B07A3C', '#1E1A1A', '#C9A24A', '#A04A22'], GRAY = ['#B8B8C0', '#E4E4EA', '#9A9AA4'];
export interface CrowdPal {cloth?: string[]; bot?: string[]; hair?: string[]; gray?: string[]; hat?: string[]; band?: string[]; trim?: string[]; ear?: string}
export interface CrowdOpts {pal?: CrowdPal; n: number; seed: number; mix?: {child: number; elder: number; female: number}; prefix?: string; force?: Partial<Record<number, {age?: 'adult' | 'child' | 'elder'; female?: boolean}>>}
export interface CrowdMember {role: string; spec: CharSpec; hat: string}
export function makeCrowd(o: CrowdOpts): CrowdMember[] {
  const PL = o.pal ?? {}, CLOTH_ = PL.cloth ?? CLOTH, BOT_ = PL.bot ?? BOT, HAIR_ = PL.hair ?? HAIR, GRAY_ = PL.gray ?? GRAY, HAT_ = PL.hat ?? HAT, BAND_ = PL.band ?? BAND, TRIM_ = PL.trim ?? TRIM, EAR_ = PL.ear ?? '#E8B23A';
  const r = mul(o.seed), mix = o.mix ?? {child: 0.2, elder: 0.2, female: 0.5}, prefix = o.prefix ?? 'cr', out: CrowdMember[] = [], pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
  let lastHat = '', lastSil = '';
  for (let i = 1; i <= o.n; i++) {
    const f = o.force?.[i], u = r(), age = f?.age ?? (u < mix.child ? 'child' : u < mix.child + mix.elder ? 'elder' : 'adult'), female = f?.female ?? r() < mix.female;
    let persona: Persona = age === 'child' ? 'c' : age === 'elder' ? 'e' : female ? 'f' : 'm';
    const gear: GearSpec = {}, facial: FacialSpec = {}; let style: Style, hat: HatKind = 'none', hatC = pick(HAT_), top = pick(CLOTH_), accent = pick(CLOTH_), bottom = pick(BOT_);
    let ry: number, scale = 1, hairKind: NonNullable<GearSpec['hair']>['kind'] = 'short', hairC = pick(HAIR_);
    if (age === 'child') {
      scale = 0.68 + r() * 0.07; ry = 138 + Math.floor(r() * 12); style = pick(['overalls', 'shorts', 'uniform'] as Style[]); hat = pick(['none', 'beanie', 'cap', 'none'] as HatKind[]);
      hairKind = female ? pick(['pigtails', 'braids', 'short', 'bun'] as const) : pick(['messy', 'short', 'curls'] as const); if (hat === 'beanie' || hat === 'cap') hairKind = 'short';
    } else if (age === 'elder') {
      scale = 0.95; ry = female ? 106 + Math.floor(r() * 6) : 118 + Math.floor(r() * 6); hairC = pick(GRAY_);
      style = female ? pick(['shawl', 'cardigan', 'coat', 'dress'] as Style[]) : pick(['cardigan', 'suit', 'vest', 'sweater'] as Style[]);
      hat = female ? pick(['none', 'cloche', 'none'] as HatKind[]) : pick(['flatcap', 'fedora', 'none', 'none'] as HatKind[]); hairKind = female ? 'bun' : 'balding';
      facial.glasses = r() < 0.6 ? {kind: pick(['round', 'square'] as const), color: '#3A2A22'} : undefined; if (!female && r() < 0.6) facial.mustache = {kind: pick(['walrus', 'handlebar'] as const), color: hairC}; if (!female && r() < 0.3) facial.beard = {kind: 'chops', color: hairC};
    } else if (female) {
      ry = 104 + Math.floor(r() * 8); style = pick(['dress', 'skirt', 'blouse', 'coat', 'apron'] as Style[]); hat = pick(['cloche', 'sunhat', 'none', 'none', 'cloche'] as HatKind[]);
      hairKind = pick(['bob', 'long', 'bun', 'ponytail', 'braids', 'curls'] as const); if (r() < 0.35) facial.earrings = EAR_; if (hat === 'none' && r() < 0.4) gear.headband = pick(CLOTH_);
    } else {
      ry = 112 + Math.floor(r() * 10); style = pick(['vest', 'suit', 'sweater', 'cardigan'] as Style[]); hat = pick(['bowler', 'fedora', 'flatcap', 'newsboy', 'boater', 'none'] as HatKind[]); hairKind = pick(['short', 'messy', 'curls'] as const);
      if (r() < 0.3) facial.mustache = {kind: pick(['handlebar', 'walrus', 'pencil'] as const), color: pick(HAIR_)}; if (r() < 0.15) facial.beard = {kind: pick(['full', 'goatee', 'chops'] as const), color: pick(HAIR_)}; if (r() < 0.18) facial.glasses = {kind: 'round', color: '#3A2A22'};
    }
    // never the same headwear as the neighbour
    let hk = `${hat}${hatC}`, tries = 0; while (hk === lastHat && tries++ < 8) { hat = pick(female || age === 'child' ? (['none', 'cloche', 'beanie', 'cap', 'sunhat'] as HatKind[]) : (['bowler', 'fedora', 'flatcap', 'newsboy', 'boater', 'none'] as HatKind[])); hatC = pick(HAT_); hk = `${hat}${hatC}`; if (age === 'child' && hat === 'cloche') hat = 'beanie'; if (!female && age !== 'child' && hat === 'cloche') hat = 'bowler'; }
    if (hat !== 'none') gear.hat = {kind: hat, color: hatC, band: pick(BAND_), trim: hat === 'cloche' ? pick(['flower', 'ribbon', 'feather'] as const) : hat === 'fedora' ? 'feather' : hat === 'flatcap' || hat === 'cap' ? 'button' : 'none', trimColor: pick(TRIM_)};
    gear.hair = hairKind === 'balding' || !(hat === 'bowler' || hat === 'boater') || r() < 0.5 ? {kind: hairKind, color: hairC, hi: hairC} : {kind: 'short', color: hairC};
    let head: [number, boolean, number], body: [number, boolean, number], sil = '';
    for (let t = 0; t < 12; t++) { head = [Math.floor(r() * 7), r() < 0.5, 0.85 + r() * 0.3]; body = [female || age === 'child' ? Math.floor(r() * 2) : Math.floor(r() * 5), r() < 0.5, 0.82 + r() * 0.35]; sil = `${head[0]}${head[1]}${body[0]}${body[1]}`; if (sil !== lastSil) break; }
    const spec = registerRole(`${prefix}${i}`, {head: head!, body: body!, ry, persona, age, scale, style, top, accent, bottom, gear, facial, cane: age === 'elder' && r() < 0.7});
    out.push({role: `${prefix}${i}`, spec, hat: hk}); lastHat = hk; lastSil = sil;
  }
  return out;
}
