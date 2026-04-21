export const UNAUTHORIZED_STATUS_CODE = 403;
export const BAD_REQUEST_STATUS_CODE = 400;
export const SUCCESSFULLY_CREATED_STATUS_CODE = 201;
export const SUCCESSFULLY_FETCHED_STATUS_CODE = 200;
export const UNAUTHENTICATED_STATUS_CODE = 401;
export const NOT_FOUND_STATUS_CODE = 404;
export const SERVER_ERROR_STATUS_CODE = 500;


// Service identity
export const SERVICE_NAME = "scheduler-service";
export const SCHEDULER_PORT = 4017;
export const METRICS_PORT = 9464;

// Poll loo

export const POLL_INTERVAL_MS = 1_000;
export const POLL_BATCH_SIZE = 100;
export const MIN_FREE_SLOTS = 10;

// Leader election
export const LEADER_LOCK_KEY = "scheduler:leader:lock";
export const LEADER_LOCK_TTL_MS = 30_000;
export const HEARTBEAT_KEY = "scheduler:leader:heartbeat";
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TTL_MS = HEARTBEAT_INTERVAL_MS * 3;
export const HEARTBEAT_STALE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2;

// Per-job execution lock

export const JOB_LOCK_KEY_PREFIX = "scheduler:job:lock";
export const JOB_LOCK_TTL_MS = 300_000;
export const STALE_RUNNING_JOB_AGE_MS = JOB_LOCK_TTL_MS;

// Redis sorted set queue keys (one per job type)
export const QUEUE_KEY_PREFIX = "scheduler:queue";
export const QUEUE_RESERVATION_EXPIRY = `${QUEUE_KEY_PREFIX}:RESERVATION_EXPIRY`;
export const QUEUE_PAYOUT_BATCH = `${QUEUE_KEY_PREFIX}:PAYOUT_BATCH`;
export const QUEUE_ORDER_ABANDONMENT = `${QUEUE_KEY_PREFIX}:ORDER_ABANDONMENT`;
export const QUEUE_LOW_STOCK_ALERT = `${QUEUE_KEY_PREFIX}:LOW_STOCK_ALERT`;
export const QUEUE_SCHEDULED_REPORT = `${QUEUE_KEY_PREFIX}:SCHEDULED_REPORT`;

// Retry and backoff

export const MAX_RETRIES = 5;
export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 60_000;
export const RETRY_MULTIPLIER = 2;

// Executor
// MAX_CONCURRENT_JOBS: Node.js event l
export const MAX_CONCURRENT_JOBS = 100;

// MongoDB TTLs
export const COMPLETED_JOB_TTL_SECONDS = 60 * 60 * 24 * 7;
export const DEAD_LETTER_TTL_SECONDS = 60 * 60 * 24 * 30;

// RabbitMQ

export const RABBITMQ_JOB_EXCHANGE = "scheduler.exchange";
export const RABBITMQ_DEAD_LETTER_EXCHANGE = "scheduler.dlx";
export const RABBITMQ_DEAD_LETTER_QUEUE = "scheduler.jobs.dead";
export const RABBITMQ_JOB_COMPLETED_ROUTING_KEY = "job.completed";
export const RABBITMQ_JOB_FAILED_ROUTING_KEY = "job.failed";
export const RABBITMQ_JOB_DEAD_ROUTING_KEY = "job.dead";

// Clock skew monitoring (ADR-SCHED-002)
export const CLOCK_SKEW_WARN_THRESHOLD_MS = 1_000;
export const CLOCK_SKEW_ALERT_THRESHOLD_MS = 5_000;