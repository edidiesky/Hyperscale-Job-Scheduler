import { v4 as uuidv4 } from "uuid";
import type { JobDefinition, JobPayload, JobType } from "../../shared/types";
import { MAX_RETRIES, BASE_DELAY_MS, MAX_DELAY_MS } from "../../shared/constants";

export const JOB_DEFINITIONS: Partial<Record<JobType, JobDefinition>> = {
  RESERVATION_EXPIRY: {
    jobType: "RESERVATION_EXPIRY",
    maxAttempts: MAX_RETRIES,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    timeoutMs: 30_000,
    priority: 1,
    idempotencyKeyFn: (payload: JobPayload) => {
      if (payload.type !== "RESERVATION_EXPIRY") return uuidv4();
      return `RESERVATION_EXPIRY:${payload.sagaId}`;
    },
  },
  PAYOUT_BATCH: {
    jobType: "PAYOUT_BATCH",
    maxAttempts: 3,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    timeoutMs: 300_000,
    priority: 1,
    cronExpression: "0 8 * * 5",
    idempotencyKeyFn: (payload: JobPayload) => {
      if (payload.type !== "PAYOUT_BATCH") return uuidv4();
      return `PAYOUT_BATCH:${payload.weekStartDate}`;
    },
  },
  ORDER_ABANDONMENT: {
    jobType: "ORDER_ABANDONMENT",
    maxAttempts: MAX_RETRIES,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    timeoutMs: 30_000,
    priority: 2,
    idempotencyKeyFn: (payload: JobPayload) => {
      if (payload.type !== "ORDER_ABANDONMENT") return uuidv4();
      return `ORDER_ABANDONMENT:${payload.cartId}:${payload.stage}`;
    },
  },
  LOW_STOCK_ALERT: {
    jobType: "LOW_STOCK_ALERT",
    maxAttempts: MAX_RETRIES,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    timeoutMs: 15_000,
    priority: 2,
    idempotencyKeyFn: (payload: JobPayload) => {
      if (payload.type !== "LOW_STOCK_ALERT") return uuidv4();
      return `LOW_STOCK_ALERT:${payload.inventoryId}`;
    },
  },
  SCHEDULED_REPORT: {
    jobType: "SCHEDULED_REPORT",
    maxAttempts: 3,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    timeoutMs: 600_000,
    priority: 3,
    idempotencyKeyFn: (payload: JobPayload) => {
      if (payload.type !== "SCHEDULED_REPORT") return uuidv4();
      return `SCHEDULED_REPORT:${payload.reportType}:${payload.periodStart}`;
    },
  },
};