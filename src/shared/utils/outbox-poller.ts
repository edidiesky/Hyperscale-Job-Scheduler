import { publishToExchange, RoutingKey } from "../../infra/config/rabbitmq.consumer";
import OutboxModel from "../../infra/models/OutboxModel";
import { SERVICE_NAME } from "../constants";
import logger from "./logger";

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 50;
const MAX_RETRY_COUNT = 5;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function flush(): Promise<void> {
  const events = await OutboxModel.find({
    status: "pending",
    retryCount: { $lt: MAX_RETRY_COUNT },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .exec();

  if (events.length === 0) return;

  logger.info("outbox_poller_flush_start", {
    event: "outbox_poller_flush_start",
    service: SERVICE_NAME,
    count: events.length,
  });

  for (const outboxEvent of events) {
    try {
      await publishToExchange(
        outboxEvent.type as RoutingKey,
        outboxEvent.payload
      );

      await OutboxModel.updateOne(
        { _id: outboxEvent._id },
        {
          $set: {
            status: "completed",
            processedAt: new Date(),
          },
        }
      );

      logger.info("outbox_poller_event_published", {
        event: "outbox_poller_event_published",
        service: SERVICE_NAME,
        outboxId: outboxEvent._id.toString(),
        type: outboxEvent.type,
      });
    } catch (error) {
      const newRetryCount = outboxEvent.retryCount + 1;
      const isDead = newRetryCount >= MAX_RETRY_COUNT;

      await OutboxModel.updateOne(
        { _id: outboxEvent._id },
        {
          $set: {
            status: isDead ? "dead" : "pending",
            retryCount: newRetryCount,
            lastError:
              error instanceof Error ? error.message : String(error),
          },
        }
      );

      logger.error("outbox_poller_event_failed", {
        event: "outbox_poller_event_failed",
        service: SERVICE_NAME,
        outboxId: outboxEvent._id.toString(),
        type: outboxEvent.type,
        retryCount: newRetryCount,
        isDead,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function scheduleTick(): void {
  timer = setTimeout(async () => {
    try {
      await flush();
    } catch (error) {
      logger.error("outbox_poller_tick_failed", {
        event: "outbox_poller_tick_failed",
        service: SERVICE_NAME,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (running) scheduleTick();
    }
  }, POLL_INTERVAL_MS);
}

export function startOutboxPoller(): void {
  if (running) return;
  running = true;
  scheduleTick();

  logger.info("outbox_poller_started", {
    event: "outbox_poller_started",
    service: SERVICE_NAME,
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
  });
}

export function stopOutboxPoller(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  logger.info("outbox_poller_stopped", {
    event: "outbox_poller_stopped",
    service: SERVICE_NAME,
  });
}