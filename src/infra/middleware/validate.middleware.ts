import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";
import logger from "../../shared/utils/logger";
import { AuthenticatedRequest } from "../../shared/types";

const BAD_REQUEST_STATUS_CODE = 400;

export const validateRequest = (
  schema: Schema,
  source: "query" | "body" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req as AuthenticatedRequest).requestId;
    const userId = (req as AuthenticatedRequest).user?.userId;
    const request = source === "query" ? req.query : req.body;

    const { error, value } = schema.validate(request, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);

      logger.warn("request_validation_failed", {
        event: "request_validation_failed",
        requestId,
        userId,
        path: req.originalUrl,
        method: req.method,
        source,
        errors: messages,
      });

      res.status(BAD_REQUEST_STATUS_CODE).json({
        success: false,
        errors: messages,
      });
      return;
    }

    if (source === "body") {
      req.body = value;
    } else {
      req.query = value;
    }

    logger.debug("request_validation_passed", {
      event: "request_validation_passed",
      requestId,
      userId,
      path: req.originalUrl,
      method: req.method,
      source,
    });

    next();
  };
};