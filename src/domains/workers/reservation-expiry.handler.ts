import axios from "axios";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, JobExecutionResult, ReservationExpiryPayload } from "../../shared/types";
import type { IJobHandler } from "./IJobHandler";

export class ReservationExpiryHandler implements IJobHandler {
  async handle(job: IJob): Promise<JobExecutionResult> {
    const payload = job.payload as ReservationExpiryPayload;
    const start = Date.now();

    logger.info("handler_reservation_expiry_start", {
      event: "handler_reservation_expiry_start",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      sagaId: payload.sagaId,
      inventoryId: payload.inventoryId,
      quantity: payload.quantity,
    });

    await axios.post(
      `${process.env.INVENTORY_SERVICE_URL}/internal/reservations/${payload.sagaId}/expire`,
      { inventoryId: payload.inventoryId, quantity: payload.quantity },
      { headers: { "x-job-id": job.jobId, "x-tenant-id": job.tenantId } }
    );

    const durationMs = Date.now() - start;

    logger.info("handler_reservation_expiry_done", {
      event: "handler_reservation_expiry_done",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      sagaId: payload.sagaId,
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