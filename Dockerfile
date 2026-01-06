# Multi-stage build for NestJS application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm install --production --legacy-peer-deps && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy migrations for production
COPY --from=builder /app/src/migrations ./dist/migrations

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
