import Joi from "joi";

export const createJobSchema = Joi.object({
  jobType: Joi.string()
    .valid(
      "RESERVATION_EXPIRY",
      "PAYOUT_BATCH",
      "ORDER_ABANDONMENT",
      "LOW_STOCK_ALERT",
      "SCHEDULED_REPORT"
    )
    .required(),
  tenantId: Joi.string().min(1).required(),
  scheduledAt: Joi.string().isoDate().required(),
  cronExpression: Joi.string().optional(),
  payload: Joi.object().required(),
});

export const cancelJobSchema = Joi.object({
  reason: Joi.string().max(500).optional(),
});

export const listJobsSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "running", "completed", "failed", "dead")
    .optional(),
  jobType: Joi.string()
    .valid(
      "RESERVATION_EXPIRY",
      "PAYOUT_BATCH",
      "ORDER_ABANDONMENT",
      "LOW_STOCK_ALERT",
      "SCHEDULED_REPORT"
    )
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});