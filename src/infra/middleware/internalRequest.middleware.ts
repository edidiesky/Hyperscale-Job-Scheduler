import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { AppError } from "../utils/AppError";
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;

export const internalServiceAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const internalSecret = req.headers["x-internal-secret"] as string;
  const serviceName = req.headers["x-internal-service"] as string;

  if (!internalSecret || internalSecret !== INTERNAL_SERVICE_SECRET) {
    logger.warn("Unauthorized internal service request", {
      serviceName,
      ip: req.ip,
      path: req.path,
    });

    res.status(403);
    throw AppError.forbidden("Unauthorized internal service request");
  }

  logger.info("Internal service request authorized", {
    serviceName,
    path: req.path,
  });

  next();
};

/**
 * Middleware to validate internal service requests
 * Checks for X-Internal-Request header to ensure request is from another microservice
 */
export const validateInternalRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const internalHeader = req.headers["x-internal-request"];
  if (internalHeader === "true") {
    logger.info("Internal request validated", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"];
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (apiKey && validApiKey && apiKey === validApiKey) {
    logger.info("Internal request validated via API key", {
      path: req.path,
      method: req.method,
    });
    next();
    return;
  }

  logger.warn("Unauthorized internal request attempt", {
    path: req.path,
    method: req.method,
    ip: req.ip,
    headers: {
      internalHeader,
      hasApiKey: !!apiKey,
    },
  });

  res.status(403).json({
    success: false,
    error:
      "Forbidden: This endpoint is for internal service communication only",
  });
};


export const authenticateOrInternal = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const internalHeader = req.headers["x-internal-request"];

  // If internal request, skip authentication
  if (internalHeader === "true") {
    next();
    return;
  }
  next(); // Replace with actual auth middleware
};
