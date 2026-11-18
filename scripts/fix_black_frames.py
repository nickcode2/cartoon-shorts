#!/usr/bin/env python3
"""Check an MP4 with ffmpeg blackdetect; replace every black frame with the previous frame (same frame count, audio
untouched and in sync) and save <name>_fixed.mp4 next to it.   usage: fix_black_frames.py out/video.mp4"""
import re, subprocess, sys, os

src = sys.argv[1]
dst = os.path.splitext(src)[0] + "_fixed.mp4"
info = subprocess.run(["ffmpeg", "-hide_banner", "-i", src], capture_output=True, text=True).stderr  # no ffprobe needed
m = re.search(r"Video:.*?,\s*([\d.]+) fps", info)
fps = float(m.group(1)) if m else 30.0
# near-pure black only (pixel threshold 0.04), >= 98% of the picture, any duration (one frame is enough)
log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-an", "-vf", "blackdetect=d=0:pic_th=0.98:pix_th=0.04", "-f", "null", "-"], capture_output=True, text=True).stderr
ranges = []
for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", log):
    a, b = round(float(m.group(1)) * fps), round(float(m.group(2)) * fps) - 1
    ranges.append((a, max(a, b)))
print(f"{src}: {len(ranges)} black range(s) at {fps:g} fps:", ranges or "none")
if not ranges:
    sys.exit(0)
# freezeframes takes (video, replacement video): feed it two copies of the stream, once per black range
chain, cur = [], "0:v"
for i, (a, b) in enumerate(ranges):
    rep = a - 1 if a > 0 else b + 1  # previous frame (the next one if the video starts black)
    chain.append(f"[{cur}]split[s{i}a][s{i}b];[s{i}a][s{i}b]freezeframes=first={a}:last={b}:replace={rep}[v{i}]")
    cur = f"v{i}"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-filter_complex", ";".join(chain), "-map", f"[{cur}]", "-map", "0:a?", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", dst], check=True)
print("saved", dst)
