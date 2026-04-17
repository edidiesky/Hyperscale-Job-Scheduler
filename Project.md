You are continuing work on the Hyperscale Job Scheduler with me. We have been building this together and have a strict working agreement that you must follow without exception.

---

## Working Agreement

1. Never provide a one-shot solution. Always ask for my approval before moving to the next file or step.
2. Before writing any code, confirm the design decision with me first.
3. One file per response. Wait for my explicit approval before the next.
4. When a design decision has tradeoffs, explain them and ask me which direction I want to go.
5. If you spot a problem in an existing file, flag it and ask before fixing it.
6. After each file, provide a git commit message for that file only.
7. Never assume. If something is ambiguous ask me.
8. My stack is Node.js 18, TypeScript 5 strict mode, Express 4, MongoDB, Redis, RabbitMQ. No other technologies unless I approve.
9. No em dashes in any response.
10. No excessive comments in code. Only comment non-obvious logic.
11. No section dividers like // ---- in code.
12. Structured logs on every operation with event name, jobId, jobType, tenantId, requestId, userId, durationMs where relevant.
13. No any types. TypeScript strict mode throughout.
14. Constants for all magic numbers imported from shared/constants/index.ts.

---

## What This Project Is

A production-grade distributed job scheduler service called Hyperscale Job Scheduler. It is a standalone Node.js 18 + TypeScript 5 microservice that acts as a general-purpose job broker. Any service in any language can enqueue a job via HTTP and the scheduler calls back to that service's internal endpoint when the job is due.

It is a self-hosted alternative to managed services like Inngest and Trigger.dev.

---

## Stack

- Node.js 18, TypeScript 5 strict mode, Express 4
- MongoDB via Mongoose
- Redis 7 via ioredis
- RabbitMQ 3.13 via amqplib with quorum queues
- Redlock for distributed leader election
- MailerSend for OTP emails
- Joi for request validation
- Winston for structured logging
- Prometheus + Loki + Tempo + Grafana for observability
- Jest for unit and integration tests
- k6 for load, stress, soak, spike tests

---

## Folder Structure

src/
  shared/
    constants/index.ts
    types/index.ts
  infrastructure/
    config/database.ts
    config/redis.ts
    config/rabbitmq.ts
    messaging/rabbitmq-publisher.ts
    middleware/auth.middleware.ts
    middleware/error-handler.ts
    middleware/request-id.middleware.ts
    middleware/validate-request.middleware.ts
  domains/
    auth/
      user.model.ts
      otp.model.ts
      token.service.ts
      email.service.ts
      auth.service.ts
      auth.validator.ts
      auth.controller.ts
      auth.routes.ts
    job/
      job.model.ts
      IJobRepository.ts
      job.repository.ts
      job.service.ts
      job.validator.ts
      job.controller.ts
      job.routes.ts
    dead-letter/
      dead-letter.model.ts
      dead-letter.repository.ts
      dead-letter.service.ts
    execution/
      execution.model.ts
      job-executor.ts
      worker.ts
      retry.service.ts
    scheduler/
      redis-job-queue.ts
      poll-loop.ts
    election/
      redlock.ts
      leader-election.service.ts
    watchdog/
      heartbeat-watchdog.ts
    worker/
      IJobHandler.ts
      job-definitions.ts
      reservation-expiry.handler.ts
      payout-batch.handler.ts
      order-abandonment.handler.ts
      low-stock-alert.handler.ts
      scheduled-report.handler.ts
  models/
    outbox-event.model.ts
  utils/
    outbox-poller.ts
  app.ts
  bootStrap.ts
  server.ts
  shutdown.ts

---

## What Is Complete

- All TypeScript source files written and compiling (npm run build passes)
- MongoDB schemas: Job, DeadLetter, Execution, OutboxEvent, User, OTP
- Redis sorted set queue: enqueue ZADD NX, dequeue ZRANGEBYSCORE + ZREM, reschedule ZADD XX
- Poll loop with backpressure gate and Redis TIME authoritative clock
- MVCC job claim in job.repository.ts
- Job executor with heartbeat write and clear per execution
- Retry service with exponential backoff and dead letter routing
- Outbox pattern: writes OutboxEvent alongside status update, poller flushes to RabbitMQ
- Leader election with Redlock and heartbeat watchdog for automatic failover within 45 seconds
- All five job handlers: RESERVATION_EXPIRY, PAYOUT_BATCH, ORDER_ABANDONMENT, LOW_STOCK_ALERT, SCHEDULED_REPORT
- Auth: register, login with 2FA via email OTP, verify-2fa, refresh, logout, password reset
- JWT access token 15min + UUID refresh token 12h in httpOnly cookies
- Hybrid session revocation: Redis session key deleted on logout or block, JWT alone is not enough
- Job API: POST /api/v1/jobs, GET /api/v1/jobs, GET /api/v1/jobs/:jobId, DELETE /api/v1/jobs/:jobId, GET /api/v1/jobs/stats
- Auth API: POST /api/v1/auth/register, login, verify-2fa, refresh, logout, password-reset/request, password-reset/confirm
- RabbitMQ topology: topic exchange, DLX, quorum queues, bindings in definitions.json and asserted on connect
- Docker Compose: Redis AOF + volatile-lru, RabbitMQ quorum, redis-exporter, rabbitmq-exporter, Prometheus, Loki, Promtail, Tempo, Grafana
- Dockerfile: Node 18 alpine two-stage build
- tsconfig.json, package.json, jest.config.ts, .env.example

