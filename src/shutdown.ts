import { Server } from "http";
import mongoose from "mongoose";
import logger from "./shared/utils/logger";
import { SERVICE_NAME } from "./shared/constants";
import { leaderElection, pollLoop, watchdog } from "./bootStrap";
import { disconnectRabbitMQ } from "./infra/config/rabbitmq.consumer";
import { disconnectRedis } from "./infra/config/redis";

export function registerShutdownHooks(server: Server): void {
  async function shutdown(signal: string): Promise<void> {
    logger.info("shutdown_initiated", {
      event: "shutdown_initiated",
      service: SERVICE_NAME,
      signal,
    });

    server.close();

    // Stop accepting new jobs
    pollLoop?.stop();
    // stopOutboxPoller();
    watchdog?.stop();
    if (pollLoop) {
      await pollLoop.drain(30_000);
    }

    // Release leader lock
    await leaderElection?.stop();

    await disconnectRabbitMQ();
    await disconnectRedis();
    await mongoose.connection.close();

    logger.info("shutdown_complete", {
      event: "shutdown_complete",
      service: SERVICE_NAME,
    });

    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (error: Error) => {
    logger.error("uncaught_exception", {
      event: "uncaught_exception",
      service: SERVICE_NAME,
      error: error.message,
      stack: error.stack,
    });
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("unhandled_rejection", {
      event: "unhandled_rejection",
      service: SERVICE_NAME,
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    shutdown("unhandledRejection");
  });
}