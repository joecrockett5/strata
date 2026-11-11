#!/usr/bin/env bash
# Records the README demo GIF (docs/media/demo.gif) from a freshly seeded e2e stack.
# Needs ffmpeg in addition to the e2e requirements.
source "$(dirname "$0")/lib.sh"
require ffmpeg

STRATA_DEMO=1 "$ROOT/scripts/e2e.sh" tests/readme-demo.spec.ts "$@"

step "Encoding docs/media/demo.gif"
frames="$ROOT/.data/demo-frames"
mkdir -p "$ROOT/docs/media"
# Two-pass palette for clean UI colours; 12 fps keeps the file small without making typing choppy.
filters="fps=12,scale=1200:-1:flags=lanczos"
ffmpeg -loglevel error -y -f concat -i "$frames/frames.ffconcat" \
  -vf "$filters,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$ROOT/docs/media/demo.gif"
du -h "$ROOT/docs/media/demo.gif"
