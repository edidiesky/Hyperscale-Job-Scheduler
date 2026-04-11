import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import logger from "../utils/logger";
import { UNAUTHORIZED_STATUS_CODE } from "../constants";
import { DirectorateType, Permission, RoleLevel } from "../models/User";
import { roleDataCodeEnum } from "../types";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = req.cookies.jwt || req.headers.authorization?.split(" ")[1];

  if (!token) {
    res
      .status(UNAUTHORIZED_STATUS_CODE)
      .json({ error: "Access denied. Please log in to continue." });
    return;
  }

  const jwtSecret = process.env.JWT_CODE;
  if (!jwtSecret) {
    res.status(500).json({ error: "Server configuration error." });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      userType: string;
      name: string;
      roleDataCode?: roleDataCodeEnum;
      permissions: Permission[];
      directorates: DirectorateType[];
      roleLevel?: RoleLevel;
    };

    // const [permissions, directorates] = await Promise.all([
    //   PermissionService.getUserPermissions(decoded.userId),
    //   PermissionService.getUserDirectorates(decoded.userId),
    // ]);

    req.user = {
      userId: decoded.userId,
      userType: decoded.userType,
      name: decoded.name,
     permissions: decoded.permissions ?? [],
      directorates: decoded.directorates ?? [],
      roleLevel: decoded.roleLevel,
      roleDataCode: decoded.roleDataCode,
    };

    logger.info("User authenticated", {
      userId: decoded.userId,
      userType: decoded.userType,
      // decoded
      // permissionCount: permissions.length,
    });

    next();
  } catch (error) {
    res
      .status(UNAUTHORIZED_STATUS_CODE)
      .json({ error: "Session invalid or expired. Please log in again." });
  }
};

export const requirePermissions = (requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.permissions) {
      logger.warn(
        "Authorization failed: User object missing permissions array",
        {
          ip: req.ip,
          "user-agent": req.headers["user-agent"],
          userId: req.user?.userId,
        },
      );
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "You do not have the necessary permissions to access this resource.",
      });
      return;
    }

    const hasPermission = requiredPermissions.every((permission) =>
      req.user!.permissions.includes(permission),
    );

    if (!hasPermission) {
      logger.warn("Authorization failed: Insufficient permissions", {
        ip: req.ip,
        "user-agent": req.headers["user-agent"],
        userId: req.user.userId,
        requiredPermissions,
        currentPermissions: req.user.permissions,
        userObject: req.user,
      });
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "You do not have the necessary permissions to perform this action. Contact your administrator if you believe this is a mistake.",
      });
      return;
    }
    next();
  };
};

export const requireDirectorate = (allowedDirectorates: DirectorateType[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.directorates) {
      logger.warn(
        "Authorization failed: User object missing directorates array",
        {
          ip: req.ip,
          "user-agent": req.headers["user-agent"],
          userId: req.user?.userId,
        },
      );
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "You are not assigned to any directorate. Please contact your administrator.",
      });
      return;
    }

    const hasAccess = allowedDirectorates.some((directorate) =>
      req.user!.directorates.includes(directorate),
    );

    if (!hasAccess) {
      logger.warn(
        "Authorization failed: User directorate not permitted for this resource",
        {
          ip: req.ip,
          "user-agent": req.headers["user-agent"],
          userId: req.user.userId,
          requiredDirectorates: allowedDirectorates,
          currentDirectorates: req.user.directorates,
        },
      );
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "Your directorate does not have access to this resource. Please, Contact your administrator if you believe this is a mistake.",
      });
      return;
    }
    next();
  };
};

export const requireMinimumRoleLevel = (minimumLevel: RoleLevel) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.roleLevel) {
      logger.warn("Authorization failed: User object missing role level", {
        ip: req.ip,
        "user-agent": req.headers["user-agent"],
        userId: req.user?.userId,
      });
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "Your account has no role assigned. Please contact your administrator.",
      });
      return;
    }

    if (req.user.roleLevel > minimumLevel) {
      logger.warn(
        "Authorization failed: User role level below required threshold",
        {
          ip: req.ip,
          "user-agent": req.headers["user-agent"],
          userId: req.user.userId,
          requiredLevel: minimumLevel,
          currentLevel: req.user.roleLevel,
        },
      );
      res.status(UNAUTHORIZED_STATUS_CODE).json({
        error:
          "Your current role does not have sufficient privileges to access this resource. Contact your administrator to request elevated access.",
      });
      return;
    }
    next();
  };
};
