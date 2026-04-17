import logger from "../../shared/utils/logger";
import {
  SERVICE_NAME,
  MAX_RETRIES,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  RETRY_MULTIPLIER,
} from "../../shared/constants";
import type { IJob } from "../../shared/types";
import { jobRepository } from "../job/job.repository";
import { getRedisClientSync } from "@/infra/config/redis";
import { RedisJobQueue } from "../scheduler/redis-job-queue";
import { publishJobFailed, publishJobRetrying } from "@/infra/messaging/rabbitmq-publisher";
import { deadLetterService } from "../dead-letter/dead-letter.servivce";

function computeNextRunAt(attempt: number): Date {
  const delay = Math.min(
    BASE_DELAY_MS * Math.pow(RETRY_MULTIPLIER, attempt),
    MAX_DELAY_MS
  );
  const jitter = Math.random() * 1_000;
  return new Date(Date.now() + delay + jitter);
}

class RetryService {
  private queue: RedisJobQueue | null = null;

  private getQueue(): RedisJobQueue {
    if (!this.queue) {
      this.queue = new RedisJobQueue(getRedisClientSync());
    }
    return this.queue;
  }

  async handleFailure(
    job: IJob,
    error: string,
    newVersion: number
  ): Promise<void> {
    await publishJobFailed({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      error,
    });

    if (job.attempts >= job.maxAttempts) {
      await jobRepository.markDead(job.jobId, newVersion);
      await deadLetterService.create(job, error);

      logger.error("retry_service_exhausted", {
        event: "retry_service_exhausted",
        service: SERVICE_NAME,
        jobId: job.jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error,
      });
      return;
    }

    const nextRunAt = computeNextRunAt(job.attempts);

    await jobRepository.markFailed(
      job.jobId,
      newVersion,
      error,
      nextRunAt
    );

    await this.getQueue().reschedule(
      job.jobType,
      job.jobId,
      nextRunAt.getTime()
    );

    await publishJobRetrying({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      nextRetryAt: nextRunAt.toISOString(),
      error,
    });

    logger.warn("retry_service_scheduled", {
      event: "retry_service_scheduled",
      service: SERVICE_NAME,
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      nextRunAt: nextRunAt.toISOString(),
    });
  }
}

export const retryService = new RetryService();