#!/usr/bin/env bash
# Encode rendered frames + soundtrack into the pitch MP4, a standalone audio file and a poster.
# Usage: scripts/encode-video.sh <framesDir> <mix.wav> [outDir=public/media]
set -euo pipefail
FRAMES=$1; MIX=$2; OUT=${3:-public/media}
mkdir -p "$OUT"
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i "$FRAMES/f%05d.png" -i "$MIX" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -tune animation \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -t 30 "$OUT/field-shift-30s.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$MIX" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 48000 "$OUT/field-shift-30s-audio.m4a"
ffmpeg -y -hide_banner -loglevel error -i "$FRAMES/f00840.png" -vf scale=1280:-2 -q:v 3 "$OUT/field-shift-poster.jpg"
ls -la "$OUT"
