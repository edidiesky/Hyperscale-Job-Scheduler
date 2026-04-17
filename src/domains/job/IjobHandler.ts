import type { IJob, JobExecutionResult } from "../../shared/types";

export interface IJobHandler {
  handle(job: IJob): Promise<JobExecutionResult>;
}