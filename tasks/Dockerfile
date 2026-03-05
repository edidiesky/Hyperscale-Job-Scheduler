# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
RUN addgroup -g 1001 eddie && \
    adduser -S eddie -u 1001 -G eddie

# Copy package files
COPY package.json package-lock.json ./

RUN apk add --no-cache curl && npm ci 
# Copy source files
COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

# Production stage
FROM node:18-alpine

WORKDIR /app
RUN addgroup -g 1001 eddie && \
    adduser -S eddie -u 1001 -G eddie
    
RUN apk add --no-cache curl
# Copy package files
COPY package.json package-lock.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER eddie

EXPOSE 4001

CMD ["node", "dist/server.js"]
