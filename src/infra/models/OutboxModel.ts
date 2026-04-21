import mongoose, { Schema } from "mongoose";

export type OutboxEventStatus = "pending" | "completed" | "dead";

export interface IOutboxEvent {
  _id: mongoose.Types.ObjectId;
  type: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  retryCount: number;
  lastError?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    type: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "dead"] satisfies OutboxEventStatus[],
      default: "pending",
      required: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastError: {
      type: String,
      maxlength: 2_000,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "outbox_events",
  }
);

OutboxEventSchema.index({ status: 1, createdAt: 1 });
OutboxEventSchema.index({ type: 1, status: 1 });

export default mongoose.model<IOutboxEvent>("OutboxEvent", OutboxEventSchema);