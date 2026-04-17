import axios from "axios";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, JobExecutionResult, LowStockAlertPayload } from "../../shared/types";
import type { IJobHandler } from "./IJobHandler";

export class LowStockAlertHandler implements IJobHandler {
  async handle(job: IJob): Promise<JobExecutionResult> {
    const payload = job.payload as LowStockAlertPayload;
    const start = Date.now();

    logger.info("handler_low_stock_alert_start", {
      event: "handler_low_stock_alert_start",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      inventoryId: payload.inventoryId,
      storeId: payload.storeId,
      quantityAvailable: payload.quantityAvailable,
      reorderPoint: payload.reorderPoint,
    });

    await axios.post(
      `${process.env.NOTIFICATION_SERVICE_URL}/internal/notifications/low-stock`,
      {
        inventoryId: payload.inventoryId,
        storeId: payload.storeId,
        quantityAvailable: payload.quantityAvailable,
        reorderPoint: payload.reorderPoint,
      },
      { headers: { "x-job-id": job.jobId, "x-tenant-id": job.tenantId } }
    );

    const durationMs = Date.now() - start;

    logger.info("handler_low_stock_alert_done", {
      event: "handler_low_stock_alert_done",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      inventoryId: payload.inventoryId,
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