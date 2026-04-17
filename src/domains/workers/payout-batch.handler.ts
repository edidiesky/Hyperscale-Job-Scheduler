import axios from "axios";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, JobExecutionResult, PayoutBatchPayload } from "../../shared/types";
import type { IJobHandler } from "./IJobHandler";

export class PayoutBatchHandler implements IJobHandler {
  async handle(job: IJob): Promise<JobExecutionResult> {
    const payload = job.payload as PayoutBatchPayload;
    const start = Date.now();

    logger.info("handler_payout_batch_start", {
      event: "handler_payout_batch_start",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      weekStartDate: payload.weekStartDate,
      thresholdAmount: payload.thresholdAmount,
    });

    await axios.post(
      `${process.env.PAYMENT_SERVICE_URL}/internal/payouts/batch`,
      {
        weekStartDate: payload.weekStartDate,
        thresholdAmount: payload.thresholdAmount,
      },
      {
        headers: {
          "x-job-id": job.jobId,
          "x-tenant-id": job.tenantId,
          "idempotency-key": `payout-${payload.weekStartDate}`,
        },
      }
    );

    const durationMs = Date.now() - start;

    logger.info("handler_payout_batch_done", {
      event: "handler_payout_batch_done",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      weekStartDate: payload.weekStartDate,
      durationMs,
    });

    return {
      jobId: job.jobId,
      jobType: job.jobType,
      status: "completed",
      durationMs,
      attempt: job.attempts,
    };
  }
}