---

## What Is Pending

Unit tests:
  src/__tests__/unit/job.service.test.ts
  src/__tests__/unit/job.repository.test.ts
  src/__tests__/unit/leader-election.test.ts
  src/__tests__/unit/retry.test.ts

Integration test infrastructure:
  src/__mocks__/ioredis.ts
  src/__tests__/integration/mocks/rabbitmq.mock.ts
  src/__tests__/integration/setup/globalSetup.ts
  src/__tests__/integration/setup/globalTeardown.ts
  src/__tests__/integration/setup/setupFile.ts
  src/__tests__/integration/helpers/buildApp.ts
  src/__tests__/integration/helpers/seeders.ts
  src/__tests__/integration/helpers/requestBodies.ts

Integration tests:
  src/__tests__/integration/job.integration.test.ts
  src/__tests__/integration/leader.integration.test.ts

Load tests:
  src/__tests__/load/job-execution.k6.ts

Dead letter management API:
  src/domains/dead-letter/dead-letter.controller.ts
  src/domains/dead-letter/dead-letter.routes.ts

Known gap in job.repository.ts:
  markCompleted and markFailed must write OutboxEvent in the same
  MongoDB session as the status update. This is not yet wired.

---

## Key Architecture Decisions Already Made

Leader election: Redlock on single Redis node in dev (documented in ADR-SCHED-001).
  In prod: Redis Cluster 3 nodes minimum.
  Fallback: MVCC is the second exactly-once layer if Redlock fails.

Clock: Redis TIME command is the authoritative clock for all due-time comparisons.
  Date.now() is never used for scheduling decisions.
  ADR-SCHED-002 documents this.

Backpressure: Poll loop checks free executor slots before ZPOPMIN.
  If freeSlots < MIN_FREE_SLOTS the tick is skipped entirely.
  ADR-SCHED-003 documents this.

RabbitMQ: quorum queues, not classic mirrored.
  Single node in dev (replication factor 1).
  Prod requires 3 nodes minimum.
  ADR-SCHED-004 documents this.

Outbox: job lifecycle events written to MongoDB in same session as status update.
  Poller flushes to RabbitMQ on next tick.
  If RabbitMQ is down, no event is lost.

Auth: hybrid token model.
  Access token: JWT 15min, stateless signature verification.
  Session token: Redis key checked on every request for instant revocation.
  Refresh token: UUID in Redis, 12h TTL, httpOnly cookie.

---

## Five Biggest Things This Project Does

1. Exactly-once execution via MVCC claim on jobId + status + version field.
2. Leader failover within 45 seconds via Redlock heartbeat watchdog.
3. Clock-skew-safe scheduling via Redis TIME as authoritative clock.
4. Durable event delivery via outbox pattern, no silent event loss.
5. Backpressure under burst, jobs stay in Redis not unbounded memory.

---

## Things Most Likely to Break

1. Redis not connected before heartbeat-watchdog instantiates.
   heartbeat-watchdog calls getRedisClientSync() in constructor.
   bootStrap.ts must call connectRedis() before any domain import runs.

2. RabbitMQ vhost mismatch.
   RABBITMQ_URL must end in /scheduler to match definitions.json vhost.

3. definitions.json path in rabbitmq.conf.
   load_definitions = /rabbitmq/definitions.json must match Docker volume mount.

4. Outbox poller not started.
   startOutboxPoller() must be called in bootStrap.ts or events never publish.

5. Internal service URLs not set in .env.
   All five handlers make HTTP calls to owning services.
   If URLs are wrong all handlers fail and jobs go to dead letter.

6. markCompleted and markFailed not using MongoDB session for outbox writes.
   This gap is known and must be fixed before going to production.

---

## ADRs Written

ADR-SCHED-001: Redlock single node risk in dev
ADR-SCHED-002: Clock skew and Redis TIME solution
ADR-SCHED-003: Poll loop backpressure under burst
ADR-SCHED-004: RabbitMQ quorum queue single node in dev

---

## Where We Left Off

The build is passing (npm run build succeeds).
We are ready to start on the pending items listed above.
The next logical step is the dead letter management API followed by the tests.
But ask me what I want to tackle first before starting anything.