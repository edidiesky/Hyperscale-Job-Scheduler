import type { FilterQuery } from "mongoose";
import JobModel from "./job.model";
import type { IJobRepository } from "./IJob.repository";
import type {
  IJob,
  JobStatus,
  JobType,
  EnqueueJobInput,
  PaginatedResult,
} from "../../shared/types";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";

export class JobRepository implements IJobRepository {
  async createJob(input: EnqueueJobInput): Promise<IJob> {
    try {
      const job = await JobModel.findOneAndUpdate(
        { jobId: input.jobId },
        {
          $setOnInsert: {
            jobId: input.jobId,
            jobType: input.jobType,
            tenantId: input.tenantId,
            status: "pending",
            priority: input.priority,
            scheduledAt: input.scheduledAt,
            nextRunAt: input.nextRunAt,
            cronExpression: input.cronExpression,
            attempts: 0,
            maxAttempts: input.maxAttempts,
            payload: input.payload,
            version: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      logger.info("job_repository_create", {
        event: "job_repository_create",
        service: SERVICE_NAME,
        jobId: input.jobId,
        jobType: input.jobType,
        tenantId: input.tenantId,
      });

      return job!;
    } catch (error) {
      logger.error("job_repository_create_failed", {
        event: "job_repository_create_failed",
        service: SERVICE_NAME,
        jobId: input.jobId,
        jobType: input.jobType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async claimJob(jobId: string, version: number): Promise<IJob | null> {
    const now = new Date();

    const job = await JobModel.findOneAndUpdate(
      { jobId, status: "pending", version },
      {
        $set: {
          status: "running",
          startedAt: now,
          lastAttemptAt: now,
          version: version + 1,
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    if (!job) {
      logger.warn("job_repository_claim_lost", {
        event: "job_repository_claim_lost",
        service: SERVICE_NAME,
        jobId,
        version,
      });
      return null;
    }

    logger.info("job_repository_claim_success", {
      event: "job_repository_claim_success",
      service: SERVICE_NAME,
      jobId,
      jobType: job.jobType,
      tenantId: job.tenantId,
      attempt: job.attempts,
    });

    return job;
  }

  async markCompleted(
    jobId: string,
    version: number,
    completedAt: Date,
  ): Promise<IJob | null> {
    const job = await JobModel.findOneAndUpdate(
      { jobId, status: "running", version },
      {
        $set: {
          status: "completed",
          completedAt,
          version: version + 1,
        },
      },
      { new: true },
    );

    if (job) {
      logger.info("job_repository_mark_completed", {
        event: "job_repository_mark_completed",
        service: SERVICE_NAME,
        jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        attempt: job.attempts,
      });
    }

    return job;
  }

  async markFailed(
    jobId: string,
    version: number,
    error: string,
    nextRunAt: Date,
  ): Promise<IJob | null> {
    const job = await JobModel.findOneAndUpdate(
      { jobId, status: "running", version },
      {
        $set: {
          status: "failed",
          lastError: error.slice(0, 2_000),
          nextRunAt,
          version: version + 1,
        },
      },
      { new: true },
    );

    if (job) {
      logger.warn("job_repository_mark_failed", {
        event: "job_repository_mark_failed",
        service: SERVICE_NAME,
        jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        attempt: job.attempts,
        nextRunAt: nextRunAt.toISOString(),
        error,
      });
    }

    return job;
  }

  async markDead(jobId: string, version: number): Promise<IJob | null> {
    const job = await JobModel.findOneAndUpdate(
      { jobId, version },
      {
        $set: {
          status: "dead",
          version: version + 1,
        },
      },
      { new: true },
    );

    if (job) {
      logger.error("job_repository_mark_dead", {
        event: "job_repository_mark_dead",
        service: SERVICE_NAME,
        jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
        attempts: job.attempts,
        lastError: job.lastError,
      });
    }

    return job;
  }

  async cancelJob(jobId: string): Promise<IJob | null> {
    const job = await JobModel.findOneAndUpdate(
      { jobId, status: "pending" },
      { $set: { status: "dead" } },
      { new: true },
    );

    if (job) {
      logger.info("job_repository_cancelled", {
        event: "job_repository_cancelled",
        service: SERVICE_NAME,
        jobId,
        jobType: job.jobType,
        tenantId: job.tenantId,
      });
    }

    return job;
  }

  async resetStaleJobs(ageMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - ageMs);

    const result = await JobModel.updateMany(
      { status: "running", startedAt: { $lt: cutoff } },
      {
        $set: { status: "pending" },
        $unset: { startedAt: "" },
      },
    );

    logger.warn("job_repository_stale_jobs_reset", {
      event: "job_repository_stale_jobs_reset",
      service: SERVICE_NAME,
      count: result.modifiedCount,
      cutoff: cutoff.toISOString(),
    });

    return result.modifiedCount;
  }

  async findById(id: string): Promise<IJob | null> {
    return JobModel.findById(id).lean().exec();
  }

  async findByJobId(jobId: string): Promise<IJob | null> {
    return JobModel.findOne({ jobId }).lean().exec();
  }

  async findPendingDueJobs(
    jobType: JobType,
    nowMs: number,
    limit: number,
  ): Promise<IJob[]> {
    return JobModel.find({
      jobType,
      status: "pending",
      nextRunAt: { $lte: new Date(nowMs) },
    })
      .sort({ priority: 1, nextRunAt: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findByTenant(
    tenantId: string,
    status: JobStatus | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<IJob>> {
    const filter: FilterQuery<IJob> = { tenantId };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      JobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      JobModel.countDocuments(filter),
    ]);

    return {
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      page,
      limit,
    };
  }

  async findByFilter(
    filter: FilterQuery<IJob>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<IJob>> {
    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      JobModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      JobModel.countDocuments(filter),
    ]);

    return {
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      page,
      limit,
    };
  }

  async countByStatus(jobType?: JobType): Promise<Record<JobStatus, number>> {
    const filter: FilterQuery<IJob> = jobType ? { jobType } : {};

    const result = await JobModel.aggregate<{
      _id: JobStatus;
      count: number;
    }>([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts: Record<JobStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };

    for (const row of result) {
      counts[row._id] = row.count;
    }

    return counts;
  }
}

export const jobRepository = new JobRepository();
