# Use bun as runtime
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build frontend
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production image
FROM base
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set environment
ENV NODE_ENV=production
ENV VITE_APP_API_URL=http://localhost:3001

# Expose ports
EXPOSE 5173 3001

# Start both frontend and backend
CMD ["sh", "-c", "bun run server/index.ts & bunx vite preview --port 5173 --host"]
