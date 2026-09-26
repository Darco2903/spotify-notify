FROM ghcr.io/pnpm/pnpm:latest AS base
ENV CI=true
RUN pnpm runtime set node 20 -g
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY src/ /app/src/
COPY tsconfig.json ./
RUN pnpm build

FROM node:20-alpine AS runtime
# node_modules
COPY --from=prod-deps /app/node_modules /app/node_modules
# dist
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/
WORKDIR /app

CMD ["node", "."]
