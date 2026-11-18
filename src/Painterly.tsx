import React, {useMemo} from 'react';
import {EffectComposer, Bloom} from '@react-three/postprocessing';
import {BlendFunction, Effect, EffectAttribute} from 'postprocessing';
import * as THREE from 'three';

// Ink outlines (depth edges with wobble + varying width) and paper grain, in one pass.
const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uInk;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float linZ(vec2 uv) { return -getViewZ(readDepth(uv)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 px = texelSize;
  // brush wobble: low-frequency warp of the sample position, re-seeded per "boil" step
  vec2 w = vec2(vn(uv * 38.0 + uTime), vn(uv * 38.0 + 11.0 + uTime)) - 0.5;
  vec2 suv = uv + w * px * 5.0;
  // irregular stroke width
  float width = 1.1 + 0.9 * vn(uv * 55.0 + 3.0 + uTime) + 0.4 * vn(uv * 210.0);
  vec2 o = px * width;

  float zc = linZ(suv);
  float zl = linZ(suv - vec2(o.x, 0.0));
  float zr = linZ(suv + vec2(o.x, 0.0));
  float zu = linZ(suv + vec2(0.0, o.y));
  float zd = linZ(suv - vec2(0.0, o.y));
  float zmin = min(min(zl, zr), min(zu, zd));
  float zmax = max(max(zl, zr), max(zu, zd));
  float rel = max(abs(zmax - zc), abs(zmin - zc)) / max(zc, 0.1);
  // second-derivative term catches creases between planes
  float crease = abs(zl + zr - 2.0 * zc) + abs(zu + zd - 2.0 * zc);
  rel = max(rel, crease / max(zc, 0.1) * 1.5);
  float edge = smoothstep(0.012, 0.035, rel);
  // broken, dry-brush edge
  edge *= 0.78 + 0.22 * vn(uv * 320.0);
  edge *= step(0.12, vn(uv * 90.0 + 5.0) + 0.3);

  vec3 col = mix(inputColor.rgb, uInk, edge * 0.88);

  // paper grain: fine fibre + faint blotch
  vec2 g = uv / px;
  float grain = h21(floor(g * 0.75)) - 0.5;
  float fibre = vn(g * vec2(0.08, 0.5)) - 0.5;
  float blotch = vn(uv * 6.0) - 0.5;
  col *= 1.0 + grain * 0.06 + fibre * 0.04 + blotch * 0.03;
  outputColor = vec4(col, inputColor.a);
}
`;

class PainterlyEffect extends Effect {
  constructor() {
    super('PainterlyEffect', frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uTime', new THREE.Uniform(0)],
        ['uInk', new THREE.Uniform(new THREE.Color('#1a0f12'))],
      ]),
    });
  }
  setTime(v: number) {
    (this.uniforms.get('uTime') as THREE.Uniform).value = v;
  }
}

export const Post: React.FC<{frame: number}> = ({frame}) => {
  const effect = useMemo(() => new PainterlyEffect(), []);
  effect.setTime(Math.floor(frame / 3) * 1.7); // line boil at 10 fps
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={1.1} luminanceThreshold={1.0} luminanceSmoothing={0.15} mipmapBlur radius={0.8} />
      <primitive object={effect} dispose={null} />
    </EffectComposer>
  );
};
