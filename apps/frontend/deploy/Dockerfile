FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json tsconfig.base.json ./
COPY .yarn ./.yarn
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/platform-api/package.json packages/platform-api/package.json
COPY packages/plans/package.json packages/plans/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN yarn install --immutable

COPY apps/frontend apps/frontend
COPY packages/platform-api packages/platform-api
COPY packages/plans packages/plans
COPY packages/shared packages/shared
COPY packages/ui packages/ui

WORKDIR /app/apps/frontend
RUN yarn build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
