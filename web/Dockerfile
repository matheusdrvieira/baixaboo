FROM oven/bun:1.3.6-alpine AS dependencies

WORKDIR /app
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile

FROM node:24-alpine AS builder

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY web/. .

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8010
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
ARG RAILWAY_GIT_COMMIT_SHA
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
ENV NEXT_DEPLOYMENT_ID=${RAILWAY_GIT_COMMIT_SHA}

RUN ./node_modules/.bin/next build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3001

# The production server does not use npm; excluding it removes an unnecessary
# package manager and its dependency tree from the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 3001

USER node

CMD ["node", "server.js"]
