FROM ghcr.io/pnpm/pnpm:latest AS base
ENV CI=true
RUN pnpm runtime set node 24 -g
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY src/ /app/src/
COPY tsconfig.json /app/
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
# node_modules
COPY --from=prod-deps /app/node_modules /app/node_modules
# dist
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/

CMD ["node", "."]
