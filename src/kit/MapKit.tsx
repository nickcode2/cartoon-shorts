// 3D maps from real Natural Earth outlines (world-atlas TopoJSON, decoded by scripts/build_map_data.mjs into src/kit/data/*.ts).
// Extruded countries painted in the palette, correct place and shape. Use `world110` for world/continent views and
// `europe50` (50m, more detail) for zoomed European countries; regenerate the data file with other names for other regions:
//   node scripts/build_map_data.mjs 50m src/kit/data/<name>.ts "Country A,Country B"
// Layout: map lies in the XZ plane, north = -z (camera on +z looks north), y = extrusion height.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {V3} from './kit';
import {PAL} from './finish';
import world110 from './data/countries110';
import europe50 from './data/europe50';

export type MapData = Record<string, number[][][][]>;
export const MAP_DATA = {world110, europe50} as const;

export interface MapView {
  lon0: number; // map centre longitude
  lat0: number; // map centre latitude
  k: number; // metres per degree of latitude
}
/** lon/lat -> world XZ (equirectangular with cos(lat0) correction so shapes are not stretched at that latitude). */
export const project = (v: MapView, lon: number, lat: number): [number, number] => [(lon - v.lon0) * Math.cos((v.lat0 * Math.PI) / 180) * v.k, -(lat - v.lat0) * v.k];

export interface Highlight {
  color: string;
  h?: number; // extrusion height in metres (default 0.12)
  sideColor?: string;
}
const BASE_H = 0.04;

const ringArea = (r: number[][]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
};

/** Anchor point (top surface, centre of the largest polygon) of a country, for `Label3D`. Returns null if the country is not in the data. */
export function countryAnchor(data: MapData, name: string, v: MapView, y = 0.12, ox = 0, oz = 0): V3 | null {
  const polys = data[name];
  if (!polys) return null;
  let best = polys[0], ba = 0;
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]));
    if (a > ba) { ba = a; best = p; }
  }
  let sx = 0, sy = 0;
  for (const [lo, la] of best[0]) { sx += lo; sy += la; }
  const n = best[0].length;
  const [x, z] = project(v, sx / n, sy / n);
  return [x + ox, y, z + oz];
}

/** Does this country exist in the dataset? Check before writing a shot (typos like "UK" or "Czech Republic" are not in Natural Earth: use "United Kingdom", "Czechia"). */
export const hasCountry = (data: MapData, name: string) => !!data[name];

export type Clip = [number, number, number, number]; // lon min, lat min, lon max, lat max
const inClip = (poly: number[][][], c?: Clip) => {
  if (!c) return true;
  const r = poly[0];
  let x = 0, y = 0;
  for (const [lo, la] of r) { x += lo; y += la; }
  x /= r.length; y /= r.length;
  return x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3];
};
const buildGeo = (allPolys: number[][][][], v: MapView, depth: number, clip?: Clip) => {
  const polys = allPolys.filter((p) => inClip(p, clip));
  const geos: THREE.BufferGeometry[] = [];
  for (const poly of polys) {
    const pt = (r: number[][]) => r.map(([lo, la]) => {
      const [x, z] = project(v, lo, la);
      return new THREE.Vector2(x, -z); // shape y = north
    });
    const shape = new THREE.Shape(pt(poly[0]));
    for (let i = 1; i < poly.length; i++) shape.holes.push(new THREE.Path(pt(poly[i])));
    const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: depth * 0.12, bevelSize: 0.006 * v.k, bevelSegments: 1, curveSegments: 1});
    geos.push(g);
  }
  if (!geos.length) return new THREE.BufferGeometry();
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)!;
  if (geos.length > 1) geos.forEach((g) => g.dispose());
  merged.rotateX(-Math.PI / 2); // shape (x, north) -> world (x, -z north), extrusion up
  return merged;
};

/** Vertex colours instead of material groups (merging keeps one group): faces pointing up/down get `top`, the rest `side`. */
const paint = (g: THREE.BufferGeometry, top: string, side: string) => {
  if (!g.attributes.normal) return g;
  const n = g.attributes.normal, cT = new THREE.Color(top), cS = new THREE.Color(side);
  const col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const c = Math.abs(n.getY(i)) > 0.5 ? cT : cS;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};

/**
 * The map. `only` limits countries drawn (omit = all in the data). `highlights` colours and raises named countries.
 * Geometry is created once per component (useMemo) and disposed with the shot. Merged per highlight class to keep the geometry count low.
 */
export const WorldMap: React.FC<{
  data?: MapData;
  view: MapView;
  highlights?: Record<string, Highlight>;
  only?: string[];
  clip?: Clip; // drop polygons whose centre is outside this lon/lat box (France includes French Guiana etc. in Natural Earth: clip to the view)
  base?: string; // land colour (default blue-violet)
  baseSide?: string;
  p?: V3;
}> = ({data = world110, view, highlights = {}, only, clip, base = PAL.blueViolet.base, baseSide = PAL.indigo.base, p = [0, 0, 0]}) => {
  const parts = useMemo(() => {
    for (const n of Object.keys(highlights)) if (!data[n]) throw new Error(`[map] unknown country "${n}" (use Natural Earth names, e.g. "United Kingdom", "Czechia")`);
    const names = (only ?? Object.keys(data)).filter((n) => data[n] && !highlights[n]);
    const out: {geo: THREE.BufferGeometry}[] = [];
    const baseGeos = names.map((n) => buildGeo(data[n], view, BASE_H, clip));
    if (baseGeos.length) {
      out.push({geo: paint(baseGeos.length === 1 ? baseGeos[0] : mergeGeometries(baseGeos, false)!, base, baseSide)});
      if (baseGeos.length > 1) baseGeos.forEach((g) => g.dispose());
    }
    for (const [n, h] of Object.entries(highlights)) out.push({geo: paint(buildGeo(data[n], view, h.h ?? 0.12, clip), h.color, h.sideColor ?? PAL.indigo.vivid)});
    return out;
  }, [data, view.lon0, view.lat0, view.k, base, baseSide, JSON.stringify(highlights), (only ?? []).join('|'), clip?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={p}>
      {parts.map((m, i) => (
        <mesh key={i} geometry={m.geo} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};
