import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from 'cors'
import jobRoutes from "./domains/job/job.routes";
import { requestIdMiddleware } from "./infra/middleware/requestid.middleware";
import { errorHandler, NotFound } from "./infra/middleware/error-handler";

export const app = express();
app.use(
  cors({
    origin: [process.env.WEB_ORIGIN!],
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestIdMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "scheduler-service" });
});

// app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/jobs", jobRoutes);

app.use(NotFound);
app.use(errorHandler);
