# syntax=docker/dockerfile:1

FROM node:24.18.1-bookworm-slim AS base

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl git \
 && rm -rf /var/lib/apt/lists/*

ARG JUST_VERSION=1.57.0
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh \
      | bash -s -- --to /usr/local/bin --tag "${JUST_VERSION}" \
 && just --version

ARG PNPM_VERSION=11.18.0
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm --version

WORKDIR /workspace

FROM base AS media
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ffmpeg tzdata \
 && rm -rf /var/lib/apt/lists/*

FROM media AS dev
ARG MPROCS_VERSION=0.9.6
RUN npm install -g "mprocs@${MPROCS_VERSION}" && mprocs --version
