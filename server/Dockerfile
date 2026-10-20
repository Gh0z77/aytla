# EVEREST AI API. Node 24 runs the TypeScript sources directly (type stripping), so there is no build step.
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

# SQLite lives on a volume: mount persistent storage at /data, or every deploy starts with an empty database
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_FILE=/data/everest.db
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787

USER node
CMD ["node", "src/index.ts"]
