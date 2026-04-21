import type { Redis } from "ioredis";
import { LeaderElectionService } from "./domains/election/leader-election";
import { RedlockElection } from "./domains/election/redlock";
import { JobExecutor } from "./domains/execution/job-executor";
import { Worker } from "./domains/execution/worker";
import { jobRepository } from "./domains/job/job.repository";
import { PollLoop } from "./domains/scheduler/poll-loop";
import { RedisJobQueue } from "./domains/scheduler/redis-job-queue";
import { HeartbeatWatchdog } from "./domains/watchdog/heartbeat-watchdog";
import { LowStockAlertHandler } from "./domains/workers/low-stock-alert.handler";
import { OrderAbandonmentHandler } from "./domains/workers/order-abandonment.handler";
import { PayoutBatchHandler } from "./domains/workers/payout-batch.handler";
import { ReservationExpiryHandler } from "./domains/workers/reservation-expiry.handler";
import { ScheduledReportHandler } from "./domains/workers/scheduled-report.handler";
import { connectMongoDB } from "./infra/config/database";
import { connectRabbitMQ } from "./infra/config/rabbitmq.consumer";
import { connectRedis } from "./infra/config/redis";
import { startOutboxPoller } from "./shared/utils/outbox-poller";
import { SERVICE_NAME, STALE_RUNNING_JOB_AGE_MS } from "./shared/constants";
import logger from "./shared/utils/logger";

export let pollLoop: PollLoop | null = null;
export let leaderElection: LeaderElectionService | null = null;
export let watchdog: HeartbeatWatchdog | null = null;

interface InitStep {
  name: string;
  fn: () => Promise<void>;
}

async function runStep(step: InitStep): Promise<void> {
  const start = process.hrtime.bigint();
  try {
    await step.fn();
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info("bootstrap_step_complete", {
      event: "bootstrap_step_complete",
      service: SERVICE_NAME,
      step: step.name,
      durationMs: ms.toFixed(2),
    });
  } catch (error) {
    logger.error("bootstrap_step_failed", {
      event: "bootstrap_step_failed",
      service: SERVICE_NAME,
      step: step.name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function bootstrapServer(): Promise<void> {
  const start = process.hrtime.bigint();

  const mongoUrl = process.env.DATABASE_URL;
  if (!mongoUrl) throw new Error("DATABASE_URL is not defined");

  let redis: Redis;

  const infrastructureSteps: InitStep[] = [
    {
      name: "mongodb",
      fn: () => connectMongoDB(mongoUrl),
    },
    {
      name: "redis",
      fn: async () => {
        redis = await connectRedis();
      },
    },
    {
      name: "rabbitmq",
      fn: () => connectRabbitMQ(),
    },
    {
      name: "outbox_poller",
      fn: async () => {
        startOutboxPoller();
      },
    },
  ];

  for (const step of infrastructureSteps) {
    await runStep(step);
  }

  const staleCount = await jobRepository.resetStaleJobs(STALE_RUNNING_JOB_AGE_MS);
  logger.info("bootstrap_stale_jobs_reset", {
    event: "bootstrap_stale_jobs_reset",
    service: SERVICE_NAME,
    count: staleCount,
  });

  const queue = new RedisJobQueue(redis!);

  watchdog = new HeartbeatWatchdog(redis!);
  watchdog.start();

  const executor = new JobExecutor(
    {
      RESERVATION_EXPIRY: new ReservationExpiryHandler(),
      PAYOUT_BATCH: new PayoutBatchHandler(),
      ORDER_ABANDONMENT: new OrderAbandonmentHandler(),
      LOW_STOCK_ALERT: new LowStockAlertHandler(),
      SCHEDULED_REPORT: new ScheduledReportHandler(),
    },
    watchdog,
  );

  const worker = new Worker(executor);

  pollLoop = new PollLoop(queue, (jobIds, jobType) =>
    worker.dispatch(jobIds, jobType),
  );

  const redlock = new RedlockElection(redis!);
  leaderElection = new LeaderElectionService(redis!, redlock);

  leaderElection.start({
    onPromoted: () => {
      logger.info("bootstrap_leader_promoted", {
        event: "bootstrap_leader_promoted",
        service: SERVICE_NAME,
      });
      pollLoop!.start();
    },
    onDemoted: () => {
      logger.warn("bootstrap_leader_demoted", {
        event: "bootstrap_leader_demoted",
        service: SERVICE_NAME,
      });
      pollLoop!.stop();
    },
  });

  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  logger.info("bootstrap_complete", {
    event: "bootstrap_complete",
    service: SERVICE_NAME,
    durationMs: totalMs.toFixed(2),
    steps: infrastructureSteps.length,
  });
}