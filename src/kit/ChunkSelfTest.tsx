// Tiny 2D composition (no WebGL) to test the chunk-render tool and `npm run join` cheaply: shows its own frame number.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

export const CST_FRAMES = 70;
export const ChunkSelfTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: `hsl(${(f * 5) % 360} 60% 45%)`, alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 96, fontFamily: 'sans-serif', fontWeight: 700}}>
      {f}
    </AbsoluteFill>
  );
};
