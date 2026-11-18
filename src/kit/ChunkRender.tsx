// KIT TOOL: automatic, resumable chunked client-side render (see STYLE_NOTES.md, "CHUNK RENDER TOOL").
// Open Studio, go to /chunk-render. It is a Studio composition (id "chunk-render") whose UI is drawn in a full-screen portal,
// so it runs inside the Studio tab and uses the SAME renderer as Studio's "Client-side render" (renderMediaOnWeb, WebCodecs).
// Compositions come from Studio's own list, so any future video works by name: no registry to edit.
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Internals} from 'remotion';
import {renderMediaOnWeb} from '@remotion/web-renderer';

export const CHUNK_SIZE_DEFAULT = 300;
const PAUSE_MS = 2500; // pause between chunks so the previous canvas, context and textures can be released
const RETRIES = 1; // one automatic retry of a failed chunk after a longer pause
const DEFAULT_COMP = 'CobraEffectSilent';

// ---- small helpers -------------------------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(3, '0');
const chunkFile = (n: number) => `chunk_${pad(n)}.mp4`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

type Plan = {n: number; start: number; end: number; frames: number};
export const planChunks = (total: number, size: number): Plan[] => {
  const out: Plan[] = [];
  for (let s = 0, n = 1; s < total; s += size, n++) {
    const e = Math.min(s + size, total) - 1;
    out.push({n, start: s, end: e, frames: e - s + 1});
  }
  return out;
};

type ManifestChunk = {n: number; file: string; start: number; end: number; frames: number; bytes: number; doneAt: string};
type Manifest = {
  version: 1;
  composition: string;
  output: string; // joined file name, written next to the chunks folder by `npm run join`
  totalFrames: number;
  chunkSize: number;
  fps: number;
  width: number;
  height: number;
  chunks: ManifestChunk[];
};

// ---- folder handle persistence (so a restart needs one click, not a new folder pick) -------------------------------------
const idb = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open('chunk-render', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const saveHandle = async (h: Any) => {
  try {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('h', 'readwrite');
      tx.objectStore('h').put(h, 'dir');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* storage may be blocked: the folder is simply picked again next time */
  }
};
const loadHandle = async (): Promise<Any | null> => {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const rq = db.transaction('h').objectStore('h').get('dir');
      rq.onsuccess = () => res(rq.result ?? null);
      rq.onerror = () => rej(rq.error);
    });
  } catch {
    return null;
  }
};

const hasFsApi = () => typeof window !== 'undefined' && typeof (window as Any).showDirectoryPicker === 'function';
const flagOn = (k: string) => typeof window !== 'undefined' && new RegExp('[?&]' + k + '=1').test(window.location.search);
const isTestMode = () => flagOn('opfs'); // browser-private test folder, only when you add ?opfs=1 on purpose
const showTestComps = () => flagOn('test'); // ChunkSelfTest in the dropdown, only with ?test=1
// The real folder picker needs desktop Chrome (or Edge). The Claude in-app pane and other embedded browsers are refused.
const isRealChrome = () => {
  const b: {brand: string}[] = (navigator as Any).userAgentData?.brands ?? [];
  return b.some((x) => x.brand === 'Google Chrome' || x.brand === 'Microsoft Edge') && !/Electron/.test(navigator.userAgent);
};
const pickerUsable = () => hasFsApi() && isRealChrome();

const readManifest = async (chunksDir: Any): Promise<Manifest | null> => {
  try {
    const fh = await chunksDir.getFileHandle('manifest.json');
    return JSON.parse(await (await fh.getFile()).text()) as Manifest;
  } catch {
    return null;
  }
};
const writeFile = async (dir: Any, name: string, data: Blob | string) => {
  const fh = await dir.getFileHandle(name, {create: true});
  const w = await fh.createWritable(); // writes to a swap file and replaces the target on close: a crash never leaves a half file under the final name
  await w.write(data);
  await w.close();
  return (await fh.getFile()).size as number;
};

