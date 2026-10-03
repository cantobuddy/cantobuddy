# CantoBuddy — production container image
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
# Persistent data lives here. Mount a volume at /data so admin changes survive
# restarts and redeploys (free hosts usually have an ephemeral disk).
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server.js"]
