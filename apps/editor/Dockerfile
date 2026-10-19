# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY schema/ schema/
COPY fixtures/ fixtures/
COPY apps/ apps/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @strata/editor...
RUN pnpm --filter @strata/editor build

FROM nginx:1.29-alpine
COPY apps/editor/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/editor/dist /usr/share/nginx/html
