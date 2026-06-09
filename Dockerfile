FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000
ENV JWT_SECRET=""
ENV QR_SECRET=""
ENV DATABASE_URL=""
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/src/server.js"]
