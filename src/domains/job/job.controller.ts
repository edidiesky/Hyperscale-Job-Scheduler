import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { jobService } from "./job.service";
import { AppError } from "../../shared/utils/AppError";
import type {
  AuthenticatedRequest,
  CreateJobRequest,
  JobStatus,
  JobType,
} from "../../shared/types";

const CreateJobHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { requestId, user } = req as AuthenticatedRequest;
    const body = req.body as CreateJobRequest;

    const job = await jobService.enqueue(body, requestId);
    res.status(201).json({ success: true, data: job });
  },
);

const GetJobHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req as AuthenticatedRequest;
    const { jobId } = req.params;

    const job = await jobService.findByJobId(jobId);
    if (!job) throw AppError.notFound(`Job ${jobId} not found`);

    res.status(200).json({ success: true, data: job });
  },
);

const ListJobsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { user } = req as AuthenticatedRequest;
    const { status, page, limit } = req.query as {
      status?: JobStatus;
      page?: string;
      limit?: string;
    };

    const result = await jobService.findByTenant(
      user.userId,
      status,
      Number(page ?? 1),
      Number(limit ?? 20),
    );

    res.status(200).json({ success: true, ...result });
  },
);

const CancelJobHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { requestId, user } = req as AuthenticatedRequest;
    const { jobId } = req.params;

    const job = await jobService.cancel(jobId, user.userId, requestId);
    if (!job)
      throw AppError.notFound(`Job ${jobId} not found or already running`);

    res.status(200).json({ success: true, data: job });
  },
);

const JobStatsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobType } = req.query as { jobType?: JobType };
    const counts = await jobService.countByStatus(jobType);
    res.status(200).json({ success: true, data: counts });
  },
);

export {
  CreateJobHandler,
  GetJobHandler,
  ListJobsHandler,
  CancelJobHandler,
  JobStatsHandler,
};
