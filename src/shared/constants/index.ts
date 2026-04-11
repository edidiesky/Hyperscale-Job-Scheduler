import { Request } from "express";
import { Types } from "mongoose";

// Job Types
export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead";

export type JobType =
  | "RESERVATION_EXPIRY"
  | "PAYOUT_BATCH"
  | "ORDER_ABANDONMENT"
  | "LOW_STOCK_ALERT"
  | "SCHEDULED_REPORT";

export type JobPriority = 1 | 2 | 3;

// Job Payloads
export interface ReservationExpiryPayload {
  type: "RESERVATION_EXPIRY";
  sagaId: string;
  tenantId: string;
  inventoryId: string;
  quantity: number;
}

export interface PayoutBatchPayload {
  type: "PAYOUT_BATCH";
  weekStartDate: string;
  thresholdAmount: number;
}

export interface OrderAbandonmentPayload {
  type: "ORDER_ABANDONMENT";
  cartId: string;
  tenantId: string;
  userId: string;
  stage: "REMINDER" | "CANCEL";
}

export interface LowStockAlertPayload {
  type: "LOW_STOCK_ALERT";
  inventoryId: string;
  tenantId: string;
  storeId: string;
  quantityAvailable: number;
  reorderPoint: number;
}

export type ReportType =
  | "WEEKLY_SELLER_SUMMARY"
  | "MONTHLY_PLATFORM_ANALYTICS";

export type ReportProvider = "GITHUB" | "DATADOG" | "HONEYCOMB" | "AXIOM";

export interface ScheduledReportPayload {
  type: "SCHEDULED_REPORT";
  reportType: ReportType;
  providers: ReportProvider[];
  periodStart: string;
  periodEnd: string;
  recipientIds: string[];
}

export type JobPayload =
  | ReservationExpiryPayload
  | PayoutBatchPayload
  | OrderAbandonmentPayload
  | LowStockAlertPayload
  | ScheduledReportPayload;

// Job Document (mirrors MongoDB schema)

export interface IJob {
  _id: Types.ObjectId;
  jobId: string;
  jobType: JobType;
  tenantId: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledAt: Date;
  nextRunAt: Date;
  cronExpression?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
  payload: JobPayload;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

// Dead Letter Document

export interface IDeadLetterError {
  attempt: number;
  error: string;
  stack?: string;
  occurredAt: Date;
}

export interface IDeadLetter {
  _id: Types.ObjectId;
  jobId: string;
  jobType: JobType;
  tenantId: string;
  payload: JobPayload;
  attempts: number;
  errors: IDeadLetterError[];
  deadAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

// Job Definition (static in-memory config per job type)

export interface JobDefinition {
  jobType: JobType;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  priority: JobPriority;
  cronExpression?: string;
  idempotencyKeyFn: (payload: JobPayload) => string;
}

// Job Execution Result

export type JobExecutionStatus = "completed" | "failed";

export interface JobExecutionResult {
  jobId: string;
  jobType: JobType;
  status: JobExecutionStatus;
  durationMs: number;
  attempt: number;
  error?: string;
}

// Queue Operations

export interface EnqueueJobInput {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  scheduledAt: Date;
  nextRunAt: Date;
  priority: JobPriority;
  maxAttempts: number;
  cronExpression?: string;
  payload: JobPayload;
}

export interface CreateJobRequest {
  jobType: JobType;
  tenantId: string;
  scheduledAt: string;
  payload: Omit<JobPayload, "type">;
  cronExpression?: string;
}

// Leader Election

export type LeaderState = "leader" | "follower" | "candidate";

export interface LeaderElectionState {
  state: LeaderState;
  acquiredAt?: Date;
  lastHeartbeatAt?: Date;
}

// Retry

export interface RetryContext {
  jobId: string;
  jobType: JobType;
  attempt: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  lastError: string;
}

// RabbitMQ Event Payloads

export interface JobCompletedEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  scheduledAt: string;
  executedAt: string;
  durationMs: number;
  attempt: number;
}

export interface JobFailedEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  attempt: number;
  maxAttempts: number;
  error: string;
  nextRetryAt?: string;
}

export interface JobDeadEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  totalAttempts: number;
  lastError: string;
  deadAt: string;
}

// HTTP / Express
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    name: string;
    permissions: string[];
    roleLevel: number;
  };
  requestId: string;
}

// Pagination

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
}

export const SERVICE_NAME = "scheduler-service"