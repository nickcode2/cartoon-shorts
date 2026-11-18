#!/usr/bin/env python3
"""COBRA_EFFECT audio: synthesises COBRA_EFFECT/sfx.wav and ambience.wav (mono 16-bit 44.1 kHz, exactly videoSec long) from src/cobra/timeline.json."""
import json, wave, os
import numpy as np
from scipy.signal import butter, lfilter
SR = 44100
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(root, 'src/cobra/timeline.json')))
N = int(round(TL['videoSec'] * SR))
rng = np.random.default_rng(7)
def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band'); return lfilter(b, a, x)
def lp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), btype='low'); return lfilter(b, a, x)
def hp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), btype='high'); return lfilter(b, a, x)
def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, k=6.0):
    t = tt(d); return np.minimum(1, t / a) * np.exp(-k * t / d)
def noise(d): return rng.standard_normal(int(d * SR))
def sweep(f0, f1, d):
    t = tt(d); f = f0 + (f1 - f0) * t / d; return np.sin(2 * np.pi * np.cumsum(f) / SR)
def squish(): d = 0.16; return (0.7 * sweep(190, 70, d) + 0.5 * lp(noise(d), 600)) * env(d, 0.004, 7)
def step(): d = 0.09; return (0.5 * sweep(120, 60, d) + 0.25 * lp(noise(d), 900)) * env(d, 0.003, 7)
def hiss(): d = 0.55; t = tt(d); return bp(noise(d), 3500, 9000) * np.sin(np.pi * t / d) ** 1.5 * 0.55
def coin(): d = 0.5; t = tt(d); return (np.sin(2 * np.pi * 2637 * t) + 0.6 * np.sin(2 * np.pi * 3520 * t) + 0.3 * np.sin(2 * np.pi * 5274 * t)) * env(d, 0.001, 9) * 0.35
def stamp(): d = 0.3; return (sweep(95, 38, d) * 0.95 + 0.4 * lp(noise(d), 400)) * env(d, 0.002, 8)
def chatter(): d = 0.9; t = tt(d); m = np.clip(np.sin(2 * np.pi * 5.3 * t + 1.0) * np.sin(2 * np.pi * 8.7 * t), 0, 1); return bp(noise(d), 300, 2200) * (0.25 + 0.75 * m) * np.sin(np.pi * t / d) * 0.5
def whoosh(): d = 0.28; t = tt(d); x = noise(d); y = np.zeros_like(x); c = 400 + 5000 * np.sin(np.pi * t / d)
def whoosh():
    d = 0.28; x = noise(d); half = len(x) // 2
    a = bp(x[:half], 500, 3500); b = bp(x[half:], 300, 2000); y = np.concatenate([a, b]) * np.sin(np.pi * tt(d) / d) ** 1.4; return y * 0.45
def tick(): d = 0.04; return np.sin(2 * np.pi * 1800 * tt(d)) * env(d, 0.0008, 9) * 0.5
def scratch(): d = 0.4; t = tt(d); f = 900 + 500 * np.sin(2 * np.pi * 7 * t); w = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)); return (0.6 * hp(w, 600) + 0.3 * hp(noise(d), 2000)) * np.minimum(1, t / 0.01) * np.exp(-3 * t / d) * 0.6
def boing(): d = 0.45; t = tt(d); f = 320 + 380 * np.exp(-6 * t) + 40 * np.sin(2 * np.pi * 14 * t); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.004, 5) * 0.55
def rumble(): d = 1.2; t = tt(d); return (lp(noise(d), 130, 3) * 1.4 * (0.6 + 0.4 * np.sin(2 * np.pi * 17 * t)) + 0.25 * bp(noise(d), 400, 900) * (rng.random(len(t)) > 0.97)) * np.sin(np.pi * t / d) ** 0.7 * 0.8
def rip(): d = 0.55; t = tt(d); return hp(noise(d), 1500) * (0.4 + 0.6 * (np.sin(2 * np.pi * 63 * t) > 0)) * np.minimum(1, t / 0.01) * np.exp(-2.2 * t / d) * 0.7
KINDS = dict(squish=squish, step=step, hiss=hiss, coin=coin, stamp=stamp, chatter=chatter, tick=tick, scratch=scratch, boing=boing, rumble=rumble, rip=rip)
sfx = np.zeros(N)
def put(buf, x, t):
    i = int(t * SR); x = x[: max(0, len(buf) - i)]; buf[i:i + len(x)] += x
for name, t in TL['cues']: put(sfx, KINDS[name](), t)
for e in TL['entries'][1:]: put(sfx, whoosh(), e['t'] - 0.08)  # quick whoosh on every hard cut
def save(path, x, peak=0.89):
    x = np.tanh(x * 1.1) if np.max(np.abs(x)) > 1 else x; x = x / max(1e-9, np.max(np.abs(x))) * peak
    with wave.open(path, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
# ambience: street hum + birds + distant crowd, quieter room tone in office / garage, crossfaded at the cuts
t = np.arange(N) / SR
street = 0.9 * lp(noise(TL['videoSec']), 380, 3) * 2.2 + 0.35 * bp(noise(TL['videoSec']), 300, 1400) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t)) * 0.9
birds = np.zeros(N)
for i in range(46):
    d = 0.18 + rng.random() * 0.15; tc = rng.random() * (TL['videoSec'] - 1); f0 = 3000 + rng.random() * 1800; ch = np.sin(2 * np.pi * np.cumsum(f0 + 1200 * np.sin(2 * np.pi * 14 * tt(d))) / SR) * np.sin(np.pi * tt(d) / d) * 0.07; put(birds, ch, tc)
street = street + birds
room = 0.35 * np.sin(2 * np.pi * 110 * t) * 0.05 + 0.5 * lp(noise(TL['videoSec']), 220, 2) * 0.35 + 0.02 * hp(noise(TL['videoSec']), 3000)
mask = np.zeros(N)
for i, e in enumerate(TL['entries']):
    a = int(e['t'] * SR); b = int(TL['entries'][i + 1]['t'] * SR) if i + 1 < len(TL['entries']) else N
    if e['amb'] == 'street': mask[a:b] = 1
k = int(0.3 * SR); mask = np.convolve(mask, np.ones(k) / k, mode='same')
amb = street * mask * 0.9 + room * (1 - mask) * 1.0
save(os.path.join(root, 'COBRA_EFFECT/sfx.wav'), sfx, 0.85)
save(os.path.join(root, 'COBRA_EFFECT/ambience.wav'), amb, 0.35)
print('ok', N / SR, 's')
