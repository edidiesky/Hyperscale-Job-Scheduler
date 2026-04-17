import mongoose, { Schema } from "mongoose";
import type {
  IDeadLetter,
  IDeadLetterError,
  JobType,
  JobPayload,
} from "../../shared/types";
import { DEAD_LETTER_TTL_SECONDS } from "../../shared/constants";

const DeadLetterErrorSchema = new Schema<IDeadLetterError>(
  {
    attempt: {
      type: Number,
      required: true,
      min: 0,
    },
    error: {
      type: String,
      required: true,
      maxlength: 2_000,
    },
    stack: {
      type: String,
      maxlength: 5_000,
    },
    occurredAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const DeadLetterPayloadSchema = new Schema<JobPayload>(
  {},
  { strict: false, _id: false }
);

const DeadLetterSchema = new Schema<IDeadLetter>(
  {
    // Identity: mirrors the originating job document
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

    // Original payload preserved for manual requeue
    payload: {
      type: DeadLetterPayloadSchema,
      required: true,
    },

    // Total attempts made before the job was declared dead
    attempts: {
      type: Number,
      required: true,
      min: 1,
    },

    // Full error history: one entry per failed attempt
    // Capped at 10 entries to prevent unbounded document growth
    errors: {
      type: [DeadLetterErrorSchema],
      required: true,
      default: [],
      validate: {
        validator: (v: IDeadLetterError[]) => v.length <= 10,
        message: "errors array cannot exceed 10 entries",
      },
    },

    // Lifecycle timestamps
    deadAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },

    // Ops resolution fields
    // Set by ops tooling when the dead letter is manually inspected
    // and either requeued or discarded
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
      maxlength: 200,
    },
    resolution: {
      type: String,
      maxlength: 1_000,
    },
    expiresAt: {
      type: Date,
      default: () =>
        new Date(Date.now() + DEAD_LETTER_TTL_SECONDS * 1_000),
    },
  },
  {
    timestamps: true,
    collection: "dead_letters",
  }
);

// Indexes

// Ops query: list all dead jobs for a tenant ordered by most recent
DeadLetterSchema.index({ tenantId: 1, deadAt: -1 });

// Ops query: filter by job type for batch requeue workflows
DeadLetterSchema.index({ jobType: 1, deadAt: -1 });

// Unresolved dead letters: ops dashboard shows only unresolved
DeadLetterSchema.index({ resolvedAt: 1, deadAt: -1 });

// TTL auto-cleanup
DeadLetterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IDeadLetter>("DeadLetter", DeadLetterSchema);