// Standalone entry for the FaceSwapTest only (src/index.ts -> Root imports reactionFace, which imports the deleted characters/faces/funny.svg, so Studio cannot bundle Root right now).
import {registerRoot} from 'remotion';
import {FaceSwapRoot} from './FaceSwapTest';

registerRoot(FaceSwapRoot);
