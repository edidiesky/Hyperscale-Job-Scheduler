import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import {
  POLL_INTERVAL_MS,
  POLL_BATCH_SIZE,
  MIN_FREE_SLOTS,
  MAX_CONCURRENT_JOBS,
  CLOCK_SKEW_WARN_THRESHOLD_MS,
  CLOCK_SKEW_ALERT_THRESHOLD_MS,
} from "../../shared/constants";
import type { JobType } from "../../shared/types";
import { RedisJobQueue } from "./redis-job-queue";
import { getRedisServerTimeMs } from "../../infra/config/redis";

// Job types in priority order.
// Under backpressure higher priority queues are polled first.
// RESERVATION_EXPIRY and PAYOUT_BATCH are priority 1 (financial impact).

const POLL_ORDER: JobType[] = [
  "RESERVATION_EXPIRY",
  "PAYOUT_BATCH",
  "ORDER_ABANDONMENT",
  "LOW_STOCK_ALERT",
  "SCHEDULED_REPORT",
];

type JobDispatcher = (jobIds: string[], jobType: JobType) => Promise<void>;

export class PollLoop {
  private running = false;
  private activeJobs = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: RedisJobQueue,
    private readonly dispatch: JobDispatcher
  ) {}

  start(): void {
    if (this.running) {
      logger.warn("poll_loop_already_running", {
        event: "poll_loop_already_running",
        service: SERVICE_NAME,
      });
      return;
    }

    this.running = true;
    logger.info("poll_loop_started", {
      event: "poll_loop_started",
      service: SERVICE_NAME,
      pollIntervalMs: POLL_INTERVAL_MS,
      batchSize: POLL_BATCH_SIZE,
      maxConcurrentJobs: MAX_CONCURRENT_JOBS,
    });

    this.scheduleNextTick();
  }

  stop(): void {
    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    logger.info("poll_loop_stopped", {
      event: "poll_loop_stopped",
      service: SERVICE_NAME,
      activeJobs: this.activeJobs,
    });
  }

  getActiveJobs(): number {
    return this.activeJobs;
  }

  // Wait for all in-flight jobs to complete.
  // Called by shutdown handler before closing connections.
  // Polls every 500ms with a 30s max wait.

  async drain(timeoutMs = 30_000): Promise<void> {
    const start = Date.now();

    while (this.activeJobs > 0) {
      if (Date.now() - start > timeoutMs) {
        logger.error("poll_loop_drain_timeout", {
          event: "poll_loop_drain_timeout",
          service: SERVICE_NAME,
          activeJobs: this.activeJobs,
          timeoutMs,
        });
        break;
      }

      logger.info("poll_loop_draining", {
        event: "poll_loop_draining",
        service: SERVICE_NAME,
        activeJobs: this.activeJobs,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.info("poll_loop_drained", {
      event: "poll_loop_drained",
      service: SERVICE_NAME,
    });
  }

  private scheduleNextTick(): void {
    if (!this.running) return;

    this.timer = setTimeout(async () => {
      await this.tick();
      this.scheduleNextTick();
    }, POLL_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    const freeSlots = MAX_CONCURRENT_JOBS - this.activeJobs;

    // Backpressure gate (ADR-SCHED-003):
    // If the executor pool has fewer than MIN_FREE_SLOTS available,
    // skip this tick entirely. Jobs stay in the sorted set.
    if (freeSlots < MIN_FREE_SLOTS) {
      logger.warn("poll_loop_backpressure_applied", {
        event: "poll_loop_backpressure_applied",
        service: SERVICE_NAME,
        activeJobs: this.activeJobs,
        freeSlots,
        minFreeSlots: MIN_FREE_SLOTS,
      });
      return;
    }

    // Use Redis server time as authoritative clock (ADR-SCHED-002)
    let nowMs: number;
    try {
      nowMs = await getRedisServerTimeMs();
    } catch (error) {
      logger.error("poll_loop_redis_time_failed", {
        event: "poll_loop_redis_time_failed",
        service: SERVICE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // Clock skew monitoring (ADR-SCHED-002)
    const localNowMs = Date.now();
    const skewMs = Math.abs(localNowMs - nowMs);

    if (skewMs >= CLOCK_SKEW_ALERT_THRESHOLD_MS) {
      logger.error("poll_loop_clock_skew_alert", {
        event: "poll_loop_clock_skew_alert",
        service: SERVICE_NAME,
        skewMs,
        redisNowMs: nowMs,
        localNowMs,
      });
    } else if (skewMs >= CLOCK_SKEW_WARN_THRESHOLD_MS) {
      logger.warn("poll_loop_clock_skew_warn", {
        event: "poll_loop_clock_skew_warn",
        service: SERVICE_NAME,
        skewMs,
        redisNowMs: nowMs,
        localNowMs,
      });
    }

    // Poll each queue in priority order.
    // Each queue gets a proportional share of the free slots.
    // Higher priority queues are given slots first.
    let remainingSlots = Math.min(freeSlots, POLL_BATCH_SIZE);

    for (const jobType of POLL_ORDER) {
      if (remainingSlots <= 0) break;

      try {
        const jobIds = await this.queue.dequeue(
          jobType,
          nowMs,
          remainingSlots
        );

        if (jobIds.length === 0) continue;

        remainingSlots -= jobIds.length;
        this.activeJobs += jobIds.length;

        this.dispatch(jobIds, jobType)
          .catch((error) => {
            logger.error("poll_loop_dispatch_error", {
              event: "poll_loop_dispatch_error",
              service: SERVICE_NAME,
              jobType,
              jobIds,
              error: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            this.activeJobs = Math.max(0, this.activeJobs - jobIds.length);
          });

        logger.info("poll_loop_dispatched", {
          event: "poll_loop_dispatched",
          service: SERVICE_NAME,
          jobType,
          count: jobIds.length,
          activeJobs: this.activeJobs,
          remainingSlots,
        });
      } catch (error) {
        logger.error("poll_loop_dequeue_error", {
          event: "poll_loop_dequeue_error",
          service: SERVICE_NAME,
          jobType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}