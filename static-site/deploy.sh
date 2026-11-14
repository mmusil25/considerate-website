#!/usr/bin/env bash
# Publish static-site/ to the Raspberry Pi. Caddy on the Pi imports
# /srv/sites/*/Caddyfile, so a changed Caddyfile here needs a reload (done below).
# videos/ is not in git (two files are 26MB and 73MB); it lives only on the Pi
# and in the PC backups, and --exclude keeps rsync --delete from removing it.
set -euo pipefail
HOST="${PI_HOST:-marksraspi}"
DEST=/opt/sites/consideratesystems
cd "$(dirname "$0")"
if [[ -f LAUNCH_HOLD ]]; then
  echo "Refusing to publish: LAUNCH_HOLD is present." >&2
  cat LAUNCH_HOLD >&2
  exit 1
fi
python3 -I src/build.py
rsync -az --delete --exclude 'videos/' public/ "${HOST}:${DEST}/public/"
rsync -az Caddyfile "${HOST}:${DEST}/Caddyfile"
ssh "$HOST" 'docker exec crm-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
echo "published to https://consideratesystems.com"
