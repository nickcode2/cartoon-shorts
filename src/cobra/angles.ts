// Named camera angles per set as DIRECTIONS (azimuth deg, 0 = in front, + toward +x; elevation deg, + camera above the focus). The camera distance comes from the framing box
// (`fitDistance`), the look point is the focus (`followFocus`). Rules: 4-6 named angles per set, never the same angle twice in a row in a location, no angle used more than twice.
export type SetName = 'street' | 'office' | 'garage';
export const DIRS: Record<SetName, Record<string, {az: number; el: number}>> = {
  street: {A: {az: 0, el: 8}, B: {az: 14, el: 30}, C: {az: 0, el: 80}, D: {az: -24, el: -5}, E: {az: 0, el: -9}, F: {az: 14, el: 5}}, // A front wide, B high 3/4, C top-down, D low 3/4, E ground level in front, F side (limited by the 5.8 m street)
  office: {A: {az: 0, el: 6}, B: {az: 0, el: 3}, C: {az: -12, el: 12}},
  garage: {A: {az: 0, el: 3}, B: {az: 0, el: 6}, C: {az: 30, el: 25}, D: {az: -50, el: 4}, E: {az: 70, el: 5}, X: {az: 50, el: 42}}, // interior A C D E, exterior (door) B X
};
