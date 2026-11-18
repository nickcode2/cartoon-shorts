#!/usr/bin/env python3
"""Chunked client-side rendering helper (chunks of 300 frames).

  python3 scripts/chunks.py <total_frames>              print the frame ranges to enter in Studio
  python3 scripts/chunks.py <total_frames> <name>       same, and show which out/<name>_partNN.mp4 files exist / are missing
  python3 scripts/chunks.py --join <name> [--reencode]  join out/<name>_part*.mp4 into out/<name>.mp4 (stream copy, no quality loss)

Studio's client-side render cannot be driven from a script on this Mac (CLI renders draw blank WebGL), so each chunk is
rendered by hand in Studio: Render > Client-side > Frame range (inclusive start and end), Output name <name>_partNN.
A crash then costs one chunk, not the whole video.
"""
import glob, os, subprocess, sys

CHUNK = 300


def ranges(total):
    return [(i, s, min(s + CHUNK, total) - 1) for i, s in enumerate(range(0, total, CHUNK), 1)]


def main(a):
    if a and a[0] == "--join":
        name = a[1]
        parts = sorted(glob.glob(f"out/{name}_part*.mp4"))
        if not parts:
            sys.exit(f"no out/{name}_part*.mp4 found")
        lst = f"out/{name}_parts.txt"
        open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
        codec = ["-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p"] if "--reencode" in a else ["-c", "copy"]
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, *codec, f"out/{name}.mp4"], check=True)
        os.remove(lst)
        print(f"joined {len(parts)} parts -> out/{name}.mp4  (next: python3 scripts/fix_black_frames.py out/{name}.mp4)")
        return
    if not a:
        sys.exit(__doc__)
    total = int(a[0])
    name = a[1] if len(a) > 1 else None
    print(f"{total} frames -> {len(ranges(total))} chunks of {CHUNK}")
    for i, s, e in ranges(total):
        extra = ""
        if name:
            extra = "  [done]" if os.path.exists(f"out/{name}_part{i:02d}.mp4") else "  [MISSING]"
        print(f"  part{i:02d}: start {s:5d}  end {e:5d}  ({e - s + 1} frames){extra}")


main(sys.argv[1:])
