# ADR-SCHED-002: Clock Skew Across Scheduler Instances

## Context

The scheduler determines whether a job is due by comparing the job's
`scheduledAt` timestamp against the current time. I run 10 scheduler
instances simultaneously. Each instance reads time from its own system
clock via `Date.now()`.

System clocks across distributed nodes drift. NTP corrects this
periodically but does not guarantee sub-second agreement at any given
moment. In a Docker or Kubernetes environment, container clocks inherit
the host clock but scheduling jitter between hosts is real.

## The Risk

Two instances with diverging clocks will disagree on whether a job is due:

```
Job scheduledAt:       10:00:00.100
Instance A clock:      10:00:00.050  > not due, skips
Instance B clock:      10:00:00.300  > due, claims it

Reverse scenario:
Instance A clock:      10:00:00.300  > due, claims it
Instance B clock:      10:00:00.050  > not due, skips

Worse scenario (both ahead):
Instance A clock:      10:00:00.500
Instance B clock:      10:00:00.450
Both see job as due, both attempt MVCC claim simultaneously
One wins, one aborts. Job executes once but earlier than scheduled.
```

The MVCC guard prevents double execution but does not prevent early
execution. A job scheduled for 10:00:00 could execute at 09:59:58 on
an instance whose clock is 2 seconds fast.

For most job types a 2 second skew is acceptable. For the payout batch
job which must run at exactly Friday 09:00 WAT, a 2 second skew is
irrelevant. But if skew grows to minutes due to NTP failure, the payout
job could execute in the wrong billing window.

## Decision

I use Redis `TIME` command as the authoritative clock for all due-time
comparisons, not `Date.now()`.

```typescript
const [seconds, microseconds] = await redis.time();
const nowMs = parseInt(seconds) * 1000 + Math.floor(parseInt(microseconds) / 1000);
const isDue = nowMs >= job.scheduledAt.getTime();
```

Redis `TIME` returns the Redis server's clock. All instances query the
same Redis server and get the same time reference. Clock skew between
application instances becomes irrelevant because no instance uses its
own clock for scheduling decisions.

## What I Gave Up

One additional Redis call per poll tick. At 10 instances polling every
1 second this is 10 extra Redis ops/sec. At 40,000 Redis ops/sec
capacity this is noise.

I also now have a dependency on Redis clock accuracy instead of NTP
accuracy. If the Redis server's clock is wrong, all instances are wrong
together. This is better than instances disagreeing with each other but
it means Redis clock health is now a monitoring concern.

## Consequences

I added `scheduler_redis_clock_offset_ms` as a gauge metric. On each
poll tick I record `Date.now() - redisNowMs`. If this exceeds 5000ms
I fire an alert. This detects both Redis clock drift and NTP failure on
the application hosts.

Storing `scheduledAt` in MongoDB as UTC milliseconds everywhere.
No timezone arithmetic in the due-time check. WAT offset is only
applied when displaying times to users, never in scheduling logic.