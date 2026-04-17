import type { Redis } from "ioredis";
import logger from "../../shared/utils/logger";
import {
  SERVICE_NAME,
  HEARTBEAT_INTERVAL_MS,
  STALE_RUNNING_JOB_AGE_MS,
} from "../../shared/constants";
import { jobRepository } from "../job/job.repository";
import { getRedisClientSync } from "../../infra/config/redis";

const JOB_HEARTBEAT_PREFIX = "scheduler:job:heartbeat";

export class HeartbeatWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private redis: Redis;

  constructor() {
    this.redis = getRedisClientSync();
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    logger.info("watchdog_started", {
      event: "watchdog_started",
      service: SERVICE_NAME,
      intervalMs: HEARTBEAT_INTERVAL_MS,
    });

    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    logger.info("watchdog_stopped", {
      event: "watchdog_stopped",
      service: SERVICE_NAME,
    });
  }

  async writeHeartbeat(jobId: string, instanceId: string): Promise<void> {
    const key = `${JOB_HEARTBEAT_PREFIX}:${jobId}`;
    const ttlSeconds = Math.ceil((HEARTBEAT_INTERVAL_MS * 3) / 1_000);
    await this.redis.set(
      key,
      JSON.stringify({ instanceId, ts: Date.now() }),
      "EX",
      ttlSeconds
    );
  }

  async clearHeartbeat(jobId: string): Promise<void> {
    await this.redis.del(`${JOB_HEARTBEAT_PREFIX}:${jobId}`);
  }

  private scheduleTick(): void {
    this.timer = setTimeout(async () => {
      await this.tick();
      if (this.running) this.scheduleTick();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    try {
      const count = await jobRepository.resetStaleJobs(STALE_RUNNING_JOB_AGE_MS);

      if (count > 0) {
        logger.warn("watchdog_stale_jobs_requeued", {
          event: "watchdog_stale_jobs_requeued",
          service: SERVICE_NAME,
          count,
        });
      }
    } catch (error) {
      logger.error("watchdog_tick_failed", {
        event: "watchdog_tick_failed",
        service: SERVICE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const heartbeatWatchdog = new HeartbeatWatchdog();