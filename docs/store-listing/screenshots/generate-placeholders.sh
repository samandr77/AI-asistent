#!/usr/bin/env bash
# Generate five placeholder screenshots per device class in App Store / Play
# sizes. Replaces itself once designers hand back real captures.
#
# Requires ImageMagick: `brew install imagemagick`.

set -euo pipefail

cd "$(dirname "$0")"

LABELS=(
  "HOME — Today Top-3"
  "DUMP — Voice recording"
  "RESULT — Parsed tasks"
  "GOALS — Linked to tasks"
  "PAYWALL — Premium benefits"
)

COLORS=("#4F8EF7" "#9B59B6" "#f59e0b" "#10b981" "#ef4444")

# device:size
DEVICES=(
  "ios-69:1320x2868"
  "ios-65:1284x2778"
  "ipad-13:2064x2752"
  "android-phone:1080x1920"
  "android-tablet:1200x1920"
)

for device_spec in "${DEVICES[@]}"; do
  device="${device_spec%%:*}"
  size="${device_spec##*:}"
  mkdir -p "$device"
  for i in 0 1 2 3 4; do
    label="${LABELS[$i]}"
    color="${COLORS[$i]}"
    out="$device/shot-$((i+1)).png"
    magick -size "$size" "xc:$color" \
      -gravity center \
      -fill white \
      -pointsize 80 \
      -annotate 0 "$label" \
      "$out"
    echo "wrote $out"
  done
done
