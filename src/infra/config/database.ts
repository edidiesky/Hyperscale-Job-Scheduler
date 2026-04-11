import mongoose from "mongoose";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 2_000;

async function waitBeforeRetry(attempt: number): Promise<void> {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function connectMongoDB(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    logger.info("mongodb_connected", {
      event: "mongodb_connected",
      service: SERVICE_NAME,
    });
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("mongodb_disconnected", {
      event: "mongodb_disconnected",
      service: SERVICE_NAME,
    });
  });

  mongoose.connection.on("error", (error: Error) => {
    logger.error("mongodb_error", {
      event: "mongodb_error",
      service: SERVICE_NAME,
      error: error.message,
    });
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5_000,
        socketTimeoutMS: 45_000,
        maxPoolSize: 20,
        minPoolSize: 5,
      });
      return;
    } catch (error) {
      const isLast = attempt === MAX_RETRIES - 1;
      logger.error("mongodb_connect_attempt_failed", {
        event: "mongodb_connect_attempt_failed",
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        isLast,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isLast) {
        throw new Error(
          `MongoDB connection failed after ${MAX_RETRIES} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      await waitBeforeRetry(attempt);
    }
  }
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.connection.close();
  logger.info("mongodb_disconnected_gracefully", {
    event: "mongodb_disconnected_gracefully",
    service: SERVICE_NAME,
  });
}