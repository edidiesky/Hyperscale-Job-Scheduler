import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { JobType } from "../../shared/types";
import { jobRepository } from "../job/job.repository";
import { JobExecutor } from "./job-executor";

export class Worker {
  constructor(private readonly executor: JobExecutor) {}

  async dispatch(jobIds: string[], jobType: JobType): Promise<void> {
    await Promise.allSettled(
      jobIds.map((jobId) => this.run(jobId, jobType))
    );
  }

  private async run(jobId: string, jobType: JobType): Promise<void> {
    const job = await jobRepository.findByJobId(jobId);

    if (!job) {
      logger.warn("worker_job_not_found", {
        event: "worker_job_not_found",
        service: SERVICE_NAME,
        jobId,
        jobType,
      });
      return;
    }

    await this.executor.execute(job);
  }
}