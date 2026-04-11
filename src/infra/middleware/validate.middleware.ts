import { BAD_REQUEST_STATUS_CODE } from "../constants";
import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

export const validateRequest = (
  schema: Schema,
  source: "query" | "body" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const request = source === "query" ? req.query : req.body;
    const { error } = schema.validate(request);
    if (error) {
      res.status(BAD_REQUEST_STATUS_CODE).json({ error: error.details[0].message });
      return;
    }
    next();
  };
};
