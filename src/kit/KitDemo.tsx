// Minimal template for a new video: ONE canvas for all shots (no flash at cuts). Copy this file to start a video.
import React from 'react';
import {Box, Floor, Sky, SingleCanvasVideo, ShotSpec, move} from './kit';

const shots: ShotSpec[] = [
  {
    from: 0,
    to: 45,
    light: 'day',
    cam: move({p: [0, 1.5, 6], l: [0, 1, 0]}, {p: [1, 1.5, 4], l: [0, 1, 0]}),
    render: () => (
      <>
        <Floor w={20} d={20} c="#7bd05f" />
        <Box s={[1, 1, 1]} p={[0, 0.5, 0]} c="#e5484d" />
        <Sky top="#6fb4ee" bottom="#cfeeff" />
      </>
    ),
  },
  {
    from: 45,
    to: 90,
    light: 'dusk',
    dip: {frames: 6, color: '#000'},
    cam: move({p: [-3, 1.2, 4], l: [0, 1, 0]}, {p: [-1, 1.2, 3], l: [0, 1, 0]}),
    render: () => (
      <>
        <Floor w={20} d={20} c="#4c7a54" />
        <Box s={[1.4, 2, 1]} p={[0, 1, 0]} c="#2f6fae" />
        <Sky top="#5b4a9a" bottom="#ffa772" />
      </>
    ),
  },
];

export const KitDemo: React.FC = () => <SingleCanvasVideo shots={shots} />;
