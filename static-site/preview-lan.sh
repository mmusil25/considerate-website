#!/usr/bin/env bash
# Builds the site and copies it to the Pi's home-network-only preview at
# http://192.168.1.203:8080, served by the handyman stack in /opt/handyman
# (Handman-services repo). The public site is not touched.
set -euo pipefail
HOST="${PI_HOST:-marksraspi}"
cd "$(dirname "$0")"
python3 -I src/build.py
rsync -az --delete --exclude 'videos/' public/ "${HOST}:/opt/handyman/preview-site/"
echo "Preview: http://192.168.1.203:8080  (home network only)"
