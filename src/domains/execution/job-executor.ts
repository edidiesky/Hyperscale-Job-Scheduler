import { randomUUID } from "crypto";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, JobType, JobExecutionResult } from "../../shared/types";
import { jobRepository } from "../job/job.repository";
import { IJobHandler } from "../job/IjobHandler";
import { publishJobClaimed, publishJobCompleted } from "../../infra/messaging/rabbitmq-publisher";
import executionModel from "./execution.model";
import { HeartbeatWatchdog } from "../watchdog/heartbeat-watchdog";
import { retryService } from "./retry.service";

const INSTANCE_ID = randomUUID();

type HandlerMap = Partial<Record<JobType, IJobHandler>>;

export class JobExecutor {
  constructor(
    private readonly handlers: HandlerMap,
    private readonly watchdog: HeartbeatWatchdog,
  ) {}

  async execute(job: IJob, requestId?: string): Promise<void> {
    const claimed = await jobRepository.claimJob(job.jobId, job.version);
    if (!claimed) {
      logger.warn("executor_claim_lost", {
        event: "executor_claim_lost",
        service: SERVICE_NAME,
        jobId: job.jobId,
        jobType: job.jobType,
        requestId,
      });
      return;
    }

    await publishJobClaimed({
      jobId: claimed.jobId,
      jobType: claimed.jobType,
      tenantId: claimed.tenantId,
      attempt: claimed.attempts,
      claimedAt: new Date().toISOString(),
      instanceId: INSTANCE_ID,
    }, requestId);

    const startedAt = Date.now();
    await this.watchdog.writeHeartbeat(claimed.jobId, INSTANCE_ID);

    try {
      const handler = this.handlers[claimed.jobType];
      if (!handler) {
        throw new Error(`No handler registered for jobType: ${claimed.jobType}`);
      }

      const result: JobExecutionResult = await handler.handle(claimed);
      const completedAt = new Date();
      const durationMs = Date.now() - startedAt;

      await jobRepository.markCompleted(claimed.jobId, claimed.version + 1, completedAt);
      await this.watchdog.clearHeartbeat(claimed.jobId);

      await executionModel.create({
        jobId: claimed.jobId,
        jobType: claimed.jobType,
        tenantId: claimed.tenantId,
        attempt: claimed.attempts,
        status: "completed",
        instanceId: INSTANCE_ID,
        startedAt: new Date(startedAt),
        completedAt,
        durationMs,
      });

      await publishJobCompleted({
        jobId: claimed.jobId,
        jobType: claimed.jobType,
        tenantId: claimed.tenantId,
        scheduledAt: claimed.scheduledAt.toISOString(),
        executedAt: completedAt.toISOString(),
        durationMs,
        attempt: claimed.attempts,
      }, requestId);

      logger.info("executor_job_completed", {
        event: "executor_job_completed",
        service: SERVICE_NAME,
        jobId: claimed.jobId,
        jobType: claimed.jobType,
        tenantId: claimed.tenantId,
        attempt: claimed.attempts,
        durationMs,
        requestId,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      await this.watchdog.clearHeartbeat(claimed.jobId);

      await executionModel.create({
        jobId: claimed.jobId,
        jobType: claimed.jobType,
        tenantId: claimed.tenantId,
        attempt: claimed.attempts,
        status: "failed",
        instanceId: INSTANCE_ID,
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        durationMs,
        error: errorMessage,
        stack: errorStack,
      });

      logger.error("executor_job_failed", {
        event: "executor_job_failed",
        service: SERVICE_NAME,
        jobId: claimed.jobId,
        jobType: claimed.jobType,
        tenantId: claimed.tenantId,
        attempt: claimed.attempts,
        durationMs,
        error: errorMessage,
        requestId,
      });

      await retryService.handleFailure(claimed, errorMessage, claimed.version + 1);
    }
  }
}