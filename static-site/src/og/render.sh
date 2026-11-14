#!/usr/bin/env bash
# Renders src/og/og-handyman.html to public/og-handyman.jpg (1200x630) with headless Chromium
# (Playwright's chrome-headless-shell), which writes JPEG when the file name ends in .jpg.
set -euo pipefail
cd "$(dirname "$0")"
CHROME=$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | tail -1)
"$CHROME" --headless --no-sandbox --hide-scrollbars --allow-file-access-from-files --window-size=1200,630 \
  --screenshot="$PWD/../../public/og-handyman.jpg" "file://$PWD/og-handyman.html" 2>/dev/null
echo "wrote public/og-handyman.jpg"
