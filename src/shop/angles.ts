// Named camera angles as DIRECTIONS (azimuth deg, 0 = camera in front of the focus toward +z, + toward +x; elevation deg, + camera above the focus).
// The SUPERMARKET is one set but a 25 m long hall, so QA treats three zones as separate "locations" (aisle, register, entrance); each zone has 4-6 angles, none used more than
// twice, never the same angle twice in a row inside a zone. The WORKSHOP reuses the GARAGE angle names.
export type ShopSet = 'aisle' | 'register' | 'entrance' | 'garage';
export const DIRS: Record<ShopSet, Record<string, {az: number; el: number}>> = {
  aisle: {A: {az: 0, el: 4}, B: {az: 30, el: 5}, C: {az: -42, el: 5}, D: {az: 0, el: -9}, E: {az: -75, el: 6}, F: {az: 12, el: -5}},
  register: {A: {az: -72, el: 5}, B: {az: -38, el: 4}, C: {az: 0, el: 6}, D: {az: -90, el: 12}},
  entrance: {A: {az: 0, el: 5}, B: {az: 12, el: 14}, C: {az: -30, el: 5}, D: {az: 0, el: -8}, E: {az: 42, el: 4}, F: {az: -60, el: 6}},
  garage: {A: {az: 0, el: 3}, B: {az: 0, el: 6}, C: {az: 30, el: 25}, D: {az: -50, el: 4}, E: {az: 70, el: 5}, X: {az: 50, el: 42}},
};
