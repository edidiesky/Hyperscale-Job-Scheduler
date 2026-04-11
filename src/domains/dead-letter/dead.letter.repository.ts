import DeadLetterModel from "./dead-letter.model";
import type {
  IDeadLetter,
  IDeadLetterError,
  JobType,
  PaginatedResult,
} from "../../shared/types";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";

export interface CreateDeadLetterInput {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  payload: IDeadLetter["payload"];
  attempts: number;
  errors: IDeadLetterError[];
}

export interface IDeadLetterRepository {
  create(input: CreateDeadLetterInput): Promise<IDeadLetter>;
  findByJobId(jobId: string): Promise<IDeadLetter | null>;
  findUnresolved(
    tenantId: string | undefined,
    jobType: JobType | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IDeadLetter>>;
  resolve(
    jobId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<IDeadLetter | null>;
  deleteByJobId(jobId: string): Promise<void>;
}

export class DeadLetterRepository implements IDeadLetterRepository {
  async create(input: CreateDeadLetterInput): Promise<IDeadLetter> {
    try {
      const doc = await DeadLetterModel.findOneAndUpdate(
        { jobId: input.jobId },
        {
          $setOnInsert: {
            jobId: input.jobId,
            jobType: input.jobType,
            tenantId: input.tenantId,
            payload: input.payload,
            attempts: input.attempts,
            errors: input.errors.slice(0, 10),
            deadAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      logger.error("dead_letter_created", {
        event: "dead_letter_created",
        service: SERVICE_NAME,
        jobId: input.jobId,
        jobType: input.jobType,
        tenantId: input.tenantId,
        attempts: input.attempts,
      });

      return doc!;
    } catch (error) {
      logger.error("dead_letter_create_failed", {
        event: "dead_letter_create_failed",
        service: SERVICE_NAME,
        jobId: input.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<IDeadLetter | null> {
    return DeadLetterModel.findOne({ jobId }).lean().exec();
  }

  async findUnresolved(
    tenantId: string | undefined,
    jobType: JobType | undefined,
    page: number,
    limit: number
  ): Promise<PaginatedResult<IDeadLetter>> {
    const filter: Record<string, unknown> = {
      resolvedAt: { $exists: false },
    };

    if (tenantId) filter.tenantId = tenantId;
    if (jobType) filter.jobType = jobType;

    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      DeadLetterModel.find(filter)
        .sort({ deadAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      DeadLetterModel.countDocuments(filter),
    ]);

    logger.info("dead_letter_find_unresolved", {
      event: "dead_letter_find_unresolved",
      service: SERVICE_NAME,
      tenantId,
      jobType,
      totalCount,
      page,
      limit,
    });

    return {
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      page,
      limit,
    };
  }

  async resolve(
    jobId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<IDeadLetter | null> {
    const doc = await DeadLetterModel.findOneAndUpdate(
      { jobId, resolvedAt: { $exists: false } },
      {
        $set: {
          resolvedAt: new Date(),
          resolvedBy,
          resolution: resolution.slice(0, 1_000),
        },
      },
      { new: true }
    );

    if (doc) {
      logger.info("dead_letter_resolved", {
        event: "dead_letter_resolved",
        service: SERVICE_NAME,
        jobId,
        jobType: doc.jobType,
        tenantId: doc.tenantId,
        resolvedBy,
      });
    }

    return doc;
  }

  async deleteByJobId(jobId: string): Promise<void> {
    await DeadLetterModel.deleteOne({ jobId });

    logger.info("dead_letter_deleted", {
      event: "dead_letter_deleted",
      service: SERVICE_NAME,
      jobId,
    });
  }
}

export const deadLetterRepository = new DeadLetterRepository();