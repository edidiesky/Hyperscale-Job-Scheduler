import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { deadLetterService } from "./dead-letter.servivce";
import type { AuthenticatedRequest } from "../../shared/types";
import type { JobType } from "../../shared/types";
import logger from "../../shared/utils/logger";
import {
  NOT_FOUND_STATUS_CODE,
  SERVICE_NAME,
  SUCCESSFULLY_FETCHED_STATUS_CODE,
} from "../../shared/constants";

export const listDeadLettersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { tenantId, jobType, page = "1", limit = "20" } = req.query;

    const result = await deadLetterService.findUnresolved(
      tenantId as string | undefined,
      jobType as JobType | undefined,
      Math.max(1, parseInt(page as string, 10)),
      Math.min(100, Math.max(1, parseInt(limit as string, 10))),
    );

    logger.info("dead_letter_list_fetched", {
      event: "dead_letter_list_fetched",
      service: SERVICE_NAME,
      tenantId,
      jobType,
      totalCount: result.totalCount,
      requestId: (req as AuthenticatedRequest).requestId,
    });

    res.status(SUCCESSFULLY_FETCHED_STATUS_CODE).json(result);
  },
);

export const getDeadLetterHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    const doc = await deadLetterService.findByJobId(jobId);

    if (!doc) {
      res
        .status(NOT_FOUND_STATUS_CODE)
        .json({ error: "Dead letter not found" });
      return;
    }

    res.status(SUCCESSFULLY_FETCHED_STATUS_CODE).json(doc);
  },
);

export const resolveDeadLetterHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;
    const { resolution } = req.body;
    const { userId } = (req as AuthenticatedRequest).user;
    const requestId = (req as AuthenticatedRequest).requestId;

    const doc = await deadLetterService.resolve(jobId, userId, resolution);

    if (!doc) {
      res
        .status(NOT_FOUND_STATUS_CODE)
        .json({ error: "Dead letter not found or already resolved" });
      return;
    }

    logger.info("dead_letter_resolved_via_api", {
      event: "dead_letter_resolved_via_api",
      service: SERVICE_NAME,
      jobId,
      jobType: doc.jobType,
      tenantId: doc.tenantId,
      resolvedBy: userId,
      requestId,
    });

    res.status(SUCCESSFULLY_FETCHED_STATUS_CODE).json(doc);
  },
);
