---
layout: post
title: "Podman Container Builds: Simple vs Multi-Stage"
date: 2026-04-09
categories: ["Automation, Systems & Engineering"]
---

# Podman container builds: simple vs multi-stage

A lot of posts frame this as **bad vs good**.  
That is too simplistic.

Both approaches have a place. The real question is what you need **right now**.

## 1) Simple one-stage build

```Dockerfile
FROM node:latest
WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install -y curl
RUN npm install
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
```

### Pros

- Fast to write
- Easy to understand
- Easy to debug
- Fine for prototypes
- Good for internal or short-lived tools

### Cons

- Bigger image
- Slower pull and push
- Ships extra tools and packages
- Larger attack surface
- Less predictable when using `latest`
- Easy to accidentally copy junk into the image

## 2) Multi-stage build

```Dockerfile
FROM node:18-alpine3.18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine3.18 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8080/health || exit 1
CMD ["node", "dist/server.js"]
```

### Pros

- Smaller final image
- Faster deploys
- Cleaner runtime
- Better separation between build and run
- Usually better for production
- Lower attack surface

### Cons

- More setup
- Slightly harder to debug
- Easier to overcomplicate
- Alpine can be annoying with some native dependencies
- Not always worth it for very small apps

## Why I prefer Podman

- Rootless by default
- No daemon running in the background
- Feels cleaner on Linux
- Same general workflow people already know
- Good fit for simple local development and production builds

## A practical middle ground

```Dockerfile
FROM docker.io/library/node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM docker.io/library/node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

## Podman commands

```bash
podman build -t my-node-app .
podman run -p 8080:8080 my-node-app
```

## My take

- Use the simple build when you need speed
- Use multi-stage when the container is heading to production
- Avoid `latest` unless you enjoy surprises
- Smaller is good, but maintainable is better
- Clean and boring usually wins