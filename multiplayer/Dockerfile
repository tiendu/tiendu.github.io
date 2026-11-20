FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/data/number.sqlite
WORKDIR /app/multiplayer
COPY multiplayer/package.json multiplayer/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
WORKDIR /app
COPY multiplayer/src ./multiplayer/src
COPY src/games/number/server ./src/games/number/server
COPY src/games/shared/server ./src/games/shared/server
RUN mkdir /data && chown node:node /data
WORKDIR /app/multiplayer
USER node
VOLUME /data
EXPOSE 8787
CMD ["node", "src/node-server.mjs"]
