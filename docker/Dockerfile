# ============================================================================
# Reference Dockerfile for the Payload CMS + Next.js app (considerate-website)
#
# STATUS: reference / not yet built against the app. It depends on the changes
#         in PROPOSED_APP_CHANGES.md — specifically `output: 'standalone'` in
#         next.config.mjs (#3). Until that lands, use the "non-standalone"
#         fallback noted at the bottom.
#
# Build context is the REPO ROOT (the build needs files from BOTH app/ and
# docker/). From the repo root:
#   docker build -f docker/Dockerfile -t considerate-web:dev .
#
# The image is the reusable TEMPLATE — it contains no site identity and no
# secrets. Site identity is injected at runtime via env (see .env.example).
# ============================================================================

# ---- Stage 1: deps -- install dependencies against the exact lockfile -------
FROM node:22-slim AS deps
WORKDIR /app

# libc6/openssl needed by some native deps; keep minimal.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY app/package.json app/package-lock.json ./
# `npm ci` = reproducible install from the lockfile (fails if out of sync).
RUN npm ci


# ---- Stage 2: builder -- generate importmap + next build -------------------
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY app/ .

# Payload needs the admin import map generated before the Next build.
# (The repo commits one, but regenerating guarantees it matches the config.)
RUN npx payload generate:importmap

# Build args let CI bake the version/commit into the image for traceability.
ARG GIT_SHA=unknown
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    GIT_SHA=${GIT_SHA}

# With `output: 'standalone'` this produces .next/standalone (a self-contained
# server) + .next/static. Without it, this still builds but stage 3 must change
# (see fallback note at the bottom).
RUN npm run build


# ---- Stage 3: runner -- slim, stateless runtime image ----------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# `sharp` ships native binaries that standalone tracing can miss — install it
# explicitly so Payload/Next image processing works in the runner.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user (security baseline).
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy the standalone server, static assets, and public files.
# Standalone tracing pulls in only the node_modules the server actually needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

COPY --chown=nextjs:nodejs docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Healthcheck so orchestrators (ECS/compose) know when the app is live.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
# standalone server entrypoint is server.js at the image root:
CMD ["node", "server.js"]

# ---- Stage 4: migrator -- runs DB migrations then exits --------------------
# Built from `builder` which has the full node_modules (including tsx and all
# transitive deps). Used as a one-off ECS RunTask before rolling out a new app
# version. Push as a separate :migrator tag alongside :latest.
FROM builder AS migrator

COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# RUN_MIGRATIONS defaults to true in the entrypoint, so no override needed.
# CMD ["true"] causes the entrypoint to exit 0 after migrations complete.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["true"]

# ============================================================================
# FALLBACK (until `output: 'standalone'` is enabled in next.config.mjs):
#   Replace the three COPY-from-builder lines above with a full copy:
#       COPY --from=builder --chown=nextjs:nodejs /app ./
#   and change CMD to:  ["npm", "start"]
#   This works but produces a much larger image (full node_modules).
# ============================================================================
