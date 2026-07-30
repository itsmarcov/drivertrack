FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates curl gnupg && \
    curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y --no-install-recommends google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
RUN rm -f backend/render-build.sh
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=Africa/Algiers
ENV NODE_OPTIONS="--max-old-space-size=512"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/src/server.js"]
