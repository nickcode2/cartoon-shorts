// ZUMBIS_PARTE_10 cast on the kit character system (src/kit/person.tsx): white cards, 3D hats / hair on the head pivot, 2D face props, curved joints. Every main character has its OWN head SVG,
// body SVG and silhouette (beanie / ponytail / fedora / flat cap / bob + cloche). Clothes only use the channel palette. Women use only the original body shapes (0, 1).
//   caio   main, young man, orange beanie, purple sweater            ana     woman, long ponytail + headband, coral coat
//   bruno  broad man with a mustache, dusty-lavender vest, FEDORA     davi    man, flat cap + round glasses, orange cardigan
//   lia    woman, bob + cloche hat, lavender coat
import {registerRole, SPECS} from '../kit/person';
import {makeCrowd, CrowdPal} from '../kit/crowd';
import {C} from './common';
export {Person, KIND, dirTo, poseOf, handPos, headPos, scaleOf, SPECS, AGE_GAIT, AGE_BOB, AGE_LEAN} from '../kit/person';
export type Role = string;
const HAIR = '#2A1B3A', HAIR2 = '#4A3A5A';
registerRole('caio', {head: [5, false, 1.0], body: [2, false, 1.0], ry: 112, persona: 'm', age: 'adult', scale: 1.0, style: 'sweater', top: C.purpleL, accent: C.cream, bottom: C.violet, gear: {hair: {kind: 'short', color: HAIR}, hat: {kind: 'beanie', color: C.orange, band: C.cream}}});
registerRole('ana', {head: [4, true, 0.92], body: [0, false, 0.98], ry: 106, persona: 'f', age: 'adult', scale: 0.98, style: 'coat', top: C.coral, accent: C.cream, bottom: C.violet, facial: {earrings: C.gold}, gear: {hair: {kind: 'ponytail', color: '#6A3A2A', hi: '#9A5A3A'}, headband: C.gold}});
registerRole('bruno', {head: [3, false, 1.0], body: [3, false, 1.18], ry: 120, persona: 'm', age: 'adult', scale: 1.04, style: 'vest', top: C.lav, accent: C.orange, bottom: C.wall3, facial: {mustache: {kind: 'handlebar', color: '#2A1B3A'}}, gear: {hair: {kind: 'short', color: HAIR2}, hat: {kind: 'fedora', color: C.wall3, band: C.orange, trim: 'feather', trimColor: C.gold}}});
registerRole('davi', {head: [6, true, 1.0], body: [4, false, 1.05], ry: 116, persona: 'm', age: 'adult', scale: 1.0, style: 'cardigan', top: C.orangeD, accent: C.cream, bottom: C.wall2, facial: {glasses: {kind: 'round', color: '#2A1B3A'}}, gear: {hair: {kind: 'messy', color: '#5A3A2A'}, hat: {kind: 'flatcap', color: C.trim, band: C.night, trim: 'button', trimColor: C.gold}}});
registerRole('lia', {head: [1, false, 1.0], body: [1, true, 1.0], ry: 108, persona: 'f', age: 'adult', scale: 0.97, style: 'blouse', top: C.lav, accent: C.purpleL, bottom: C.wall2, facial: {earrings: C.cream}, gear: {hair: {kind: 'bob', color: '#2A1B3A', hi: HAIR2}, hat: {kind: 'cloche', color: C.purple, band: C.cream, trim: 'flower', trimColor: C.orange}}});
// shelter: the man who closes the door (elder) + three sleeping children + an elder lady, then the seeded crowd
registerRole('doorMan', {head: [2, true, 1.1], body: [3, true, 1.2], ry: 122, persona: 'e', age: 'elder', scale: 0.97, style: 'cardigan', top: C.cream, accent: C.orangeD, bottom: C.wall2, facial: {glasses: {kind: 'round', color: '#2A1B3A'}, mustache: {kind: 'walrus', color: '#C9C4EE'}}, gear: {hair: {kind: 'balding', color: '#C9C4EE', hi: '#E4E0F5'}}, cane: false});
registerRole('kidA', {head: [4, false, 1.05], body: [0, false, 0.9], ry: 142, persona: 'c', age: 'child', scale: 0.7, style: 'overalls', top: C.orange, accent: C.cream, bottom: C.wall3, gear: {hair: {kind: 'pigtails', color: '#6A3A2A', hi: '#9A5A3A'}}});
registerRole('kidB', {head: [6, true, 1.0], body: [1, true, 0.9], ry: 146, persona: 'c', age: 'child', scale: 0.72, style: 'shorts', top: C.purpleL, accent: C.gold, bottom: C.violet, gear: {hair: {kind: 'short', color: HAIR}, hat: {kind: 'beanie', color: C.coral, band: C.cream}}});
registerRole('kidC', {head: [0, false, 1.05], body: [0, true, 0.9], ry: 140, persona: 'c', age: 'child', scale: 0.68, style: 'uniform', top: C.lav, accent: C.coral, bottom: C.wall3, gear: {hair: {kind: 'short', color: '#4A2A3A', hi: '#7A4A5A'}}});
registerRole('elderLady', {head: [0, false, 0.95], body: [1, true, 0.95], ry: 108, persona: 'e', age: 'elder', scale: 0.95, style: 'shawl', top: C.coral, accent: C.cream, bottom: C.wall2, facial: {glasses: {kind: 'round', color: '#2A1B3A'}, earrings: C.cream}, gear: {hair: {kind: 'bun', color: '#E4E0F5', hi: '#FFFFFF'}}, cane: true});
export const CROWD_PAL: CrowdPal = {cloth: [C.purpleL, C.orange, C.coral, C.lav, C.cream, C.trim, C.orangeD, C.wall3], bot: [C.violet, C.indigo, C.wall3, C.trim], hair: ['#2A1B3A', '#3A2A4A', '#5A3A32', '#7A5A44', '#1A1230', '#6A3A2A'], gray: ['#C9C4EE', '#E4E0F5', '#9A94C8'], hat: [C.violet, C.trim, C.orangeD, C.purpleL, C.wall3, C.lav], band: [C.orange, C.cream, C.gold], trim: [C.orange, C.gold, C.cream, C.coral], ear: C.gold};
/** Seeded shelter crowd (mixed ages and genders, never the same headwear on neighbours). Members 1..N are registered as `fc1..fcN`. */
export const CROWD = makeCrowd({n: 16, seed: 77, prefix: 'fc', pal: CROWD_PAL, mix: {child: 0.3, elder: 0.28, female: 0.5}, force: {1: {age: 'elder', female: true}, 2: {age: 'child', female: true}, 3: {age: 'adult', female: true}, 4: {age: 'elder', female: false}, 5: {age: 'child', female: true}, 6: {age: 'adult', female: false}}});
export const ROLE_LIST = ['caio', 'ana', 'bruno', 'davi', 'lia'];
void SPECS;
