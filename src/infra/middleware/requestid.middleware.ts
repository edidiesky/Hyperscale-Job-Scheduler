import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../../shared/types";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? uuidv4();

  (req as AuthenticatedRequest).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
