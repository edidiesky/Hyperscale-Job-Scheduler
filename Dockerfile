FROM node:18-alpine AS builder

WORKDIR /app

RUN addgroup -g 1001 scheduler && \
    adduser -S scheduler -u 1001 -G scheduler

COPY package.json package-lock.json ./

RUN apk add --no-cache curl && npm ci

COPY src ./src
COPY tsconfig.json ./

RUN npx tsc

FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 scheduler && \
    adduser -S scheduler -u 1001 -G scheduler

RUN apk add --no-cache curl

COPY package.json package-lock.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER scheduler

EXPOSE 4017
EXPOSE 9464

CMD ["node", "dist/server.js"]