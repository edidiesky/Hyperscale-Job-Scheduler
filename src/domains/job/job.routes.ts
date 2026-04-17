import { Router } from "express";
import {
  CreateJobHandler,
  GetJobHandler,
  ListJobsHandler,
  CancelJobHandler,
  JobStatsHandler,
} from "./job.controller";
import {
  createJobSchema,
  cancelJobSchema,
  listJobsSchema,
} from "./job.validator";
import { validateRequest } from "../../infra/middleware/validate.middleware";
import { authenticate } from "../../infra/middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  validateRequest(createJobSchema),
  CreateJobHandler,
);

router.get(
  "/",
  authenticate,
  validateRequest(listJobsSchema, "query"),
  ListJobsHandler,
);

router.get("/stats", authenticate, JobStatsHandler);

router.get("/:jobId", authenticate, GetJobHandler);

router.delete(
  "/:jobId",
  authenticate,
  validateRequest(cancelJobSchema),
  CancelJobHandler,
);

export default router;
