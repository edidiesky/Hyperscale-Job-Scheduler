# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
RUN addgroup -g 1001 mykeetefia && \
    adduser -S mykeetefia -u 1001 -G mykeetefia
# Copy package files
COPY package.json package-lock.json ./

RUN apk add --no-cache curl && npm ci
# Copy source files
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npx tsc


# Production stage
FROM node:18-alpine

WORKDIR /app
RUN addgroup -g 1001 mykeetefia && \
    adduser -S mykeetefia -u 1001 -G mykeetefia

RUN apk add --no-cache curl
# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist
USER mykeetefia
# Expose port
EXPOSE 8000

# Start the app
CMD ["node", "dist/server.js"]