type GpuRow = {shot: number; geometries: number; textures: number; programs: number};
const gpuSummary = (fromIndex: number) => {
  const w = window as Any;
  const rows: GpuRow[] = (w.__gpuLog ?? []).slice(fromIndex);
  const last = rows[rows.length - 1];
  let info: Record<string, number> | null = null;
  try {
    info = w.__glInfo ? w.__glInfo() : null;
  } catch {
    info = null;
  }
  const mem = (performance as Any).memory;
  return {
    shotsLogged: rows.length,
    geometries: last?.geometries ?? null,
    textures: last?.textures ?? null,
    programs: last?.programs ?? null,
    peakGeometries: rows.length ? Math.max(...rows.map((r) => r.geometries)) : null,
    peakTextures: rows.length ? Math.max(...rows.map((r) => r.textures)) : null,
    glInfo: info,
    jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
  };
};

// ---- the page --------------------------------------------------------------------------------------------------------
const C = {bg: '#0f1117', panel: '#181b24', line: '#2b3040', text: '#e8eaf0', dim: '#8d93a6', ok: '#4cc38a', warn: '#f5a524', bad: '#ff5d5d', accent: '#4f8cff', grey: '#3a4052'};
const box: React.CSSProperties = {background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 14};
const inputStyle: React.CSSProperties = {background: '#0c0e14', color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: '8px 10px', fontSize: 15, width: '100%', boxSizing: 'border-box'};
const btn = (primary: boolean, disabled?: boolean): React.CSSProperties => ({
  background: disabled ? '#2a2f3d' : primary ? C.accent : '#2b3040',
  color: disabled ? C.dim : primary ? '#fff' : C.text,
  border: 'none',
  borderRadius: 8,
  padding: '11px 22px',
  fontSize: 16,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const Bar: React.FC<{value: number; color?: string; label?: string; h?: number}> = ({value, color = C.accent, label, h = 26}) => (
  <div style={{background: '#0c0e14', borderRadius: 6, height: h, position: 'relative', overflow: 'hidden', border: `1px solid ${C.line}`}}>
    <div style={{width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', background: color, transition: 'width 0.15s'}} />
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000'}}>{label ?? `${(value * 100).toFixed(1)}%`}</div>
  </div>
);
const fmtT = (s: number) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min ${s % 60} s` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
};

const Page: React.FC = () => {
  const mgr = useContext(Internals.CompositionManager) as Any;
  const comps: Any[] = useMemo(
    () => ((mgr?.compositions ?? []) as Any[]).filter((c) => c.id !== 'chunk-render' && (showTestComps() || c.id !== 'ChunkSelfTest')),
    [mgr],
  );

  const lsGet = (k: string) => {
    try {
      return localStorage.getItem('chunkRender2.' + k);
    } catch {
      return null;
    }
  };
  const [compId, setCompId] = useState(() => {
    const s = lsGet('comp');
    return s && (s !== 'ChunkSelfTest' || showTestComps()) ? s : DEFAULT_COMP;
  });
  const [totalStr, setTotalStr] = useState('');
  const [sizeStr, setSizeStr] = useState(String(CHUNK_SIZE_DEFAULT)); // never remembered: always 300 unless you change it now
  const [outName, setOutName] = useState('');

  const [dir, setDir] = useState<Any | null>(null);
  const [dirLabel, setDirLabel] = useState('');
  const [savedHandle, setSavedHandle] = useState<Any | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [curFrames, setCurFrames] = useState(0); // frames of the current chunk already encoded (from the renderer's progress callback)
  const [status, setStatus] = useState('Idle.');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const [wake, setWake] = useState<'off' | 'on' | 'unsupported' | 'failed'>('off');
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const wakeRef = useRef<Any>(null);
  const runningRef = useRef(false);
  const baseFramesRef = useRef(0);
  const wakeWarned = useRef(false);
  const hiddenLogAt = useRef(0);

  const usable = pickerUsable() || isTestMode();
  const comp = comps.find((c) => c.id === compId) ?? null;

  // if the remembered / default composition does not exist, fall back to the first real one
  useEffect(() => {
    if (comps.length > 0 && !comps.some((c) => c.id === compId)) setCompId(comps.some((c) => c.id === DEFAULT_COMP) ? DEFAULT_COMP : comps[comps.length - 1].id);
  }, [comps, compId]);
  useEffect(() => {
    if (comp?.durationInFrames) setTotalStr(String(comp.durationInFrames));
  }, [comp?.id, comp?.durationInFrames]);

  const total = Math.floor(Number(totalStr));
  const size = Math.floor(Number(sizeStr));
  const valid = !!comp && total > 0 && size > 0 && (!comp.durationInFrames || total <= comp.durationInFrames);
  const plan = useMemo(() => (total > 0 && size > 0 ? planChunks(total, size) : []), [total, size]);

  const log = useCallback((msg: string, level: 'info' | 'warn' | 'error' = 'info') => {
    (console as Any)[level]('[chunk]', msg);
    setLogs((l) => [...l.slice(-400), `${new Date().toLocaleTimeString()}  ${msg}`]);
  }, []);
  const fail = useCallback(
    (msg: string) => {
      setError(msg);
      log(msg, 'error');
    },
    [log],
  );

  // any uncaught error shows on the page too, never only in the console
  useEffect(() => {
    const onErr = (e: ErrorEvent) => runningRef.current && fail(`Error: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) => runningRef.current && fail(`Error: ${(e.reason as Error)?.message ?? String(e.reason)}`);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [fail]);

  const acquireWake = useCallback(async () => {
    const nav = navigator as Any;
    if (!nav.wakeLock) {
      setWake('unsupported');
      return;
    }
    try {
      if (wakeRef.current && !wakeRef.current.released) return;
      wakeRef.current = await nav.wakeLock.request('screen');
      setWake('on');
      wakeRef.current.addEventListener('release', () => setWake('off'));
    } catch (e) {
      setWake('failed');
      if (!wakeWarned.current) log(`Screen wake lock failed: ${(e as Error).message}. Set Energy Saver / Battery to never sleep while rendering.`, 'warn');
      wakeWarned.current = true;
    }
  }, [log]);
  const releaseWake = useCallback(async () => {
    try {
      await wakeRef.current?.release();
    } catch {
      /* ignore */
    }
    wakeRef.current = null;
    setWake('off');
  }, []);

  useEffect(() => {
    const onVis = () => {
      setHidden(document.hidden);
      if (document.hidden && runningRef.current && Date.now() - hiddenLogAt.current > 60000) {
        hiddenLogAt.current = Date.now();
        log('TAB HIDDEN while rendering: the browser may throttle or stall the render. Bring this tab to the front.', 'warn');
      }
      if (!document.hidden && runningRef.current) acquireWake();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [acquireWake, log]);

  // clock for elapsed / ETA
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // ---- folder -------------------------------------------------------------------------------------------------------
  const scan = useCallback(async (root: Any, p: Plan[], compName: string, tot: number, sz: number) => {
    const chunks = await root.getDirectoryHandle('chunks', {create: true});
    const m = await readManifest(chunks);
    const ok = new Set<number>();
    let mismatch: string | null = null;
    if (m) {
      if (m.composition !== compName || m.totalFrames !== tot || m.chunkSize !== sz) {
        mismatch = `Existing chunks were made with different settings (${m.composition}, ${m.totalFrames} frames, chunk ${m.chunkSize}). Delete the folder "${root.name}/chunks" (or pick another folder) to start fresh.`;
      } else {
        for (const c of m.chunks) {
          const pl = p.find((x) => x.n === c.n);
          if (!pl || pl.start !== c.start || pl.end !== c.end) continue;
          try {
            const f = await (await chunks.getFileHandle(c.file)).getFile();
            if (f.size === c.bytes && f.size > 0) ok.add(c.n);
          } catch {
            /* file missing: will be re-rendered */
          }
        }
      }
    }
    return {chunks, manifest: m, ok, mismatch};
  }, []);

  const adoptFolder = useCallback((h: Any, name: string) => {
    setDir(h);
    setDirLabel(name);
    setOutName(name);
    setError(null);
  }, []);

  useEffect(() => {
    if (!pickerUsable()) return;
    loadHandle().then((h) => setSavedHandle(h));
  }, []);

  // refresh the done list / resume message when folder or settings change
  useEffect(() => {
    (async () => {
      if (!dir || !comp || !valid || runningRef.current) return;
      try {
        const s = await scan(dir, plan, comp.id, total, size);
        setDone(s.ok);
        if (s.mismatch) fail(s.mismatch);
        else {
          setError(null);
          const first = plan.find((c) => !s.ok.has(c.n));
          if (s.ok.size === 0) setStatus(`Ready: ${plan.length} chunks of ${size} frames. Press Start.`);
          else if (first) setStatus(`${s.ok.size} chunk(s) already saved. Press Resume: it continues from chunk ${first.n} of ${plan.length}.`);
          else setStatus(`All ${plan.length} chunks are already saved. Run in the terminal: npm run join`);
        }
      } catch (e) {
        fail(`Cannot read the folder: ${(e as Error).message}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, compId, totalStr, sizeStr]);

  const pickFolder = useCallback(async () => {
    setError(null);
    try {
      const h = await (window as Any).showDirectoryPicker({id: 'chunk-render', mode: 'readwrite'});
      await saveHandle(h);
      setSavedHandle(h);
      adoptFolder(h, h.name);
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus('Folder pick cancelled.');
      else fail(`The folder picker failed: ${(e as Error).message}. Open this page in Chrome.`);
    }
  }, [adoptFolder, fail]);

  const useSaved = useCallback(async () => {
    if (!savedHandle) return;
    try {
      let perm = await savedHandle.queryPermission({mode: 'readwrite'});
      if (perm !== 'granted') perm = await savedHandle.requestPermission({mode: 'readwrite'});
      if (perm !== 'granted') return fail('Permission to use the saved folder was not granted. Press Pick folder.');
      adoptFolder(savedHandle, savedHandle.name);
    } catch (e) {
      fail(`The saved folder cannot be used (${(e as Error).message}). Press Pick folder.`);
    }
  }, [savedHandle, adoptFolder, fail]);

  const useTestFolder = useCallback(async () => {
    const root = await (navigator.storage as Any).getDirectory();
    const h = await root.getDirectoryHandle('TEST_FOLDER', {create: true});
    adoptFolder(h, 'TEST_FOLDER (browser-private test folder, not on your disk)');
    setOutName('TEST_FOLDER');
  }, [adoptFolder]);

  // ---- the render loop ------------------------------------------------------------------------------------------------
  const start = useCallback(async () => {
    if (runningRef.current) return;
    // instant feedback, before anything async
    setError(null);
    setFailed(0);
    setStatus('Starting...');
    log('Start pressed');
    if (!comp || !valid) return fail('Composition or frame settings are not valid.');
    if (!dir) return fail('Pick the folder first.');
    runningRef.current = true;
    stopRef.current = false;
    setRunning(true);
    setStartedAt(Date.now());
    wakeWarned.current = false;
    setNow(Date.now());
    setCurFrames(0);
    window.onbeforeunload = () => 'A chunk render is running. Leave anyway?';
    await acquireWake();

    const output = `${outName || dirLabel || 'video'}_silent.mp4`;
    let manifest: Manifest = {version: 1, composition: comp.id, output, totalFrames: total, chunkSize: size, fps: comp.fps, width: comp.width, height: comp.height, chunks: []};
    let okSet = new Set<number>();
    try {
      setStatus('Reading the folder...');
      const s = await scan(dir, plan, comp.id, total, size);
      if (s.mismatch) throw new Error(s.mismatch);
      const chunksDir = s.chunks;
      okSet = s.ok;
      if (s.manifest) manifest = {...s.manifest, output, chunks: s.manifest.chunks.filter((c) => okSet.has(c.n))};
      setDone(new Set(okSet));
      baseFramesRef.current = plan.filter((c) => okSet.has(c.n)).reduce((a, c) => a + c.frames, 0);

      const todo = plan.filter((c) => !okSet.has(c.n));
      if (todo.length === 0) {
        setStatus(`All ${plan.length} chunks are already saved. Run in the terminal: npm run join`);
        return;
      }
      if (okSet.size > 0) log(`Resuming from chunk ${todo[0].n} of ${plan.length} (${okSet.size} already saved, skipped)`);
      else log(`Starting: ${plan.length} chunks of ${size} frames, ${comp.id}, ${total} frames`);

      for (const c of todo) {
        if (stopRef.current) break;
        setCurrent(c.n);
        setCurFrames(0);
        const header = okSet.size > 0 && c.n === todo[0].n ? `Resuming from chunk ${c.n}. ` : '';
        setStatus(`${header}Rendering chunk ${c.n} of ${plan.length}, frame 0 of ${c.frames} (video frames ${c.start} to ${c.end}). The first frame can take a while: the scene is being built.`);
        log(`chunk ${pad(c.n)}: video frames ${c.start}-${c.end} (${c.frames}) start`);
        const gpuFrom = ((window as Any).__gpuLog ?? []).length;
        const tc = Date.now();

        let blob: Blob | null = null;
        for (let attempt = 0; ; attempt++) {
          const ac = new AbortController();
          abortRef.current = ac;
          try {
            const {getBlob} = await renderMediaOnWeb({
              composition: {
                id: comp.id,
                component: comp.component,
                width: comp.width,
                height: comp.height,
                fps: comp.fps,
                durationInFrames: comp.durationInFrames,
                defaultProps: comp.defaultProps,
                calculateMetadata: comp.calculateMetadata ?? undefined,
              },
              inputProps: comp.defaultProps ?? {},
              frameRange: [c.start, c.end],
              container: 'mp4',
              videoBitrate: 'high', // same defaults as Studio's client-side render dialog
              keyframeIntervalInSeconds: 5,
              hardwareAcceleration: 'no-preference',
              pageResponsiveness: 'medium',
              delayRenderTimeoutInMilliseconds: 30000,
              scale: 1,
              muted: true, // Silent compositions have no audio; audio is added in editing
              logLevel: 'info',
              outputTarget: null,
              signal: ac.signal,
              onProgress: (p: Any) => {
                const f = Math.min(c.frames, Math.max(p.renderedFrames ?? 0, p.encodedFrames ?? 0));
                setCurFrames(f);
                setStatus(`Rendering chunk ${c.n} of ${plan.length}, frame ${f} of ${c.frames}`);
              },
            } as Any);
            setStatus(`Chunk ${c.n} of ${plan.length}: finishing the file...`);
            blob = await getBlob();
            break;
          } catch (e) {
            if (stopRef.current) throw new Error('Stopped by you.');
            log(`chunk ${pad(c.n)} failed (attempt ${attempt + 1}): ${(e as Error).message}`, 'error');
            if (attempt >= RETRIES) {
              setFailed(c.n);
              throw new Error(`Chunk ${c.n} failed twice: ${(e as Error).message}. Reload this tab, then press Resume: it continues at chunk ${c.n}.`);
            }
            setStatus(`Chunk ${c.n} failed once, retrying in 6 s: ${(e as Error).message}`);
            await sleep(6000);
            setCurFrames(0);
          }
        }

        setStatus(`Saving chunk ${c.n} of ${plan.length} to ${dirLabel}/chunks ...`);
        const bytes = await writeFile(chunksDir, chunkFile(c.n), blob);
        if (bytes !== blob.size) throw new Error(`Saved file size ${bytes} differs from the render ${blob.size}. Disk full?`);
        manifest.chunks = [...manifest.chunks.filter((x) => x.n !== c.n), {n: c.n, file: chunkFile(c.n), start: c.start, end: c.end, frames: c.frames, bytes, doneAt: new Date().toISOString()}].sort((a, b) => a.n - b.n);
        await writeFile(chunksDir, 'manifest.json', JSON.stringify(manifest, null, 2));
        okSet.add(c.n);
        setDone(new Set(okSet));
        setCurFrames(c.frames);
        log(`chunk ${pad(c.n)} saved: ${chunkFile(c.n)}, ${(bytes / 1048576).toFixed(2)} MB, ${((Date.now() - tc) / 1000).toFixed(0)} s`);
        blob = null; // drop the reference so the buffer can be collected

        // Free GPU / three.js memory between chunks: the renderer has unmounted this chunk's canvas (R3F disposes the
        // renderer and loses the context). Wait, nudge the GC where the browser allows it, and log the numbers.
        const last = c.n === todo[todo.length - 1].n;
        setStatus(last ? `Chunk ${c.n} saved.` : `Chunk ${c.n} saved. Pausing ${PAUSE_MS / 1000} s to release GPU memory before chunk ${c.n + 1}...`);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await sleep(PAUSE_MS);
        try {
          (window as Any).gc?.(); // only exists when Chrome runs with --js-flags=--expose-gc; harmless otherwise
        } catch {
          /* ignore */
        }
        const g = gpuSummary(gpuFrom);
        console.info('[gpu] chunk', JSON.stringify({chunk: c.n, ...g}));
        log(`[gpu] chunk ${pad(c.n)}: ${JSON.stringify(g)}`);
      }

      if (stopRef.current) setStatus('Stopped. Press Resume to continue from the first missing chunk.');
      else if (okSet.size >= plan.length) setStatus(`DONE: all ${plan.length} chunks saved in ${dirLabel}/chunks. Now run in the terminal: npm run join`);
    } catch (e) {
      fail((e as Error).message);
      setStatus('Stopped because of the error above.');
    } finally {
      window.onbeforeunload = null;
      runningRef.current = false;
      setRunning(false);
      await releaseWake();
    }
  }, [comp, valid, dir, dirLabel, plan, total, size, outName, scan, log, fail, acquireWake, releaseWake]);

  const stop = () => {
    stopRef.current = true;
    abortRef.current?.abort();
    setStatus('Stopping...');
  };

  useEffect(() => {
    try {
      if (compId !== 'ChunkSelfTest') localStorage.setItem('chunkRender2.comp', compId);
    } catch {
      /* ignore */
    }
  }, [compId]);

  // ---- numbers ------------------------------------------------------------------------------------------------------------
  const framesDoneSaved = plan.filter((c) => done.has(c.n)).reduce((a, c) => a + c.frames, 0);
  const curPlan = plan.find((c) => c.n === current);
  const inProgress = running && curPlan && !done.has(curPlan.n) ? curFrames : 0;
  const overall = total > 0 ? (framesDoneSaved + inProgress) / total : 0;
  const curPct = curPlan && running ? curFrames / curPlan.frames : 0;
  const elapsed = running ? (now - startedAt) / 1000 : 0;
  const runFrames = framesDoneSaved + inProgress - baseFramesRef.current;
  const eta = running && runFrames > 0 ? (elapsed / runFrames) * (total - framesDoneSaved - inProgress) : null;

  // tab title = percentage, so it can be read from another window
  const origTitle = useRef(typeof document !== 'undefined' ? document.title : '');
  useEffect(() => {
    if (!running) return;
    const set = () => (document.title = `${Math.round(overall * 100)}% ${compId}`);
    set();
    const id = setInterval(set, 1000); // Studio rewrites the title now and then; set it again
    return () => {
      clearInterval(id);
      document.title = origTitle.current;
    };
  }, [running, overall, compId]);

  const chunkColor = (n: number) => (failed === n ? C.bad : done.has(n) ? C.ok : running && n === current ? C.accent : C.grey);
  const canStart = usable && !running && valid && !!dir;
  const resumeLabel = done.size > 0 && done.size < plan.length;

  return createPortal(
    <div style={{position: 'fixed', inset: 0, zIndex: 2147483000, background: C.bg, color: C.text, overflowY: 'auto', fontFamily: '-apple-system, system-ui, sans-serif'}}>
      <div style={{maxWidth: 840, margin: '0 auto', padding: '24px 20px 60px'}}>
        <h1 style={{fontSize: 26, margin: '0 0 4px'}}>Chunk render</h1>
        <div style={{color: C.dim, marginBottom: 14, fontSize: 14}}>Automatic, resumable client-side render (same renderer as Studio). Chunks are saved as chunk_001.mp4, chunk_002.mp4, ...</div>

        {!usable && (
          <div style={{...box, background: '#3a1416', borderColor: C.bad, color: '#ffb4b4', fontSize: 20, fontWeight: 700}}>
            Open this page in Chrome.
            <div style={{fontSize: 14, fontWeight: 400, marginTop: 6}}>This browser (for example the Claude in-app pane) cannot pick a folder to save into. Copy the address into desktop Chrome.</div>
          </div>
        )}

        {error && (
          <div style={{...box, background: '#3a1416', borderColor: C.bad, color: '#ffb4b4', fontWeight: 600, whiteSpace: 'pre-wrap'}}>ERROR: {error}</div>
        )}

        <div style={{...box, borderColor: hidden ? C.bad : C.warn, background: hidden ? '#3a1416' : '#2a2412', fontWeight: 600}}>
          {hidden ? 'THIS TAB IS HIDDEN. Rendering is being throttled. Bring this tab to the front now.' : 'Keep this tab VISIBLE and in front for the whole render. Do not switch tabs or minimise the window.'}
          <div style={{fontWeight: 400, fontSize: 13, marginTop: 4, color: C.dim}}>
            Screen wake lock: {wake === 'on' ? 'active (the Mac will not sleep)' : wake === 'unsupported' ? 'NOT supported here: set the Mac to never sleep' : wake === 'failed' ? 'FAILED: set the Mac to never sleep' : 'requested when you press Start'}
          </div>
        </div>

        <div style={box}>
          <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12}}>
            <label style={{fontSize: 13, color: C.dim}}>
              Composition name
              <select style={inputStyle} value={compId} disabled={running} onChange={(e) => setCompId(e.target.value)}>
                {comps.length === 0 && <option value={compId}>{compId}</option>}
                {comps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </label>
            <label style={{fontSize: 13, color: C.dim}}>
              Total frames
              <input style={inputStyle} value={totalStr} disabled={running} onChange={(e) => setTotalStr(e.target.value)} inputMode="numeric" />
            </label>
            <label style={{fontSize: 13, color: C.dim}}>
              Chunk size
              <input style={inputStyle} value={sizeStr} disabled={running} onChange={(e) => setSizeStr(e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <div style={{fontSize: 13, color: C.dim, marginTop: 8}}>
            {comp ? `${comp.width}x${comp.height}, ${comp.fps} fps, composition length ${comp.durationInFrames} frames` : `Composition "${compId}" not found in Studio.`}
            {comp && total > comp.durationInFrames ? <span style={{color: C.bad}}>  Total is longer than the composition.</span> : null}
            {plan.length > 0 ? `  ->  ${plan.length} chunks` : ''}
          </div>
        </div>

        <div style={box}>
          <div style={{fontSize: 13, color: C.dim, marginBottom: 8}}>Output folder: the video's folder (e.g. COBRA_EFFECT). Chunks go into its "chunks" subfolder.</div>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'}}>
            <button style={btn(!dir, running || !usable)} disabled={running || !usable} onClick={pickFolder}>
              Pick folder
            </button>
            {savedHandle && !dir && usable && (
              <button style={btn(false, running)} disabled={running} onClick={useSaved}>
                Use saved: {savedHandle.name}
              </button>
            )}
            {isTestMode() && (
              <button style={btn(false, running)} disabled={running} onClick={useTestFolder}>
                TEST: use browser-private folder
              </button>
            )}
          </div>
          <div style={{marginTop: 10, fontSize: 18, fontWeight: 700, color: dir ? C.ok : C.warn}}>{dir ? `Folder: ${dirLabel}` : 'Pick the folder first'}</div>
          {dir && (
            <label style={{fontSize: 13, color: C.dim, display: 'block', marginTop: 8}}>
              Joined file name: <b style={{color: C.text}}>{(outName || dirLabel) + '_silent.mp4'}</b>
            </label>
          )}
        </div>

        <div style={box}>
          <div style={{display: 'flex', gap: 10, marginBottom: 12}}>
            <button style={btn(true, !canStart)} disabled={!canStart} onClick={start}>
              {resumeLabel ? 'Resume' : 'Start'}
            </button>
            <button style={btn(false, !running)} disabled={!running} onClick={stop}>
              Stop
            </button>
          </div>
          {!dir && usable && <div style={{color: C.warn, fontWeight: 600, marginBottom: 8}}>Start is disabled: pick the folder first.</div>}
          <div style={{fontSize: 17, fontWeight: 600, marginBottom: 12, color: error ? C.bad : C.text}}>{status}</div>

          <div style={{fontSize: 13, color: C.dim, marginBottom: 4}}>
            Overall: {Math.round(framesDoneSaved + inProgress)} of {total} frames
          </div>
          <Bar value={overall} h={32} />
          <div style={{display: 'flex', gap: 24, fontSize: 14, margin: '8px 0 14px', color: C.dim}}>
            <span>Elapsed: <b style={{color: C.text}}>{running ? fmtT(elapsed) : '-'}</b></span>
            <span>Remaining: <b style={{color: C.text}}>{eta != null ? '~' + fmtT(eta) : running ? 'calculating...' : '-'}</b></span>
          </div>

          <div style={{fontSize: 13, color: C.dim, marginBottom: 4}}>
            {curPlan && running ? `Current chunk ${curPlan.n} of ${plan.length}: frame ${curFrames} of ${curPlan.frames} (video frames ${curPlan.start} to ${curPlan.end})` : 'Current chunk: -'}
          </div>
          <Bar value={curPct} color={C.ok} />

          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14}}>
            {plan.map((c) => (
              <div key={c.n} title={`chunk ${c.n}: frames ${c.start}-${c.end}`} style={{width: 44, height: 34, borderRadius: 6, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: chunkColor(c.n), color: '#fff', fontWeight: 700}}>
                {c.n}
              </div>
            ))}
          </div>
          <div style={{fontSize: 12, color: C.dim, marginTop: 6}}>grey = waiting, blue = rendering, green = done, red = failed</div>
        </div>

        <div style={{...box, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap'}}>
          {logs.length === 0 ? <span style={{color: C.dim}}>Log (also in the browser console, prefixes [chunk] and [gpu])</span> : logs.join('\n')}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// The Studio composition. It draws nothing itself; the page is the portal above.
export const ChunkRender: React.FC = () => <Page />;
export const CR_FPS = 30;
export const CR_FRAMES = 1;
