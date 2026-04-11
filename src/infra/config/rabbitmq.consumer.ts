import amqp from "amqplib";
import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";

const MAX_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

// Exchanges

export const SCHEDULER_EXCHANGE = "scheduler.exchange";
export const SCHEDULER_DLX = "scheduler.dlx";

// Routing keys
// job.completed   > downstream consumers reacting to job completion
// job.failed      > monitoring and alerting
// job.dead        > ops tooling, manual requeue
// job.scheduled   > audit trail on enqueue
// job.claimed     > executor won MVCC race
// job.retrying    > retry scheduled after failure
// job.cancelled   > cancelled via API
// job.heartbeat   > worker liveness signal for watchdog

export const ROUTING_KEYS = {
  JOB_COMPLETED: "job.completed.topic",
  JOB_FAILED: "job.failed.topic",
  JOB_DEAD: "job.dead.topic",
  JOB_SCHEDULED: "job.scheduled.topic",
  JOB_CLAIMED: "job.claimed.topic",
  JOB_RETRYING: "job.retrying.topic",
  JOB_CANCELLED: "job.cancelled.topic",
  JOB_HEARTBEAT: "job.heartbeat.topic",
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];

// Queues

export const QUEUES = {
  [ROUTING_KEYS.JOB_COMPLETED]: "scheduler.jobs.completed.queue",
  [ROUTING_KEYS.JOB_FAILED]: "scheduler.jobs.failed.queue",
  [ROUTING_KEYS.JOB_DEAD]: "scheduler.jobs.dead.queue",
  [ROUTING_KEYS.JOB_SCHEDULED]: "scheduler.jobs.scheduled.queue",
  [ROUTING_KEYS.JOB_HEARTBEAT]: "scheduler.jobs.heartbeat.queue",
} as const;

// Connection state

let channel: amqp.Channel | null = null;

// Connect

export async function connectRabbitMQ(): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL!);
      channel = await connection.createChannel();

      connection.on("error", (error: Error) => {
        logger.error("rabbitmq_connection_error", {
          event: "rabbitmq_connection_error",
          service: SERVICE_NAME,
          error: error.message,
        });
      });

      connection.on("close", () => {
        channel = null;
        logger.warn("rabbitmq_connection_closed", {
          event: "rabbitmq_connection_closed",
          service: SERVICE_NAME,
        });
      });

      // Main exchange
      await channel.assertExchange(SCHEDULER_EXCHANGE, "topic", {
        durable: true,
      });

      // Dead letter exchange
      await channel.assertExchange(SCHEDULER_DLX, "topic", {
        durable: true,
      });

      // Completed queue
      await channel.assertQueue(QUEUES[ROUTING_KEYS.JOB_COMPLETED], {
        durable: true,
        arguments: { "x-queue-type": "quorum" },
      });
      await channel.bindQueue(
        QUEUES[ROUTING_KEYS.JOB_COMPLETED],
        SCHEDULER_EXCHANGE,
        ROUTING_KEYS.JOB_COMPLETED
      );

      // Failed queue: routes to DLX after delivery limit
      await channel.assertQueue(QUEUES[ROUTING_KEYS.JOB_FAILED], {
        durable: true,
        arguments: {
          "x-queue-type": "quorum",
          "x-delivery-limit": 5,
          "x-dead-letter-exchange": SCHEDULER_DLX,
          "x-dead-letter-routing-key": ROUTING_KEYS.JOB_DEAD,
        },
      });
      await channel.bindQueue(
        QUEUES[ROUTING_KEYS.JOB_FAILED],
        SCHEDULER_EXCHANGE,
        ROUTING_KEYS.JOB_FAILED
      );

      // Dead queue: terminal, ops tooling reads from here
      await channel.assertQueue(QUEUES[ROUTING_KEYS.JOB_DEAD], {
        durable: true,
        arguments: { "x-queue-type": "quorum" },
      });
      await channel.bindQueue(
        QUEUES[ROUTING_KEYS.JOB_DEAD],
        SCHEDULER_DLX,
        ROUTING_KEYS.JOB_DEAD
      );

      // Scheduled queue: audit trail
      await channel.assertQueue(QUEUES[ROUTING_KEYS.JOB_SCHEDULED], {
        durable: true,
        arguments: { "x-queue-type": "quorum" },
      });
      await channel.bindQueue(
        QUEUES[ROUTING_KEYS.JOB_SCHEDULED],
        SCHEDULER_EXCHANGE,
        ROUTING_KEYS.JOB_SCHEDULED
      );

      // Heartbeat queue: TTL 60s, stale heartbeats self-expire
      await channel.assertQueue(QUEUES[ROUTING_KEYS.JOB_HEARTBEAT], {
        durable: true,
        arguments: {
          "x-queue-type": "quorum",
          "x-message-ttl": 60_000,
        },
      });
      await channel.bindQueue(
        QUEUES[ROUTING_KEYS.JOB_HEARTBEAT],
        SCHEDULER_EXCHANGE,
        ROUTING_KEYS.JOB_HEARTBEAT
      );

      logger.info("rabbitmq_connected", {
        event: "rabbitmq_connected",
        service: SERVICE_NAME,
        exchange: SCHEDULER_EXCHANGE,
        queues: Object.values(QUEUES),
      });

      return;
    } catch (error) {
      const isLast = attempt === MAX_RETRIES - 1;

      logger.error("rabbitmq_connect_attempt_failed", {
        event: "rabbitmq_connect_attempt_failed",
        service: SERVICE_NAME,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        isLast,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isLast) throw error;

      const delay = Math.min(
        BASE_RETRY_DELAY_MS * Math.pow(2, attempt),
        MAX_RETRY_DELAY_MS
      );
      const jitter = Math.random() * 1_000;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }
}

// Publish

export async function publishToExchange(
  routingKey: RoutingKey,
  payload: unknown,
  requestId?: string
): Promise<void> {
  if (!channel) {
    await connectRabbitMQ();
  }

  channel!.publish(
    SCHEDULER_EXCHANGE,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: "application/json",
      timestamp: Date.now(),
      appId: SERVICE_NAME,
      headers: {
        "x-request-id": requestId ?? "",
        "x-service": SERVICE_NAME,
      },
    }
  );

  logger.info("rabbitmq_message_published", {
    event: "rabbitmq_message_published",
    service: SERVICE_NAME,
    routingKey,
    requestId,
  });
}

// Getters
export function getRabbitMQChannel(): amqp.Channel {
  if (!channel) {
    throw new Error(
      "RabbitMQ channel not ready. Call connectRabbitMQ() first."
    );
  }
  return channel;
}

// Disconnect
export async function disconnectRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    logger.info("rabbitmq_disconnected_gracefully", {
      event: "rabbitmq_disconnected_gracefully",
      service: SERVICE_NAME,
    });
  } catch (error) {
    logger.error("rabbitmq_disconnect_error", {
      event: "rabbitmq_disconnect_error",
      service: SERVICE_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}