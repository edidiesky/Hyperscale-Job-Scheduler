import { Request, Response, NextFunction } from "express";
import logger from "../../shared/utils/logger";
import { AppError } from "../../shared/utils/AppError";
import { AuthenticatedRequest } from "../../shared/types";

export function NotFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as AuthenticatedRequest).requestId;
  const userId = (req as AuthenticatedRequest).user?.userId;

  if (error instanceof AppError) {
    logger.warn("app_error", {
      event: "app_error",
      requestId,
      userId,
      statusCode: error.statusCode,
      message: error.message,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  if (error.name === "ValidationError") {
    logger.warn("validation_error", {
      event: "validation_error",
      requestId,
      userId,
      message: error.message,
      path: req.originalUrl,
    });

    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }

  if (error.name === "MongoServerError" && (error as NodeJS.ErrnoException).code === "11000") {
    logger.warn("duplicate_key_error", {
      event: "duplicate_key_error",
      requestId,
      userId,
      message: error.message,
      path: req.originalUrl,
    });

    res.status(409).json({
      success: false,
      error: "Duplicate key: resource already exists",
    });
    return;
  }

  // JWT errors
  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
    return;
  }

  logger.error("unhandled_error", {
    event: "unhandled_error",
    requestId,
    userId,
    message: error.message,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}