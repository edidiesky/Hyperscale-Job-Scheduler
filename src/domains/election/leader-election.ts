import type { Redis } from "ioredis";
import logger from "../../shared/utils/logger";
import {
  SERVICE_NAME,
  HEARTBEAT_KEY,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TTL_MS,
  HEARTBEAT_STALE_THRESHOLD_MS,
} from "../../shared/constants";
import { RedlockElection } from "./redlock";
import type { LeaderElectionState, LeaderState } from "../../shared/types";

export class LeaderElectionService {
  private state: LeaderState = "follower";
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private onPromoted: (() => void) | null = null;
  private onDemoted: (() => void) | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly election: RedlockElection
  ) {}

  start(callbacks: { onPromoted: () => void; onDemoted: () => void }): void {
    this.onPromoted = callbacks.onPromoted;
    this.onDemoted = callbacks.onDemoted;
    this.scheduleWatch();
  }

  async stop(): Promise<void> {
    this.clearTimers();
    if (this.state === "leader") {
      await this.demote();
    }
  }

  getState(): LeaderElectionState {
    return { state: this.state };
  }

  isLeader(): boolean {
    return this.state === "leader";
  }

  private scheduleWatch(): void {
    this.watchTimer = setTimeout(
      async () => this.watchTick(),
      HEARTBEAT_INTERVAL_MS
    );
  }

  private async watchTick(): Promise<void> {
    if (this.state === "leader") {
      const extended = await this.election.extend();
      if (!extended) {
        await this.demote();
        this.scheduleWatch();
        return;
      }
      await this.writeHeartbeat();
      this.scheduleWatch();
      return;
    }

    const isStale = await this.isHeartbeatStale();
    if (isStale) {
      this.state = "candidate";
      const acquired = await this.election.acquire();
      if (acquired) {
        await this.promote();
      } else {
        this.state = "follower";
      }
    }

    this.scheduleWatch();
  }

  private async promote(): Promise<void> {
    this.state = "leader";
    await this.writeHeartbeat();

    logger.info("leader_promoted", {
      event: "leader_promoted",
      service: SERVICE_NAME,
    });

    this.onPromoted?.();
  }

  private async demote(): Promise<void> {
    this.state = "follower";
    await this.election.release();

    logger.warn("leader_demoted", {
      event: "leader_demoted",
      service: SERVICE_NAME,
    });

    this.onDemoted?.();
  }

  private async writeHeartbeat(): Promise<void> {
    const ttlSeconds = Math.ceil(HEARTBEAT_TTL_MS / 1_000);
    await this.redis.set(
      HEARTBEAT_KEY,
      Date.now().toString(),
      "EX",
      ttlSeconds
    );
  }

  private async isHeartbeatStale(): Promise<boolean> {
    const value = await this.redis.get(HEARTBEAT_KEY);
    if (!value) return true;

    const age = Date.now() - parseInt(value, 10);
    return age > HEARTBEAT_STALE_THRESHOLD_MS;
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
  }
}