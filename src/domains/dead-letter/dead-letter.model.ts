
// Service identity

export const SERVICE_NAME = "scheduler-service";
export const SCHEDULER_PORT = 4017;
export const METRICS_PORT = 9464;

// Poll loop (ADR-SCHED-003)
// POLL_INTERVAL_MS: how often each worker checks its queue
// POLL_BATCH_SIZE: max jobs dequeued per tick per queue
// MIN_FREE_SLOTS: executor must have at least this many free slots
//   before a poll tick is allowed to dequeue. Backpressure gate.

export const POLL_INTERVAL_MS = 1_000;
export const POLL_BATCH_SIZE = 100;
export const MIN_FREE_SLOTS = 10;

// Leader election (ADR-SCHED-001)
// LEADER_LOCK_TTL_MS: Redlock lock TTL. If leader crashes without
//   releasing, followers can acquire after this duration.
// HEARTBEAT_INTERVAL_MS: how often the leader renews its lock and
//   writes a heartbeat key.
// HEARTBEAT_TTL_MS: TTL of the heartbeat key. Set to 3x interval so
//   one missed heartbeat does not trigger failover (dead-man switch).
// HEARTBEAT_STALE_THRESHOLD_MS: followers treat a heartbeat older than
//   this as a dead leader and attempt acquisition.

export const LEADER_LOCK_KEY = "scheduler:leader:lock";
export const LEADER_LOCK_TTL_MS = 30_000;
export const HEARTBEAT_KEY = "scheduler:leader:heartbeat";
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TTL_MS = HEARTBEAT_INTERVAL_MS * 3;
export const HEARTBEAT_STALE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2;

// Per-job execution lock
// JOB_LOCK_TTL_MS: max time a job lock is held. If execution takes
//   longer than this, the lock expires and the watchdog can reclaim.
// STALE_RUNNING_JOB_AGE_MS: on startup, any job with status=running
//   and startedAt older than this is reset to pending for re-execution.

export const JOB_LOCK_KEY_PREFIX = "scheduler:job:lock";
export const JOB_LOCK_TTL_MS = 300_000;
export const STALE_RUNNING_JOB_AGE_MS = JOB_LOCK_TTL_MS;

// Redis sorted set queue keys (one per job type)
// Sharded by job type so each type gets its own poll worker and the
// ZPOPMIN operations do not contend on a single key.

export const QUEUE_KEY_PREFIX = "scheduler:queue";
export const QUEUE_RESERVATION_EXPIRY = `${QUEUE_KEY_PREFIX}:RESERVATION_EXPIRY`;
export const QUEUE_PAYOUT_BATCH = `${QUEUE_KEY_PREFIX}:PAYOUT_BATCH`;
export const QUEUE_ORDER_ABANDONMENT = `${QUEUE_KEY_PREFIX}:ORDER_ABANDONMENT`;
export const QUEUE_LOW_STOCK_ALERT = `${QUEUE_KEY_PREFIX}:LOW_STOCK_ALERT`;
export const QUEUE_SCHEDULED_REPORT = `${QUEUE_KEY_PREFIX}:SCHEDULED_REPORT`;

// Retry and backoff
// MAX_RETRIES: max execution attempts before a job is moved to dead letter
// BASE_DELAY_MS: starting delay for exponential backoff
// MAX_DELAY_MS: ceiling on backoff delay regardless of attempt count
// RETRY_MULTIPLIER: base of the exponential: delay = BASE * MULTIPLIER^attempt

export const MAX_RETRIES = 5;
export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 60_000;
export const RETRY_MULTIPLIER = 2;

// Executor
// MAX_CONCURRENT_JOBS: Node.js event loop is single-threaded.
//   I/O-bound jobs benefit from concurrency up to a point.
//   Above 100 the gains diminish and memory pressure increases.

export const MAX_CONCURRENT_JOBS = 100;

// MongoDB TTLs
// COMPLETED_JOB_TTL_SECONDS: completed and failed jobs are auto-deleted
//   after 7 days via the expiresAt TTL index.
// DEAD_LETTER_TTL_SECONDS: dead letter documents are retained for 30 days
//   to give ops time to inspect and manually requeue.

export const COMPLETED_JOB_TTL_SECONDS = 60 * 60 * 24 * 7;
export const DEAD_LETTER_TTL_SECONDS = 60 * 60 * 24 * 30;

// RabbitMQ
// These must match the exchange and queue names in:
//   infrastructure/config/rabbitmq.ts
//   rabbitmq/definitions.json

export const RABBITMQ_JOB_EXCHANGE = "scheduler.exchange";
export const RABBITMQ_DEAD_LETTER_EXCHANGE = "scheduler.dlx";
export const RABBITMQ_DEAD_LETTER_QUEUE = "scheduler.jobs.dead";
export const RABBITMQ_JOB_COMPLETED_ROUTING_KEY = "job.completed";
export const RABBITMQ_JOB_FAILED_ROUTING_KEY = "job.failed";
export const RABBITMQ_JOB_DEAD_ROUTING_KEY = "job.dead";

// Clock skew monitoring (ADR-SCHED-002)
// CLOCK_SKEW_WARN_THRESHOLD_MS: emit a warning log if the offset between
//   Date.now() and Redis TIME exceeds this value.
// CLOCK_SKEW_ALERT_THRESHOLD_MS: emit an error log and increment the
//   scheduler_clock_skew_detected_total counter.

export const CLOCK_SKEW_WARN_THRESHOLD_MS = 1_000;
export const CLOCK_SKEW_ALERT_THRESHOLD_MS = 5_000;