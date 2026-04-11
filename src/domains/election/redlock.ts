import Redlock, { Lock } from "redlock";
import type { Redis } from "ioredis";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME, LEADER_LOCK_KEY, LEADER_LOCK_TTL_MS } from "../../shared/constants";

export class RedlockElection {
  private redlock: Redlock;
  private lock: Lock | null = null;

  constructor(private readonly redis: Redis) {
    this.redlock = new Redlock([redis], {
      retryCount: 0,
      retryDelay: 0,
    });

    this.redlock.on("error", (error: Error) => {
      logger.error("redlock_error", {
        event: "redlock_error",
        service: SERVICE_NAME,
        error: error.message,
      });
    });
  }

  async acquire(): Promise<boolean> {
    try {
      this.lock = await this.redlock.acquire([LEADER_LOCK_KEY], LEADER_LOCK_TTL_MS);
      logger.info("redlock_acquired", {
        event: "redlock_acquired",
        service: SERVICE_NAME,
      });
      return true;
    } catch {
      return false;
    }
  }

  async extend(): Promise<boolean> {
    if (!this.lock) return false;
    try {
      this.lock = await this.redlock.extend(this.lock, LEADER_LOCK_TTL_MS);
      return true;
    } catch (error) {
      logger.warn("redlock_extend_failed", {
        event: "redlock_extend_failed",
        service: SERVICE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
      this.lock = null;
      return false;
    }
  }

  async release(): Promise<void> {
    if (!this.lock) return;
    try {
      await this.redlock.release(this.lock);
      logger.info("redlock_released", {
        event: "redlock_released",
        service: SERVICE_NAME,
      });
    } catch (error) {
      logger.warn("redlock_release_failed", {
        event: "redlock_release_failed",
        service: SERVICE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.lock = null;
    }
  }

  isHeld(): boolean {
    return this.lock !== null;
  }
}