import type { Redis } from "ioredis";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { JobType } from "../../shared/types";
import {
  QUEUE_RESERVATION_EXPIRY,
  QUEUE_PAYOUT_BATCH,
  QUEUE_ORDER_ABANDONMENT,
  QUEUE_LOW_STOCK_ALERT,
  QUEUE_SCHEDULED_REPORT,
} from "../../shared/constants";

// Queue key map
// One sorted set per job type. Score = scheduledAt in milliseconds.
// Using Redis server time (TIME command) as the authoritative clock
// per ADR-SCHED-002 to avoid cross-instance clock skew.

const QUEUE_KEY_MAP: Record<JobType, string> = {
  RESERVATION_EXPIRY: QUEUE_RESERVATION_EXPIRY,
  PAYOUT_BATCH: QUEUE_PAYOUT_BATCH,
  ORDER_ABANDONMENT: QUEUE_ORDER_ABANDONMENT,
  LOW_STOCK_ALERT: QUEUE_LOW_STOCK_ALERT,
  SCHEDULED_REPORT: QUEUE_SCHEDULED_REPORT,
};

export class RedisJobQueue {
  constructor(private readonly redis: Redis) {}

  // Enqueue
  // ZADD NX: only adds if member does not already exist.
  // Idempotent: duplicate jobId enqueue is a no-op.
  // Score is nextRunAt in milliseconds.

  async enqueue(
    jobType: JobType,
    jobId: string,
    nextRunAtMs: number
  ): Promise<boolean> {
    const key = QUEUE_KEY_MAP[jobType];

    const added = await this.redis.zadd(key, "NX", nextRunAtMs, jobId);

    logger.info("redis_queue_enqueue", {
      event: "redis_queue_enqueue",
      service: SERVICE_NAME,
      jobType,
      jobId,
      nextRunAtMs,
      added: added === 1,
    });

    return added === 1;
  }

  // Dequeue
  // ZPOPMIN COUNT N: atomically removes and returns the N members
  // with the lowest scores (earliest scheduled time) that are due now.
  // Uses Redis server time as authoritative clock (ADR-SCHED-002).
  // Only pops members with score <= nowMs so future jobs stay queued.

  async dequeue(
    jobType: JobType,
    nowMs: number,
    count: number
  ): Promise<string[]> {
    const key = QUEUE_KEY_MAP[jobType];

    // ZRANGEBYSCORE with LIMIT then ZREM in pipeline for atomic batch pop
    // of only due jobs (score <= nowMs).
    // ZPOPMIN alone would pop the earliest regardless of whether it is due.
    const pipeline = this.redis.pipeline();
    pipeline.zrangebyscore(key, 0, nowMs, "LIMIT", 0, count);
    const results = await pipeline.exec();

    const jobIds = (results?.[0]?.[1] as string[]) ?? [];

    if (jobIds.length === 0) {
      return [];
    }

    // Atomically remove the fetched members
    await this.redis.zrem(key, ...jobIds);

    logger.info("redis_queue_dequeue", {
      event: "redis_queue_dequeue",
      service: SERVICE_NAME,
      jobType,
      count: jobIds.length,
      nowMs,
    });

    return jobIds;
  }

  // Remove a specific job from the queue.
  // Called when a job is cancelled via API before it is dequeued.

  async remove(jobType: JobType, jobId: string): Promise<boolean> {
    const key = QUEUE_KEY_MAP[jobType];
    const removed = await this.redis.zrem(key, jobId);

    logger.info("redis_queue_remove", {
      event: "redis_queue_remove",
      service: SERVICE_NAME,
      jobType,
      jobId,
      removed: removed === 1,
    });

    return removed === 1;
  }

  // Reschedule: update the score of an existing member.
  // Used by retry.service.ts to push a failed job forward in time.

  async reschedule(
    jobType: JobType,
    jobId: string,
    nextRunAtMs: number
  ): Promise<boolean> {
    const key = QUEUE_KEY_MAP[jobType];

    // ZADD XX: only updates if the member already exists
    const updated = await this.redis.zadd(key, "XX", nextRunAtMs, jobId);

    logger.info("redis_queue_reschedule", {
      event: "redis_queue_reschedule",
      service: SERVICE_NAME,
      jobType,
      jobId,
      nextRunAtMs,
      updated: updated === 1,
    });

    return updated === 1;
  }

  // Size: number of members in a queue.
  // Used by metrics and backpressure monitoring.

  async size(jobType: JobType): Promise<number> {
    const key = QUEUE_KEY_MAP[jobType];
    return this.redis.zcard(key);
  }

  // Depth: number of due jobs (score <= nowMs).
  // Distinct from size: tells you how many jobs are backlogged right now.

  async depth(jobType: JobType, nowMs: number): Promise<number> {
    const key = QUEUE_KEY_MAP[jobType];
    return this.redis.zcount(key, 0, nowMs);
  }

  // Peek: inspect the next N due jobs without removing them.
  // Used by ops tooling and tests only. Not called by the poll loop.

  async peek(
    jobType: JobType,
    nowMs: number,
    count: number
  ): Promise<Array<{ jobId: string; score: number }>> {
    const key = QUEUE_KEY_MAP[jobType];
    const results = await this.redis.zrangebyscore(
      key,
      0,
      nowMs,
      "WITHSCORES",
      "LIMIT",
      0,
      count
    );

    const items: Array<{ jobId: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      items.push({
        jobId: results[i],
        score: Number(results[i + 1]),
      });
    }

    return items;
  }
}