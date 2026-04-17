import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, IDeadLetter } from "../../shared/types";
import type { JobType, PaginatedResult } from "../../shared/types";
import { publishJobDead } from "../../infra/messaging/rabbitmq-publisher";
import { deadLetterRepository } from "./dead.letter.repository";

class DeadLetterService {
  async create(job: IJob, lastError: string): Promise<void> {
    const errors = [
      {
        attempt: job.attempts,
        error: lastError,
        occurredAt: new Date(),
      },
    ];

    await deadLetterRepository.create({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      payload: job.payload,
      attempts: job.attempts,
      errors,
    });

    await publishJobDead({
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      totalAttempts: job.attempts,
      lastError,
      deadAt: new Date().toISOString(),
    });

    logger.error("dead_letter_service_created", {
      event: "dead_letter_service_created",
      service: SERVICE_NAME,
      jobId: job.jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      attempts: job.attempts,
    });
  }

  async findUnresolved(
    tenantId: string | undefined,
    jobType: JobType | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<IDeadLetter>> {
    return deadLetterRepository.findUnresolved(tenantId, jobType, page, limit);
  }

  async resolve(
    jobId: string,
    resolvedBy: string,
    resolution: string,
  ): Promise<IDeadLetter | null> {
    const doc = await deadLetterRepository.resolve(
      jobId,
      resolvedBy,
      resolution,
    );

    if (doc) {
      logger.info("dead_letter_service_resolved", {
        event: "dead_letter_service_resolved",
        service: SERVICE_NAME,
        jobId,
        resolvedBy,
      });
    }

    return doc;
  }
}

export const deadLetterService = new DeadLetterService();
