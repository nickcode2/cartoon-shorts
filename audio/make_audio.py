"""Mix for the crisis short: clean voice + synthesized SFX + light tense music, music/ambience ducked under the voice.
Built on the cartoon-3d-short audio kit (dsp.py, instruments.py, sfx_gen.py in audio/lib). All times are seconds on
audio/voiceover_clean.mp3 (picture is 2112 frames at 30 fps = 70.4 s)."""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import numpy as np
from scipy import signal
from scipy.ndimage import uniform_filter1d

import instruments as I
import sfx_gen as G
from dsp import (SR, TAU, bp, colored, dbg, fades, hp, integrated, lp, make_ir, convolve_st, modal, ns, phase, place, read_wav, rng,
                 smooth_noise, st, tt, write_wav)

ROOT = os.path.dirname(HERE)
DUR = 2112 / 30.0
N = ns(DUR)
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- voice
wav = os.path.join(OUT, "voice.wav")
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(HERE, "voiceover_clean.mp3"), "-ar", str(SR), "-ac", "1", wav], check=True)
v, _ = read_wav(wav)
v = v[0]
voice = np.zeros(N)
voice[: min(N, len(v))] = v[:N]
voice *= dbg(-3.0) / (np.max(np.abs(voice)) + 1e-9)

# speech envelope -> ducking curve (1 = fully ducked)
frame = ns(0.02)
rms = np.sqrt(uniform_filter1d(voice ** 2, frame))
speech = (rms > 10 ** (-42 / 20)).astype(float)
speech = uniform_filter1d(speech, ns(0.25))  # bridge small gaps
speech = (speech > 0.3).astype(float)
att, rel = 0.07, 0.45
duck = np.zeros(N)
a_c, r_c = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
z = 0.0
for i in range(N):  # one-pole attack/release follower
    x = speech[i]
    z = x + (z - x) * (a_c if x > z else r_c)
    duck[i] = z

# ---------------------------------------------------------------- buses
SFX = np.zeros((2, N))
AMB = np.zeros((2, N))
MUS = np.zeros((2, N))
_seed = [100]


def R():
    _seed[0] += 1
    return rng(_seed[0])


