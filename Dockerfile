# CantoBuddy — production container image
# Pinned to an exact Node version: the built-in SQLite module (node:sqlite) is
# still labelled experimental, so a floating tag could change behaviour between
# builds. Bump this deliberately, not accidentally.
FROM node:22.22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Migrates a legacy /data/db.json into SQLite on first boot, then starts the app.
# The file must keep LF line endings — CRLF breaks /bin/sh on Alpine.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
# Persistent data lives here. Mount a volume at /data so the SQLite database
# (and admin changes) survive restarts and redeploys.
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
