#!/usr/bin/env node
// KIT TOOL: join the chunks written by Studio's /chunk-render page into one MP4 (stream copy, no re-encode) and verify the frame count.
//
//   npm run join                          auto-picks the newest project folder that has chunks/manifest.json
//   npm run join -- COBRA_EFFECT          explicit folder
//   npm run join -- COBRA_EFFECT --reencode   if the copy join glitches at a chunk boundary (re-encodes with libx264 crf 16)
//   npm run join -- COBRA_EFFECT --frames 2190  expected total when there is no manifest.json (download fallback)
//
// Output: <FOLDER>/<FOLDER>_silent.mp4 (name comes from manifest.json "output").
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--frames');
const die = (m) => {
  console.error(`\njoin: ${m}\n`);
  process.exit(1);
};

// ---- ffmpeg -------------------------------------------------------------------------------------------------------------
const works = (bin) => {
  const r = spawnSync(bin, ['-version'], {encoding: 'utf8'});
  return r.status === 0;
};
let ffmpeg = null;
if (works('ffmpeg')) ffmpeg = 'ffmpeg';
else {
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static'); // installed by the one command below
    if (p && works(p)) ffmpeg = p;
  } catch {
    /* not installed */
  }
}
if (!ffmpeg) {
  die(
    'ffmpeg is not installed. Install it WITHOUT Homebrew with this one command (run it in the project folder):\n\n' +
      '    npm install --save-dev ffmpeg-static\n\n' +
      'then run "npm run join" again (this script finds it automatically).',
  );
}

// ---- find the folder ----------------------------------------------------------------------------------------------------
let folder = positional[0];
if (!folder) {
  const cands = readdirSync(root, {withFileTypes: true})
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'chunks')))
    .map((d) => ({name: d.name, t: statSync(join(root, d.name, 'chunks')).mtimeMs}))
    .sort((a, b) => b.t - a.t);
  if (cands.length === 0) die('no <FOLDER>/chunks found in the project. Render chunks first (Studio /chunk-render), or pass the folder: npm run join -- COBRA_EFFECT');
  folder = cands[0].name;
  console.log(`folder: ${folder} (newest with chunks; pass a name to choose another)`);
}
const folderPath = resolve(root, folder);
const chunksPath = join(folderPath, 'chunks');
if (!existsSync(chunksPath)) die(`${chunksPath} does not exist`);

// ---- chunk list ---------------------------------------------------------------------------------------------------------
let manifest = null;
const mPath = join(chunksPath, 'manifest.json');
if (existsSync(mPath)) manifest = JSON.parse(readFileSync(mPath, 'utf8'));
const files = readdirSync(chunksPath)
  .map((f) => ({f, m: /chunk_(\d+)\.mp4$/.exec(f)}))
  .filter((x) => x.m)
  .map((x) => ({n: Number(x.m[1]), path: join(chunksPath, x.f), name: x.f}))
  .sort((a, b) => a.n - b.n);
if (files.length === 0) die(`no chunk_NNN.mp4 files in ${chunksPath}`);

let expectedChunks = files.length;
let expectedTotal = null;
if (manifest) {
  expectedTotal = manifest.totalFrames;
  expectedChunks = Math.ceil(manifest.totalFrames / manifest.chunkSize);
} else if (val('--frames')) expectedTotal = Number(val('--frames'));
else console.warn('warning: no manifest.json and no --frames N: the frame total can only be compared with the sum of the chunks.');

// every chunk 1..N present
const missing = [];
for (let n = 1; n <= expectedChunks; n++) if (!files.some((x) => x.n === n)) missing.push(n);
if (missing.length) die(`missing chunk(s): ${missing.map((n) => 'chunk_' + String(n).padStart(3, '0') + '.mp4').join(', ')}. Run /chunk-render again: it resumes and renders only these.`);
const dupes = files.filter((x, i) => files.findIndex((y) => y.n === x.n) !== i);
if (dupes.length) die(`two files for the same chunk number: ${dupes.map((d) => d.name).join(', ')}. Remove the extra copy.`);
const use = files.filter((x) => x.n <= expectedChunks);

// ---- count frames -------------------------------------------------------------------------------------------------------
const countFrames = (path) => {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', path, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) return {err: (r.stderr || '').split('\n').slice(-4).join('\n')};
  const all = [...r.stderr.matchAll(/frame=\s*(\d+)/g)];
  if (!all.length) return {err: 'ffmpeg printed no frame count'};
  return {n: Number(all[all.length - 1][1])};
};

console.log(`\nchecking ${use.length} chunks...`);
let sum = 0;
let bad = 0;
for (const c of use) {
  const fc = countFrames(c.path);
  const exp = manifest?.chunks?.find((x) => x.n === c.n)?.frames;
  if (fc.err) {
    console.log(`  ${c.name}  UNREADABLE: ${fc.err}`);
    bad++;
    continue;
  }
  const ok = exp === undefined || exp === fc.n;
  if (!ok) bad++;
  sum += fc.n;
  console.log(`  ${c.name}  ${String(fc.n).padStart(4)} frames${exp !== undefined ? `  (expected ${exp})` : ''}  ${ok ? 'ok' : 'MISMATCH'}`);
}
if (bad) die(`${bad} chunk(s) unreadable or with the wrong frame count. Delete those chunk files and run /chunk-render again (it re-renders only the missing ones).`);
if (expectedTotal != null && sum !== expectedTotal) die(`the chunks hold ${sum} frames but the video needs ${expectedTotal}.`);

// ---- join ---------------------------------------------------------------------------------------------------------------
const outName = manifest?.output || `${folder}_silent.mp4`;
const outPath = join(folderPath, outName);
const tmp = mkdtempSync(join(tmpdir(), 'join-'));
const list = join(tmp, 'list.txt');
writeFileSync(list, use.map((c) => `file '${c.path.replace(/'/g, "'\\''")}'\n`).join(''));
const codec = flag('--reencode') ? ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p'] : ['-c', 'copy'];
console.log(`\njoining (${flag('--reencode') ? 're-encode libx264 crf 16' : 'stream copy, no re-encode'}) -> ${outPath}`);
const j = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, ...codec, '-an', '-movflags', '+faststart', outPath], {encoding: 'utf8'});
rmSync(tmp, {recursive: true, force: true});
if (j.status !== 0) die(`ffmpeg failed:\n${j.stderr}`);

const out = countFrames(outPath);
if (out.err) die(`cannot read the joined file: ${out.err}`);
const want = expectedTotal ?? sum;
if (out.n !== want) die(`FRAME COUNT MISMATCH: joined file has ${out.n} frames, expected ${want}. Try: npm run join -- ${folder} --reencode`);
const mb = (statSync(outPath).size / 1048576).toFixed(1);
console.log(`\nOK: ${outPath}\n    ${out.n} frames (expected ${want}), ${mb} MB${manifest ? `, ${manifest.fps} fps, ${(out.n / manifest.fps).toFixed(2)} s` : ''}`);
console.log('next: python3 scripts/fix_black_frames.py <that file>  (see STYLE_NOTES.md, "After every client-side render")');
