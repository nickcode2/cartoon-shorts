// ZUMBIS_PARTE_10 named camera angles per zone: direction as azimuth (deg, 0 = camera in front of the focus toward +z, + toward +x) and elevation (deg, + camera above the focus).
// Rules (qa.ts): never the same angle twice in a row inside a zone, none used more than twice in the video, at most 6 per zone. The CITY is one world; the zones only group the angles and the camera limits:
//   avenue z +66 .. -48 (shots 1-4), march z -48 .. -117 (7-10, 12), crossing (11), tower (5, 6, 13, 14), base = the plaza round the podium (15-19), hall (20-21), terrace = the roof deck (22, 23, 24d), night (24a-c).
export type FocoZone = 'avenue' | 'march' | 'crossing' | 'tower' | 'base' | 'hall' | 'terrace' | 'night';
export const DIRS: Record<FocoZone, Record<string, {az: number; el: number}>> = {
  avenue: {A: {az: 155, el: -4}, B: {az: 170, el: 20}, C: {az: 70, el: 8}, D: {az: 88, el: 4}},
  march: {A: {az: 150, el: 3}, B: {az: 165, el: 2}, C: {az: -20, el: 4}, D: {az: 40, el: 5}, E: {az: -20, el: 16}, F: {az: 0, el: -4}},
  crossing: {A: {az: 8, el: 58}},
  tower: {A: {az: 0, el: 6}, B: {az: 22, el: 7}, C: {az: -38, el: 3}, D: {az: 12, el: -10}},
  base: {A: {az: 0, el: -24}, B: {az: -12, el: 22}, C: {az: 35, el: 2}, D: {az: 55, el: 6}, E: {az: 8, el: 22}},
  hall: {A: {az: 20, el: 14}, B: {az: 75, el: 10}, C: {az: -15, el: 3}},
  terrace: {A: {az: 180, el: 3}, B: {az: 180, el: 4}, C: {az: 180, el: -2}},
  night: {A: {az: 30, el: 8}, B: {az: -60, el: 4}, C: {az: 25, el: 16}},
};