def put(bus, t, x, db=0.0, p=0.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        th = (float(np.clip(p, -1, 1)) + 1) * np.pi / 4
        x = np.stack([x * np.cos(th), x * np.sin(th)]) * np.sqrt(2)
    place(bus, x, t, dbg(db))


def nrm(x, peak=1.0):
    return x / (np.max(np.abs(x)) + 1e-12) * peak


def env_seg(n, a, d):
    e = np.ones(n)
    na, nd = ns(a), ns(d)
    if na > 0:
        e[:na] = np.linspace(0, 1, na)
    if nd > 0:
        e[-nd:] *= np.linspace(1, 0, nd)
    return e


# ---------------------------------------------------------------- generators
def thud(r, f=90.0, dur=0.22, noise=0.25, f_noise=900.0):
    t = tt(dur)
    y = np.sin(phase(f * (1 + 0.6 * np.exp(-t / 0.02)))) * np.exp(-t / (dur / 5))
    y += noise * lp(r.standard_normal(len(t)), f_noise) * np.exp(-t / 0.02)
    return fades(y, 0.001, 0.02)


def click(r, f=3000.0, dur=0.02):
    t = tt(dur)
    return hp(r.standard_normal(len(t)), f) * np.exp(-t / 0.003)


def beep(f=1760.0, dur=0.11, vol=0.8):
    t = tt(dur)
    y = (np.sin(TAU * f * t) + 0.35 * np.sin(TAU * 2 * f * t)) * np.exp(-t / 0.2) * env_seg(len(t), 0.002, 0.02)
    return y * vol


def metal_clunk(r, f0=300.0):
    y = modal(0.35, [(f0, 1, 0.07), (f0 * 2.7, 0.6, 0.05), (f0 * 5.1, 0.35, 0.03), (f0 * 8.3, 0.2, 0.02)], r)
    y[: ns(0.02)] += thud(r, 120, 0.02)[: ns(0.02)]
    return fades(y, 0.0005, 0.05)


def rustle(dur, r, dens=90.0, lo=1800, hi=9000, shape_pts=None):
    n = ns(dur)
    t = np.arange(n) / SR
    base = bp(r.standard_normal(n), lo, hi, 1) * 0.25
    m = np.zeros(n)
    for tm in r.uniform(0, dur, int(dens * dur)):
        k = ns(tm)
        L = ns(r.uniform(0.004, 0.02))
        m[k:k + L] += r.uniform(0.3, 1.0) * np.exp(-np.arange(min(L, n - k)) / (L / 3))
    am = smooth_noise(n, r, 9.0)
    y = (base * (0.4 + 0.6 * np.abs(am)) + hp(r.standard_normal(n), 2500) * m * 0.9)
    e = np.interp(t, *(zip(*shape_pts))) if shape_pts else np.ones(n)
    return fades(y * e, 0.01, 0.06)


def laugh(r, hits=6, f0=165.0):
    out = np.zeros(ns(0.17 * hits + 0.35))
    forms = [(730, 90), (1090, 110), (2440, 160)]
    for k in range(hits):
        dur = 0.14 if k < hits - 1 else 0.28
        n = ns(dur)
        t = np.arange(n) / SR
        f = f0 * (1.18 - 0.05 * k) * (1 + 0.04 * np.sin(TAU * 6 * t)) * (1.05 - 0.2 * t / dur)
        src = np.zeros(n)
        ph = phase(f)
        for h in range(1, 26):
            src += np.sin(h * ph) / h ** 1.1
        y = np.zeros(n)
        for fc, bw in forms:
            y += signal.sosfilt(signal.butter(2, [max(fc - bw, 60), fc + bw], btype="band", fs=SR, output="sos"), src)
        y += 0.25 * hp(r.standard_normal(n), 1500) * np.exp(-t / 0.03)
        e = np.exp(-t / (dur * 0.55)) * env_seg(n, 0.012, 0.03) * (0.95 ** k)
        _ = out
        i = ns(0.17 * k)
        out[i:i + n] += y * e / (np.max(np.abs(y)) + 1e-9)
    return out


def sting(r):
    n = ns(1.4)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, g in [(440.0, 1.0), (466.2, 0.9), (220.0, 0.8), (880.0, 0.3)]:
        ph = phase(np.full(n, f) * (1 + 0.004 * np.sin(TAU * 5 * t)))
        for h in range(1, 12):
            y += g * np.sin(h * ph) / h ** 1.2
    y = lp(y, 2600) * np.exp(-t / 0.45) * env_seg(n, 0.004, 0.2)
    y += 1.3 * np.sin(phase(55 * (1 + 0.4 * np.exp(-t / 0.05)))) * np.exp(-t / 0.35)
    y += 0.5 * hp(r.standard_normal(n), 3000) * np.exp(-t / 0.05)
    return nrm(y)


def ping(f=1500.0, dur=0.09):
    t = tt(dur)
    return np.sin(TAU * f * t) * np.exp(-t / 0.025) * env_seg(len(t), 0.001, 0.01) * 0.6


def zipper(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    rate = 70 + 30 * t / dur
    ph = np.cumsum(rate) / SR
    imp = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * r.uniform(0.6, 1.0, n)
    y = signal.sosfilt(signal.butter(2, [2200, 7000], btype="band", fs=SR, output="sos"), imp)
    y = signal.sosfilt(signal.butter(2, [3000, 3600], btype="band", fs=SR, output="sos"), y) * 2 + y
    return fades(nrm(y), 0.02, 0.03)


def power_down(dur, r, f_start=120.0):
    n = ns(dur)
    t = np.arange(n) / SR
    f = 25 + (f_start - 25) * np.exp(-3.4 * t / dur)
    ph = phase(f)
    y = np.zeros(n)
    for h in range(1, 9):
        y += np.sin(h * ph + h) / h ** 1.3
    y = lp(y, 900) * np.exp(-1.8 * t / dur) * env_seg(n, 0.01, 0.15)
    y += 0.25 * lp(r.standard_normal(n), 2500) * np.exp(-6 * t / dur)
    return nrm(y)


def buzz(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.sign(np.sin(TAU * 100 * t)) * 0.4 + np.sin(TAU * 200 * t) * 0.3 + 0.4 * hp(r.standard_normal(n), 2000) * (np.sin(TAU * 11 * t) > 0)
    return lp(y, 3000) * env_seg(n, 0.01, 0.05)


def siren_pass(dur, t_pass, speed=12.0, d=7.0, r=None, wail=(650, 1250), period=1.4):
    """doppler siren passing a listener: returns stereo (L->R pan, gain peak at t_pass)"""
    n = ns(dur)
    t = np.arange(n) / SR
    x = speed * (t - t_pass)
    dist = np.sqrt(x ** 2 + d ** 2)
    vr = speed * x / dist
    dop = 1 / (1 + 2.5 * vr / 343.0)
    u = (t / period) % 1.0
    f = wail[0] + (wail[1] - wail[0]) * (1 - np.abs(2 * u - 1))
    ph = phase(f * dop)
    y = np.zeros(n)
    for h in range(1, 7):
        y += np.sin(h * ph) / h ** 1.4
    y = lp(y, 3200)
    g = (d / dist) ** 1.1
    pn = np.clip(x / 8.0, -1, 1) * 0.9
    thL, thR = (pn * -1 + 1) * 0.5, (pn + 1) * 0.5
    out = np.stack([y * g * np.sqrt(thL), y * g * np.sqrt(thR)])
    return fades(out * 0.8, 0.05, 0.1)


def engine(dur, rpm, r):
    n = ns(dur)
    tt_ = np.arange(n) / SR
    f = np.interp(tt_, np.linspace(0, dur, len(rpm)), np.asarray(rpm, float)) / 30.0  # firing frequency
    ph = phase(f)
    y = np.zeros(n)
    for h in range(1, 13):
        y += np.sin(h * ph + h * 0.4) / h ** 0.9
    y = lp(y + lp(r.standard_normal(n), 400) * 0.5, 1800.0)
    return fades(nrm(y), 0.03, 0.08)


def starter(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.sign(np.sin(TAU * 11 * t)) * 0.3 + 0.5 * np.sin(TAU * 60 * t)
    y += 0.3 * lp(r.standard_normal(n), 1200) * (np.sin(TAU * 11 * t) > 0.2)
    return fades(lp(y, 1500), 0.01, 0.05)


def wind(dur, r, level=1.0, bright=700):
    return G.breeze(dur, r, level, 0.2, bright)


def rain(dur, r):
    n = ns(dur)
    y = hp(colored(n, r, 0.2), 2500) * 0.35 + bp(colored(n, r, 0.8), 500, 2500, 1) * 0.1
    return np.stack([y, np.roll(y, 37)])


def crackle(dur, r, dens=45.0):
    n = ns(dur)
    y = lp(colored(n, r, 2.0), 300) * 0.8 + hp(colored(n, r, 0.5), 1200) * 0.08
    for tm in r.uniform(0, dur, int(dens * dur)):
        k = ns(tm)
        L = ns(r.uniform(0.004, 0.03))
        c = r.standard_normal(min(L, n - k)) * np.exp(-np.arange(min(L, n - k)) / (L / 4))
        y[k:k + len(c)] += hp(c, 1800 * 1.0) * r.uniform(0.3, 1.4) if len(c) > 8 else 0
    return np.stack([y, np.roll(y, 23)])


def padsum(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def footstep(r, hard=1.0, tone=140.0):
    return padsum(thud(r, tone * r.uniform(0.85, 1.2), 0.12, 0.35 * hard, 2200) * 0.8, click(r, 2500, 0.012) * 0.35 * hard)


def room(dur, r, level=1.0, f=90.0):
    n = ns(dur)
    y = lp(colored(n, r, 1.5), 400) * 0.2 + np.sin(TAU * f * np.arange(n) / SR) * 0.05
    return np.stack([y, np.roll(y, 11)]) * level


def thunder(r, dur=2.0):
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 2.0), 160) * np.exp(-t / 0.9)
    y += bp(colored(n, r, 1.0), 200, 900, 1) * np.exp(-t / 0.5) * 0.5 * (1 + 0.6 * np.sin(TAU * 7 * t))
    y[: ns(0.04)] += hp(r.standard_normal(ns(0.04)), 800) * 1.2
    return fades(nrm(y), 0.002, 0.3)


def drip(r, f=1100.0):
    t = tt(0.16)
    y = np.sin(phase(f * (1 + 2.2 * t))) * np.exp(-t / 0.03)
    return y * env_seg(len(t), 0.001, 0.02) * 0.8


# ================================================================ AMBIENCE (bed per location)
def amb_seg(t0, t1, gen, db=0.0, fi=0.35, fo=0.35):
    n = ns(t1 - t0)
    x = np.asarray(gen(t1 - t0), float)
    x = x[:, :n] if x.ndim == 2 else np.stack([x[:n], x[:n]])
    e = np.ones(x.shape[1])
    a, b = min(ns(fi), len(e)), min(ns(fo), len(e))
    e[:a] = np.linspace(0, 1, a)
    e[len(e) - b:] *= np.linspace(1, 0, b)
    place(AMB, x * e, t0, dbg(db))


def market(d):
    r = R()
    n = ns(d)
    mur = bp(colored(n, r, 1.0), 200, 1800, 1) * (0.5 + 0.5 * np.abs(smooth_noise(n, r, 1.2)))
    hum = np.sin(TAU * 60 * np.arange(n) / SR) * 0.1 + lp(colored(n, r, 1.5), 300) * 0.15
    y = mur * 0.35 + hum
    return np.stack([y, np.roll(y, 29)])


amb_seg(0.0, 6.9, market, -16, 0.3, 0.6)
amb_seg(6.3, 15.8, lambda d: G.breeze(d, R(), 0.35, 0.15, 800) + np.stack([G.bird_chirps(d, R(), 0.6)] * 2) * 0.5, -17, 0.6, 0.5)
amb_seg(24.3, 27.2, lambda d: G.breeze(d, R(), 0.3, 0.15, 900) + np.stack([G.bird_chirps(d, R(), 0.5)] * 2) * 0.4, -18, 0.3, 0.5)
amb_seg(18.6, 24.3, lambda d: room(d, R(), 0.8), -19, 0.5, 0.4)
amb_seg(29.6, 39.4, lambda d: room(d, R(), 0.8), -19, 0.4, 0.4)
amb_seg(37.4, 39.4, lambda d: room(d, R(), 0.8, 110), -19, 0.1, 0.3)
amb_seg(39.2, 41.6, lambda d: wind(d, R(), 1.0, 600) + np.stack([G.crickets(d, R(), 2)] * 2) * 0.25, -20, 0.4, 0.2)
amb_seg(41.4, 43.7, lambda d: rain(d, R()) + wind(d, R(), 1.0, 800), -17, 0.2, 0.3)
amb_seg(43.5, 45.9, lambda d: wind(d, R(), 0.7, 650) + np.stack([G.crickets(d, R(), 2)] * 2) * 0.25, -21, 0.3, 0.3)
amb_seg(47.5, 50.9, lambda d: crackle(d, R(), 70), -17, 0.4, 0.6)
amb_seg(50.8, 56.3, lambda d: room(d, R(), 0.9, 120), -21, 0.3, 0.3)
amb_seg(56.0, 63.8, lambda d: wind(d, R(), 0.9, 500), -21, 0.5, 0.5)
amb_seg(63.6, 67.9, lambda d: room(d, R(), 1.3, 60) + room(d, R(), 0.6, 120), -18, 0.3, 0.2)
amb_seg(67.7, 70.4, lambda d: G.breeze(d, R(), 0.4, 0.2, 800) + np.stack([G.bird_chirps(d, R(), 0.4)] * 2) * 0.3, -19, 0.2, 0.2)

# ================================================================ SFX EVENTS
r = R
# -- shot 1: footsteps on tile
for k, t in enumerate(np.arange(0.45, 2.4, 0.3)):
    put(SFX, t, footstep(r(), 0.7, 170), -9, -0.1 + 0.05 * k)
# -- shot 2: cart, jugs, cans
put(SFX, 2.4, nrm(bp(colored(ns(2.2), r(), 0.5), 400, 3000, 1) * (0.5 + 0.5 * np.abs(smooth_noise(ns(2.2), r(), 6))), 0.5), -10, 0.0)
for t in [3.08, 3.2, 3.33, 3.45]:
    put(SFX, t, thud(r(), 150, 0.15, 0.5, 1800) * 1.2, -4, -0.2)
for k, t in enumerate(np.arange(3.7, 4.5, 0.1)):
    put(SFX, t, G.clink(r(), 1800 + 100 * k, 0.1) * 0.5, -8, 0.3)
# -- shot 3: radio and flashlight on belt, scanner beeps, belt motor
put(SFX, 4.82, thud(r(), 110, 0.18, 0.6, 2000), -4, 0.2)
put(SFX, 5.72, padsum(thud(r(), 140, 0.14, 0.5, 2500), G.rattle(0.15, r(), 40) * 0.3), -6, 0.2)
put(SFX, 5.41, beep(1760), -5, 0.35)
put(SFX, 6.31, beep(1760), -5, 0.35)
put(SFX, 4.6, nrm(lp(colored(ns(1.8), r(), 1.0), 400) * 0.6 + np.sin(TAU * 120 * tt(1.8)) * 0.2, 0.4), -14, 0.3)
# -- shots 4-5: the neighbor laughs
put(SFX, 7.02, laugh(r(), 6, 150), -4, 0.15)
# -- shots 6-7: booklet paper
put(SFX, 10.68, rustle(0.45, r(), 120), -5, 0.0)
put(SFX, 11.55, rustle(0.5, r(), 90, shape_pts=[(0, 0), (0.1, 1), (0.5, 0)]), -8, 0.0)
put(SFX, 12.35, rustle(0.35, r(), 80), -9, 0.0)
# -- map: alert stings and dot pings
put(SFX, 15.5, sting(r()), -6, 0.0)
CITY_AT = [0.25, 0.5, 0.6, 0.8, 0.85, 1.0, 1.15, 1.2, 1.3, 1.45, 1.5, 1.6, 1.8, 1.9, 1.95, 2.05, 2.2, 2.3, 2.4, 2.55]
for k, a in enumerate(CITY_AT):
    put(SFX, 15.3 + a, ping(1100 + 55 * (k % 7)), -17 + min(k, 8) * 0.3, -0.7 + 1.4 * ((k * 5) % 11) / 10)
for t, g in [(33.7, -9), (34.6, -9), (35.4, -9)]:
    put(SFX, t, sting(r()) * 0.7, g, -0.3)
# -- backpack: items drop in, zipper
for t, kind in zip([20.1, 20.5, 20.9, 21.3, 21.7, 22.0], ["bottle", "can", "torch", "radio", "cash", "blanket"]):
    if kind in ("bottle", "radio"):
        put(SFX, t, thud(r(), 110, 0.16, 0.5, 1500), -6, -0.2)
    elif kind in ("can", "torch"):
        put(SFX, t, padsum(G.clink(r(), 1900, 0.1) * 0.5, thud(r(), 140, 0.1, 0.3, 1800) * 0.5), -7, -0.2)
    else:
        put(SFX, t, rustle(0.2, r(), 60, 600, 4000), -9, -0.2)
put(SFX, 23.3, zipper(0.45, r()), -6, 0.0)
put(SFX, 23.76, metal_clunk(r(), 900) * 0.5, -10, 0.0)
# -- shot 13: mailbox clunks, with a toss swish before each
for i in range(7):
    t = 24.36 + 0.15 + i * 0.33
    put(SFX, t - 0.4, G.whoosh(0.4, r(), 0.25, 400, 1800, 0.8, 0.1, 0.1) * 0.35, -9, -0.6 + 1.2 * i / 6)
    put(SFX, t, padsum(metal_clunk(r(), 280 + 20 * i), thud(r(), 100, 0.12, 0.4, 1200) * 0.5), -5, -0.6 + 1.2 * i / 6)
# -- shot 14: booklet cover rustle
put(SFX, 26.95, rustle(0.5, r(), 80, shape_pts=[(0, 0), (0.15, 1), (0.5, 0)]), -9, 0.0)
# -- shot 18: kitchen clock
for k in range(4):
    put(SFX, 37.55 + 0.5 * k, click(r(), 2000, 0.02) * (1.0 if k % 2 == 0 else 0.7), -12, -0.5)
# -- shot 19: city goes dark block by block
for k in range(16):
    t = 40.75 + ((k * 7) % 16) * 0.055
    put(SFX, t, padsum(click(r(), 1500, 0.02) * 0.6, thud(r(), 70, 0.08, 0.2, 800) * 0.4), -14, -0.8 + 1.6 * ((k * 5) % 16) / 15)
put(SFX, 40.7, power_down(1.5, r(), 140), -6, 0.0)
put(SFX, 41.55, thud(r(), 45, 0.8, 0.1, 300) * 1.3, -6, 0.0)
# -- shot 20: thunder
for t in [41.78, 42.38, 42.98]:
    put(SFX, t, thunder(r(), 2.0), -8, 0.0)
# -- shot 21: ambulance passing without stopping (43.56 + 0.8 peak)
put(SFX, 43.56, siren_pass(2.4, 0.95, 11.0, 7.0), -9, 0.0)
# -- shot 22: sirens arrive at the hospital, tires, running steps
put(SFX, 45.84, siren_pass(1.9, 0.75, 12.0, 6.0, wail=(700, 1300), period=1.1), -8, 0.0)
put(SFX, 45.84, siren_pass(1.9, 1.1, 12.0, 7.0, wail=(600, 1100), period=1.7), -11, 0.4)
put(SFX, 46.9, nrm(bp(colored(ns(0.5), r(), 0.5), 1200, 4500, 1), 0.5) * np.exp(-tt(0.5) / 0.25), -10, 0.0)
for k in range(8):
    put(SFX, 46.0 + k * 0.19, footstep(r(), 0.8, 130), -13, -0.4)
# -- shot 23: fire engine, water spray, running steps
put(SFX, 47.6, nrm(hp(colored(ns(1.7), r(), 0.3), 2500), 0.35) * env_seg(ns(1.7), 0.2, 0.3), -9, 0.2)
put(SFX, 47.6, siren_pass(1.7, 1.4, 6.0, 9.0, wail=(500, 900), period=1.2) * 0.6, -13, 0.4)
for k in range(8):
    put(SFX, 47.7 + k * 0.19, footstep(r(), 0.8, 130), -13, -0.3)
# -- shots 25-27: electricity dies in the kitchen, phone dies, tap
put(SFX, 51.86, buzz(0.5, r()), -12, 0.0)
put(SFX, 52.36, power_down(1.3, r(), 110), -6, 0.0)
put(SFX, 52.36, click(r(), 1200, 0.04), -6, 0.0)
put(SFX, 54.5, beep(900, 0.12), -10, 0.3)
put(SFX, 54.9, np.concatenate([beep(880, 0.1), np.zeros(ns(0.04)), beep(660, 0.1), np.zeros(ns(0.04)), beep(440, 0.16)]), -9, 0.3)
put(SFX, 56.12, nrm(lp(colored(ns(0.45), r(), 0.2), 6500) * env_seg(ns(0.45), 0.02, 0.2), 0.5), -8, 0.3)
for k, t in enumerate([0.4, 0.55, 0.62]):
    n_ = ns(0.07 * (k + 1))
    put(SFX, 56.12 + t, nrm(bp(r().standard_normal(n_), 300, 2000, 1) * np.linspace(1, 0, n_), 0.3), -12, 0.3)
for t in [0.73, 1.23, 1.83]:
    put(SFX, 56.12 + t, drip(r(), 1000 + 60 * t), -5, 0.3)
put(SFX, 57.55, nrm(hp(colored(ns(0.4), r(), 0.3), 3000) * env_seg(ns(0.4), 0.05, 0.3), 0.15), -14, 0.3)
# -- shot 30: day-night cycle whooshes
put(SFX, 61.8, G.whoosh(0.9, r(), 0.4, 300, 1500, 1.0, 0.4, 0.1) * 0.5, -9, 0.0)
put(SFX, 62.7, G.whoosh(0.9, r(), 0.4, 300, 1500, 1.0, 0.4, 0.1) * 0.5, -9, 0.0)
# -- shot 32: fridge door creak, hum, empty
put(SFX, 65.62, G.creak(0.75, r(), 70, 125, G.WOOD, [(0, 0), (0.1, 1), (0.8, 0.8), (1, 0)], 0.15, 0.04, 0.8) * 0.8, -6, -0.2)
put(SFX, 65.6, thud(r(), 80, 0.08, 0.5, 1500), -10, -0.2)
put(SFX, 66.8, thud(r(), 50, 1.0, 0.1, 300) * 1.2, -7, 0.0)
# -- shot 33: neighbor dashes to the car and drives off
for k in range(5):
    put(SFX, 68.0 + k * 0.19, footstep(r(), 1.0, 120), -9, 0.0 + 0.1 * k)
put(SFX, 68.79, padsum(click(r(), 1500, 0.03), metal_clunk(r(), 500) * 0.4), -8, 0.4)
put(SFX, 69.1, padsum(thud(r(), 65, 0.2, 0.5, 1500), metal_clunk(r(), 380) * 0.9), -3, 0.4)
put(SFX, 69.12, starter(0.2, r()), -8, 0.4)
rpm = np.concatenate([np.full(8, 900), np.linspace(900, 2200, 12), np.linspace(2200, 3600, 14)])
eng = engine(70.4 - 69.2, rpm, r())
eng_env = np.linspace(1.0, 0.25, len(eng)) ** 1.5
put(SFX, 69.2, eng * eng_env, -4, 0.2)
# -- footfall on shot 1/4 doors etc already covered

# ================================================================ MUSIC (light, tense bed)
chords = [(110.0, 130.8, 164.8), (87.3, 110.0, 130.8), (98.0, 123.5, 146.8), (82.4, 103.8, 123.5)]  # Am F G E (low)
t = 0.0
ci = 0
tn = np.arange(N) / SR
lvl_pts = [(0, 0.35), (6, 0.45), (15, 0.7), (37.5, 0.9), (50, 1.0), (59.7, 1.2), (63.6, 0.5), (67, 0.4), (70.4, 0.25)]
lvl = np.interp(tn, [p[0] for p in lvl_pts], [p[1] for p in lvl_pts])
while t < DUR:
    seg = 4.4 if t < 37 else 3.5
    c = chords[ci % 4]
    pad = I.pad(list(c), seg, vel=0.5, r=R(), att=1.2, rel=1.4, warm=520, detune=6.0)
    put(MUS, t, pad, -6, 0.0)
    # slow bass root
    t += seg
    ci += 1
MUS *= lvl[None, :]
# ticking clock + heartbeat build from "why seventy-two hours" to "three days"
for k, tt_ in enumerate(np.arange(37.5, 63.6, 0.5)):
    g = -26 + 8 * (tt_ - 37.5) / 26
    put(MUS, tt_, click(R(), 2500, 0.015) * 0.9, g, 0.3 if k % 2 else -0.3)
for tt_ in np.arange(39.2, 63.6, 1.0):
    put(MUS, tt_, thud(R(), 52, 0.25, 0.0, 200) * 0.9, -20, 0.0)
    put(MUS, tt_ + 0.22, thud(R(), 48, 0.22, 0.0, 200) * 0.6, -22, 0.0)
# sparse minor motif from the map on
motif = [440.0, 523.3, 659.3, 587.3]
for k, tt_ in enumerate(np.arange(15.5, 63.5, 2.2)):
    put(MUS, tt_, I.pluck(motif[k % 4], 0.5, R(), 1.2, 0.35), -17, -0.4 + 0.8 * (k % 3) / 2)
# the end: low hit and sustained drone
put(MUS, 69.9, thud(R(), 45, 0.5, 0.0, 200) * 0.9, -14, 0.0)

# soft room reverb on the music
IR = make_ir(1.4, 7)
MUS = MUS * 0.7 + convolve_st(MUS, IR) * 0.3

# ================================================================ MIX
def lufs_of(x):
    return integrated(x if x.ndim == 2 else np.stack([x, x]))


v_l = lufs_of(voice)
voice *= dbg(-17.0 - v_l)  # voice at -17 LUFS before the final master gain
bus = np.stack([voice, voice])

duck_db = -8.0
mus_gain = dbg(-21.0) * 10 ** (duck_db * duck / 20.0)[None, :]  # music ducked under the voice
amb_gain = dbg(-3.0) * 10 ** (-6.0 * duck / 20.0)[None, :]
sfx_gain = dbg(-9.5) * 10 ** (-3.0 * duck / 20.0)[None, :]

mus_l = lufs_of(MUS)
MUS *= dbg(-31.0 - mus_l)  # light bed, -14 dB under the voice
mix = bus + MUS * 10 ** (duck_db * duck / 20.0)[None, :] + AMB * amb_gain + SFX * sfx_gain
del mus_gain

# master: normalise to -14 LUFS and soft-limit to -1 dBFS
g = dbg(-14.0 - lufs_of(mix))
mix *= g
peak = np.max(np.abs(mix))
ceil = dbg(-1.0)
k = (ceil / peak) if peak > ceil else 1.0
mix = (mix * k)[:, :N]
write_wav(os.path.join(OUT, "mix.wav"), mix, 24)
# stems: same length as the picture (N samples), same levels as in the mix, so voice + sfx + music sums to mix.wav
STEMS = os.path.join(HERE, "stems")
os.makedirs(STEMS, exist_ok=True)
gk = g * k
write_wav(os.path.join(STEMS, "voice.wav"), (bus * gk)[:, :N], 24)
write_wav(os.path.join(STEMS, "sfx.wav"), ((SFX * sfx_gain + AMB * amb_gain) * gk)[:, :N], 24)  # effects + location ambience
write_wav(os.path.join(STEMS, "music.wav"), (MUS * 10 ** (duck_db * duck / 20.0)[None, :] * gk)[:, :N], 24)  # ducked as in the mix
# raw (un-mastered) mp3; public/mix.mp3 is the loudness-normalised master made from mix.wav with ffmpeg
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(OUT, "mix.wav"), "-c:a", "libmp3lame", "-b:a", "192k", os.path.join(OUT, "mix_raw.mp3")], check=True)
print("mix LUFS %.1f  true-ish peak %.1f dBFS  len %.2f s" % (lufs_of(mix), 20 * np.log10(np.max(np.abs(mix))), mix.shape[1] / SR))
print("voice -17, music bed -31 (ducked -8 under speech), sfx peaks vs voice:", "%.1f dB" % (20 * np.log10(np.max(np.abs(SFX * sfx_gain * g)) / (np.max(np.abs(voice * g)) + 1e-9))))
