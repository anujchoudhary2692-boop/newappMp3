#!/usr/bin/env bash
# Export YouTube cookies and print Base64 for Render YOUTUBE_COOKIES_BASE64.
# NEVER commit cookies.txt or cookies.b64.txt — they contain your Google session.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/cookies.txt"
FILTERED="$ROOT/cookies-youtube.txt"
B64="$ROOT/cookies.b64.txt"
BROWSER="${1:-chrome}"
# Single video URL only — do NOT use https://www.youtube.com (downloads hundreds of videos).
PROBE_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "Install yt-dlp first: brew install yt-dlp"
  exit 1
fi

echo "Exporting YouTube cookies from browser: $BROWSER"
echo "(Sign in to YouTube in that browser first.)"
echo "This only writes cookies — no videos are downloaded."
echo ""

yt-dlp \
  --cookies-from-browser "$BROWSER" \
  --cookies "$OUT" \
  --skip-download \
  --no-playlist \
  --no-warnings \
  --no-progress \
  --quiet \
  --ignore-no-formats-error \
  --print "%(id)s" \
  "$PROBE_URL" >/dev/null 2>&1 || true

if [[ ! -s "$OUT" ]]; then
  echo "cookies.txt is empty — export failed."
  exit 1
fi

# Keep YouTube/Google auth cookies only (smaller, safer for Render env var).
{
  grep -E '^#' "$OUT" || true
  grep -E '\.(youtube\.com|google\.com)\t' "$OUT" || true
} > "$FILTERED"

if [[ ! -s "$FILTERED" ]]; then
  echo "No YouTube/Google cookies found — are you signed in to YouTube in $BROWSER?"
  exit 1
fi

mv "$FILTERED" "$OUT"

base64 -i "$OUT" | tr -d '\n' > "$B64"

BYTES="$(wc -c < "$OUT" | tr -d ' ')"
B64LEN="$(wc -c < "$B64" | tr -d ' ')"

echo ""
echo "Created:"
echo "  $OUT ($BYTES bytes)"
echo "  $B64 ($B64LEN chars)"
echo ""
echo "Base64 copied to clipboard (paste into Render → Environment → YOUTUBE_COOKIES_BASE64):"
if command -v pbcopy >/dev/null 2>&1; then
  tr -d '\n' < "$B64" | pbcopy
  echo "  ✓ Copied to clipboard"
else
  cat "$B64"
fi
echo ""
echo "After Render redeploy, verify:"
echo "  curl -s https://newappmp3.onrender.com/api/health | python3 -m json.tool"
echo "  → youtubeCookies: CONFIGURED, playDownload: UP"
echo ""
echo "Do NOT commit cookies.txt or cookies.b64.txt."
