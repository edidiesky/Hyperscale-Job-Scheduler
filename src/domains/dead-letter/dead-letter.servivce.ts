import mongoose from "mongoose";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, IDeadLetter, JobType, PaginatedResult } from "../../shared/types";
import { deadLetterRepository } from "./dead.letter.repository";

const OUTBOX_EVENT_TYPE_JOB_DEAD = "job.dead.topic";

class DeadLetterService {
  async create(job: IJob, lastError: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const errors = [
          {
            attempt: job.attempts,
            error: lastError,
            occurredAt: new Date(),
          },
        ];

        await deadLetterRepository.create(
          {
            jobId: job.jobId,
            jobType: job.jobType,
            tenantId: job.tenantId,
            payload: job.payload,
            attempts: job.attempts,
            errors,
          },
          session
        );

        await OutboxEventModel.create(
          [
            {
              type: OUTBOX_EVENT_TYPE_JOB_DEAD,
              payload: {
                jobId: job.jobId,
                jobType: job.jobType,
                tenantId: job.tenantId,
                totalAttempts: job.attempts,
                lastError,
                deadAt: new Date().toISOString(),
              },
              status: "pending",
              retryCount: 0,
            },
          ],
          { session }
        );
      });

      logger.error("dead_letter_service_created", {
        event: "dead_letter_service_created",
        service: SERVICE_NAME,
        jobId: job.jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        attempts: job.attempts,
      });
    } catch (error) {
      logger.error("dead_letter_service_create_failed", {
        event: "dead_letter_service_create_failed",
        service: SERVICE_NAME,
        jobId: job.jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async findUnresolved(
    tenantId: string | undefined,
    jobType: JobType | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IDeadLetter>> {
    return deadLetterRepository.findUnresolved(tenantId, jobType, page, limit);
  }

  async resolve(
    jobId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<IDeadLetter | null> {
    const doc = await deadLetterRepository.resolve(jobId, resolvedBy, resolution);

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

  async findByJobId(jobId: string): Promise<IDeadLetter | null> {
    return deadLetterRepository.findByJobId(jobId);
  }
}

export const deadLetterService = new DeadLetterService();