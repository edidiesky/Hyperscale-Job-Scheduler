import { v4 as uuidv4 } from "uuid";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type {
  IJob,
  JobType,
  JobStatus,
  CreateJobRequest,
  EnqueueJobInput,
  PaginatedResult,
  JobDefinition,
} from "../../shared/types";
import { jobRepository } from "./job.repository";
import { RedisJobQueue } from "../scheduler/redis-job-queue";
import { getRedisClientSync } from "../../infra/config/redis";
import { publishJobCancelled, publishJobScheduled } from "../../infra/messaging/rabbitmq-publisher";
import { JOB_DEFINITIONS } from "../../shared/constants/JOB_DEFINITIONS";
class JobService {
  private queue: RedisJobQueue | null = null;

  private getQueue(): RedisJobQueue {
    if (!this.queue) {
      this.queue = new RedisJobQueue(getRedisClientSync());
    }
    return this.queue;
  }

  async enqueue(
    request: CreateJobRequest,
    requestId?: string
  ): Promise<IJob> {
    const definition: JobDefinition | undefined = JOB_DEFINITIONS[request.jobType];

    if (!definition) {
      throw new Error(`Unknown jobType: ${request.jobType}`);
    }

    const payload = { type: request.jobType, ...request.payload } as IJob["payload"];
    const jobId = definition.idempotencyKeyFn(payload);
    const scheduledAt = new Date(request.scheduledAt);
    const nextRunAt = scheduledAt;

    const input: EnqueueJobInput = {
      jobId,
      jobType: request.jobType,
      tenantId: request.tenantId,
      scheduledAt,
      nextRunAt,
      priority: definition.priority,
      maxAttempts: definition.maxAttempts,
      cronExpression: request.cronExpression,
      payload,
    };

    const job = await jobRepository.createJob(input);

    await this.getQueue().enqueue(
      request.jobType,
      jobId,
      nextRunAt.getTime()
    );

    await publishJobScheduled({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      scheduledAt: job.scheduledAt.toISOString(),
      nextRunAt: job.nextRunAt.toISOString(),
      priority: job.priority,
    }, requestId);

    logger.info("job_service_enqueued", {
      event: "job_service_enqueued",
      service: SERVICE_NAME,
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      scheduledAt: job.scheduledAt.toISOString(),
      requestId,
    });

    return job;
  }

  async cancel(
    jobId: string,
    cancelledBy: string,
    requestId?: string
  ): Promise<IJob | null> {
    const job = await jobRepository.cancelJob(jobId);

    if (!job) {
      logger.warn("job_service_cancel_not_found", {
        event: "job_service_cancel_not_found",
        service: SERVICE_NAME,
        jobId,
        requestId,
      });
      return null;
    }

    await this.getQueue().remove(job.jobType, jobId);

    await publishJobCancelled({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      cancelledAt: new Date().toISOString(),
      cancelledBy,
    }, requestId);

    logger.info("job_service_cancelled", {
      event: "job_service_cancelled",
      service: SERVICE_NAME,
      jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      cancelledBy,
      requestId,
    });

    return job;
  }

  async findByJobId(jobId: string): Promise<IJob | null> {
    return jobRepository.findByJobId(jobId);
  }

  async findByTenant(
    tenantId: string,
    status: JobStatus | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IJob>> {
    return jobRepository.findByTenant(tenantId, status, page, limit);
  }

  async countByStatus(jobType?: JobType): Promise<Record<JobStatus, number>> {
    return jobRepository.countByStatus(jobType);
  }
}

export const jobService = new JobService();