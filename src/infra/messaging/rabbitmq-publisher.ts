import logger from "../../shared/utils/logger";
import { SERVICE_NAME } from "../../shared/constants";
import {
  publishToExchange,
  ROUTING_KEYS,
} from "../config/rabbitmq.consumer";
import type {
  JobCompletedEvent,
  JobFailedEvent,
  JobDeadEvent,
  JobType,
  JobPriority,
} from "../../shared/types";

interface JobScheduledEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  scheduledAt: string;
  nextRunAt: string;
  priority: JobPriority;
}

interface JobClaimedEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  attempt: number;
  claimedAt: string;
  instanceId: string;
}

interface JobRetryingEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: string;
  error: string;
}

interface JobCancelledEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  cancelledAt: string;
  cancelledBy: string;
}

interface JobHeartbeatEvent {
  jobId: string;
  jobType: JobType;
  tenantId: string;
  instanceId: string;
  heartbeatAt: string;
}

export async function publishJobCompleted(
  payload: JobCompletedEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_COMPLETED,
    payload,
    requestId
  );
  logger.info("job_completed_event_published", {
    event: "job_completed_event_published",
    service: SERVICE_NAME,
    jobId: payload.jobId,
    jobType: payload.jobType,
    requestId,
  });
}

export async function publishJobFailed(
  payload: JobFailedEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_FAILED,
    payload,
    requestId
  );
  logger.info("job_failed_event_published", {
    event: "job_failed_event_published",
    service: SERVICE_NAME,
    jobId: payload.jobId,
    jobType: payload.jobType,
    attempt: payload.attempt,
    requestId,
  });
}

export async function publishJobDead(
  payload: JobDeadEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_DEAD,
    payload,
    requestId
  );
  logger.warn("job_dead_event_published", {
    event: "job_dead_event_published",
    service: SERVICE_NAME,
    jobId: payload.jobId,
    jobType: payload.jobType,
    totalAttempts: payload.totalAttempts,
    requestId,
  });
}

export async function publishJobScheduled(
  payload: JobScheduledEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_SCHEDULED,
    payload,
    requestId
  );
}

export async function publishJobClaimed(
  payload: JobClaimedEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_CLAIMED,
    payload,
    requestId
  );
}

export async function publishJobRetrying(
  payload: JobRetryingEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_RETRYING,
    payload,
    requestId
  );
}

export async function publishJobCancelled(
  payload: JobCancelledEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_CANCELLED,
    payload,
    requestId
  );
}

export async function publishJobHeartbeat(
  payload: JobHeartbeatEvent,
  requestId?: string
): Promise<void> {
  await publishToExchange(
    ROUTING_KEYS.JOB_HEARTBEAT,
    payload,
    requestId
  );
}