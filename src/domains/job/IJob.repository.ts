import type { FilterQuery } from "mongoose";
import type {
  IJob,
  JobStatus,
  JobType,
  EnqueueJobInput,
  PaginatedResult,
} from "../../shared/types";

export interface IJobRepository {
  // Write path

  // Idempotent upsert: inserts if jobId does not exist, no-op if it does.
  // Returns the created document or the existing one.
  createJob(input: EnqueueJobInput): Promise<IJob>;
  claimJob(jobId: string, version: number): Promise<IJob | null>;
  markCompleted(
    jobId: string,
    version: number,
    completedAt: Date
  ): Promise<IJob | null>;
  markFailed(
    jobId: string,
    version: number,
    error: string,
    nextRunAt: Date
  ): Promise<IJob | null>;

  // Mark a job dead after MAX_RETRIES exhausted.
  markDead(jobId: string, version: number): Promise<IJob | null>;
  cancelJob(jobId: string): Promise<IJob | null>;
  resetStaleJobs(ageMs: number): Promise<number>;


  // Read path
  findById(jobId: string): Promise<IJob | null>;
  findByJobId(jobId: string): Promise<IJob | null>;
  findPendingDueJobs(
    jobType: JobType,
    nowMs: number,
    limit: number
  ): Promise<IJob[]>;

  findByTenant(
    tenantId: string,
    status: JobStatus | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IJob>>;

  findByFilter(
    filter: FilterQuery<IJob>,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IJob>>;

  countByStatus(jobType?: JobType): Promise<Record<JobStatus, number>>;
}