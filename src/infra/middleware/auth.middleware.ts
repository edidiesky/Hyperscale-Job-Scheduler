import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import logger from "../../shared/utils/logger";
import { AuthenticatedRequest } from "../../shared/types";

const UNAUTHORIZED = 401;

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = (req as AuthenticatedRequest).requestId;
  const token =
    req.cookies?.jwt ?? req.headers.authorization?.split(" ")[1];

  if (!token) {
    logger.warn("auth_no_token", {
      event: "auth_no_token",
      requestId,
      ip: req.ip,
    });
    res.status(UNAUTHORIZED).json({ error: "Authentication required" });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error("auth_jwt_secret_missing", {
      event: "auth_jwt_secret_missing",
      requestId,
    });
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const decoded = (jwt.verify(token, jwtSecret) as AuthenticatedRequest).user;

    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      role: decoded.role,
      name: decoded.name,
      permissions: decoded.permissions ?? [],
      roleLevel: decoded.roleLevel,
    };

    logger.info("auth_success", {
      event: "auth_success",
      requestId,
      userId: decoded.userId,
      role: decoded.role,
    });

    next();
  } catch (error) {
    logger.warn("auth_invalid_token", {
      event: "auth_invalid_token",
      requestId,
      ip: req.ip,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(UNAUTHORIZED).json({ error: "Invalid token" });
  }
}

export function requirePermissions(requiredPermissions: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = req.requestId;

    if (!req.user?.permissions) {
      logger.warn("auth_no_permissions", {
        event: "auth_no_permissions",
        requestId,
        userId: req.user?.userId,
      });
      res.status(UNAUTHORIZED).json({ error: "No permissions" });
      return;
    }

    const hasAll = requiredPermissions.every((p) =>
      req.user!.permissions.includes(p)
    );

    if (!hasAll) {
      logger.warn("auth_insufficient_permissions", {
        event: "auth_insufficient_permissions",
        requestId,
        userId: req.user.userId,
        required: requiredPermissions,
        current: req.user.permissions,
      });
      res.status(UNAUTHORIZED).json({
        error: "Insufficient permissions",
        required: requiredPermissions,
        current: req.user.permissions,
      });
      return;
    }

    next();
  };
}