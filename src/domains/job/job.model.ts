import mongoose, { Schema } from "mongoose";
import type { IJob, JobStatus, JobType, JobPriority, JobPayload } from "../../shared/types";
import {
  COMPLETED_JOB_TTL_SECONDS,
  MAX_RETRIES,
} from "../../shared/constants";

const JobPayloadSchema = new Schema<JobPayload>(
  {},
  { strict: false, _id: false }
);

const JobSchema = new Schema<IJob>(
  {
    // Identity
    jobId: {
      type: String,
      required: true,
      unique: true,
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

    // Scheduling
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: [
        "pending",
        "running",
        "completed",
        "failed",
        "dead",
      ] satisfies JobStatus[],
    },
    priority: {
      type: Number,
      required: true,
      default: 2,
      enum: [1, 2, 3] satisfies JobPriority[],
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    nextRunAt: {
      type: Date,
      required: true,
    },
    cronExpression: {
      type: String,
    },

    // Execution tracking
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      required: true,
      default: MAX_RETRIES,
    },
    lastAttemptAt: {
      type: Date,
    },
    lastError: {
      type: String,
      maxlength: 2_000,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },

    // Payload: stored as mixed, typed at application layer
    payload: {
      type: JobPayloadSchema,
      required: true,
    },

    // MVCC optimistic locking (ADR-SCHED-001)
    version: {
      type: Number,
      required: true,
      default: 0,
    },

    // TTL: completed and failed jobs expire after COMPLETED_JOB_TTL_SECONDS
    // dead jobs do not expire here, they go to dead letter collection
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

// Indexes

// Hot path: poll loop queries pending jobs due now ordered by priority
JobSchema.index({ status: 1, nextRunAt: 1, priority: -1 });

// MVCC claim: findOneAndUpdate by jobId + version
// jobId unique index above covers this

// Stale running job recovery on startup
JobSchema.index({ status: 1, startedAt: 1 });

// Tenant-scoped ops queries
JobSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

// Type-scoped monitoring
JobSchema.index({ jobType: 1, status: 1 });

// TTL auto-cleanup
JobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save: set expiresAt on terminal status transitions

JobSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() as Partial<IJob> & {
    $set?: Partial<IJob>;
  };

  const status = update?.$set?.status ?? update?.status;

  if (status === "completed" || status === "failed") {
    const expiresAt = new Date(
      Date.now() + COMPLETED_JOB_TTL_SECONDS * 1_000
    );
    if (update.$set) {
      update.$set.expiresAt = expiresAt;
    } else {
      update.$set = { expiresAt };
    }
  }
});

export default mongoose.model<IJob>("Job", JobSchema);