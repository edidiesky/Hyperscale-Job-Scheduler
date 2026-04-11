import mongoose, { Schema } from "mongoose";
import type { JobType, JobExecutionStatus } from "../../shared/types";

// IExecution
// One document per execution attempt.
// Separate from IJob which tracks the overall job lifecycle.
// This collection is the audit trail for every attempt made:
// who ran it, when, how long, what happened.
// Consumed by Grafana dashboards and ops tooling.

export interface IExecution {
  _id: mongoose.Types.ObjectId;
  jobId: string;
  jobType: JobType;
  tenantId: string;
  attempt: number;
  status: JobExecutionStatus;
  instanceId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  error?: string;
  stack?: string;
  createdAt: Date;
}

const ExecutionSchema = new Schema<IExecution>(
  {
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      required: true,
      enum: [
        "RESERVATION_EXPIRY",
        "PAYOUT_BATCH",
        "ORDER_ABANDONMENT",
        "LOW_STOCK_ALERT",
        "SCHEDULED_REPORT",
      ] satisfies JobType[],
    },
    tenantId: {
      type: String,
      required: true,
    },
    attempt: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ["completed", "failed"] satisfies JobExecutionStatus[],
    },
    // instanceId: which scheduler instance ran this attempt
    // used by watchdog to correlate heartbeats with execution records
    instanceId: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },
    error: {
      type: String,
      maxlength: 2_000,
    },
    stack: {
      type: String,
      maxlength: 5_000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "executions",
  }
);

// Indexes

// Primary lookup: all attempts for a given job
ExecutionSchema.index({ jobId: 1, attempt: 1 });

// Ops query: recent failures across all job types
ExecutionSchema.index({ status: 1, completedAt: -1 });

// Tenant-scoped execution history
ExecutionSchema.index({ tenantId: 1, completedAt: -1 });

// Performance monitoring: slowest executions by type
ExecutionSchema.index({ jobType: 1, durationMs: -1 });

// TTL: execution records auto-delete after 7 days
// same retention as completed job documents
ExecutionSchema.index(
  { completedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 }
);

export default mongoose.model<IExecution>("Execution", ExecutionSchema);