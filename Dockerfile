# syntax=docker/dockerfile:1.7
# CoreUp-team back office (React + Vite SPA/PWA served by Caddy). Standalone pnpm project: the build
# context is THIS directory (the repo root of the front repo):
#   docker build --build-arg VITE_API_URL=https://api.example.com -t coreup-team-app .
#
# API types: if `openapi.json` is committed, or API_OPENAPI_URL is passed, `pnpm gen:api`
# regenerates the typed client before building; otherwise the committed generated client is used.
# VITE_* values are baked into the bundle at build time (Railway forwards service variables
# that are declared as ARG). Runtime needs only PORT (Railway) and optionally API_ORIGIN, which
# extends the CSP connect-src (see Caddyfile).
# Start command: caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.14.2
ARG CADDY_VERSION=2

FROM node:${NODE_VERSION}-slim AS build
ARG PNPM_VERSION
ARG API_OPENAPI_URL=
ARG VITE_API_URL=
ARG VITE_SENTRY_DSN=
ARG VITE_VAPID_PUBLIC_KEY=
ENV CI=true \
    API_OPENAPI_URL=${API_OPENAPI_URL} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
RUN npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo
# Lockfile-only layer first so dependency installs are cached until package.json/lockfile change.
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN if [ -n "$API_OPENAPI_URL" ] || [ -f openapi.json ]; then pnpm run gen:api; fi
RUN pnpm build

# ---- runtime: static files behind Caddy, non-root ----
FROM caddy:${CADDY_VERSION}-alpine AS runtime
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -h /home/app app \
    && mkdir -p /srv /home/app/.config /home/app/.local/share \
    && chown -R app:app /home/app
ENV PORT=8080 \
    XDG_CONFIG_HOME=/home/app/.config \
    XDG_DATA_HOME=/home/app/.local/share
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=app:app /repo/dist /srv
USER app
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
