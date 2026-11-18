// WalkTest layout (metres, x right, z toward the camera, floor y = 0). Shared by WalkTest.tsx and WalkEnv.tsx.
export const WALL_Z = -6.2; // front face of the back wall (block fronts)
export const WL = 2.1, CEIL = 3.0; // corridor half width, ceiling height
export const DOOR_X = -0.3, DOOR_W = 1.0, DOOR_H = 2.0;
export const jx0 = DOOR_X - DOOR_W / 2, jx1 = DOOR_X + DOOR_W / 2;
// SIDE WALL the cop paints: a wall jutting into the corridor from the back wall (the corridor's own side walls at x = +-2.1 are outside the 9:16 frame).
export const X_W = 0.7, SW_Z0 = WALL_Z, SW_Z1 = -3.7, SW_H = 2.6; // wall face x (front of the blocks), z range, height
export const CELL_Z0 = -6.5, CELL_Z1 = -8.7;
export const LINE_Z = -2.3; // yellow floor line
