import axios from "axios";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type {
  IJob,
  JobExecutionResult,
  ScheduledReportPayload,
} from "../../shared/types";
import type { IJobHandler } from "./IJobHandler";

export class ScheduledReportHandler implements IJobHandler {
  async handle(job: IJob): Promise<JobExecutionResult> {
    const payload = job.payload as ScheduledReportPayload;
    const start = Date.now();

    logger.info("handler_scheduled_report_start", {
      event: "handler_scheduled_report_start",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      reportType: payload.reportType,
      providers: payload.providers,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
    });

    await axios.post(
      `${process.env.REPORTING_SERVICE_URL}/internal/reports/generate`,
      {
        reportType: payload.reportType,
        providers: payload.providers,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        recipientIds: payload.recipientIds,
      },
      {
        headers: {
          "x-job-id": job.jobId,
          "x-tenant-id": job.tenantId,
          "idempotency-key": `report-${payload.reportType}-${payload.periodStart}`,
        },
      },
    );

    const durationMs = Date.now() - start;

    logger.info("handler_scheduled_report_done", {
      event: "handler_scheduled_report_done",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      reportType: payload.reportType,
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
