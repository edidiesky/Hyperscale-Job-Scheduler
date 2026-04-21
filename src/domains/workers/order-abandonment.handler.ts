import axios from "axios";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import type { IJob, JobExecutionResult, OrderAbandonmentPayload } from "../../shared/types";
import type { IJobHandler } from "./IJobHandler";

export class OrderAbandonmentHandler implements IJobHandler {
  async handle(job: IJob): Promise<JobExecutionResult> {
    const payload = job.payload as OrderAbandonmentPayload;
    const start = Date.now();

    logger.info("handler_order_abandonment_start", {
      event: "handler_order_abandonment_start",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      orderId: payload.orderId,
      userId: payload.userId,
      stage: payload.stage,
    });

    if (payload.stage === "REMINDER") {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/internal/notifications/cart-reminder`,
        { orderId: payload.orderId, userId: payload.userId },
        { headers: { "x-job-id": job.jobId, "x-tenant-id": job.tenantId } }
      );
    } else {
      await axios.post(
        `${process.env.ORDER_SERVICE_URL}/internal/orders/${payload.orderId}/abandon`,
        { reason: "Payment not completed within allowed window" },
        { headers: { "x-job-id": job.jobId, "x-tenant-id": job.tenantId } }
      );
    }

    const durationMs = Date.now() - start;

    logger.info("handler_order_abandonment_done", {
      event: "handler_order_abandonment_done",
      service: SERVICE_NAME,
      jobId: job.jobId,
      tenantId: job.tenantId,
      orderId: payload.orderId,
      stage: payload.stage,
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