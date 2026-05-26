#!/bin/sh
# ============================================================================
# Container entrypoint: run DB migrations, then start the app.
#
# WHY migrations here: the app's schema is defined by committed Payload
# migrations (app/src/migrations). A fresh database (new site!) needs them
# applied before the server is useful. Running them at startup makes spinning
# up a new site a one-step operation.
#
# PRODUCTION CAVEAT: running migrations inside every app container is fine for
# a single instance, but when a site scales to N replicas you do NOT want N
# containers racing to migrate the same DB. The clean pattern is a dedicated
# one-off "migrate" task (ECS RunTask / a compose `migrate` service) that runs
# to completion BEFORE the app service rolls out. RUN_MIGRATIONS lets you turn
# the in-container migration off and delegate to that task.
# ============================================================================
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] running Payload migrations..."
  # `payload migrate` is idempotent: it only applies pending migrations.
  node ./node_modules/.bin/payload migrate || {
    echo "[entrypoint] migration failed — refusing to start the app." >&2
    exit 1
  }
  echo "[entrypoint] migrations up to date."
else
  echo "[entrypoint] RUN_MIGRATIONS=false — skipping (expecting a separate migrate task)."
fi

echo "[entrypoint] starting app: $*"
exec "$@"
