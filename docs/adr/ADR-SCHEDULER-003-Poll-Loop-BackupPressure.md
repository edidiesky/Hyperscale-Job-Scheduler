# ADR-SCHED-003: Poll Loop Backpressure Under Burst

## Context

The poll loop runs every `POLL_INTERVAL_MS` (1 second). Each tick calls
`ZPOPMIN scheduler:queue:<type> 100` and feeds the results into the
executor pool. The executor pool has a cap of `MAX_CONCURRENT_JOBS` (100).

At 10k jobs/sec sustained load the poll loop dequeues 100 jobs per tick
across 10 instances, giving 1000 jobs/sec per tick cycle. This is within
capacity. But under burst conditions, specifically reservation expiry
during a flash sale, the sorted set can accumulate 50,000+ jobs all with
`scheduledAt <= now` simultaneously.

## The Risk

Without backpressure the poll loop behaves like this under burst:

```
Tick 1: dequeue 100, executor pool at 100/100 (saturated)
Tick 2: dequeue 100 more, no free slots, jobs pile up in memory
Tick 3: dequeue 100 more, memory grows
...
Node.js heap exhausts, process crashes, all in-memory jobs lost
```

The jobs are removed from Redis by `ZPOPMIN` before the executor has
capacity to run them. If the process crashes after `ZPOPMIN` but before
execution, those jobs are gone from Redis. MongoDB is the recovery path
but recovery adds latency.

A secondary risk: if the poll loop does not pause when the pool is
saturated, it keeps issuing `ZPOPMIN` commands and dequeuing jobs it
cannot run. This wastes Redis ops and creates a growing in-process
buffer with no bound.

## Decision

The poll loop checks executor pool availability before dequeuing.
If the pool has fewer than `MIN_FREE_SLOTS` (10) available, the poll
tick is skipped entirely. No `ZPOPMIN` is issued. Jobs stay in the
sorted set until capacity is available.

```typescript
const freeSlots = MAX_CONCURRENT_JOBS - this.activeJobs;
if (freeSlots < MIN_FREE_SLOTS) {
  logger.warn("poll_loop_backpressure_applied", {
    event: "poll_loop_backpressure_applied",
    activeJobs: this.activeJobs,
    freeSlots,
  });
  return;
}

const batchSize = Math.min(freeSlots, POLL_BATCH_SIZE);
const jobs = await queue.dequeue(jobType, batchSize);
```

`ZPOPMIN` is only called with a count the executor can actually absorb.
Jobs are never dequeued into a buffer. The sorted set is the buffer.

## What I Gave Up

Under burst, job execution latency increases. Jobs that are due sit in
the sorted set longer than `POLL_INTERVAL_MS` while the executor drains.
For reservation expiry jobs with a 10-minute TTL a few extra seconds of
execution delay is acceptable. For payout batch jobs this is irrelevant
since they run once per week.

I also accept that poll ticks are not uniform under load. The poll loop
becomes self-throttling. This is correct behaviour, not a bug.

## Priority Queue Under Backpressure

When backpressure is active and the executor drains to `MIN_FREE_SLOTS`,
the next tick dequeues from queues in priority order:

```
1. RESERVATION_EXPIRY  (priority 1, highest)
2. PAYOUT_BATCH        (priority 1)
3. ORDER_ABANDONMENT   (priority 2)
4. LOW_STOCK_ALERT     (priority 2)
5. SCHEDULED_REPORT    (priority 3, lowest)
```

Higher priority queues are polled first. Lower priority queues only get
slots if higher priority queues are empty or capacity remains after
serving higher priority jobs.

## Consequences

I added two metrics:

```
scheduler_poll_skip_total          counter, increments each skipped tick
scheduler_executor_pool_utilization gauge, activeJobs / MAX_CONCURRENT_JOBS
```

If `scheduler_poll_skip_total` is climbing in Grafana it means the
executor pool is consistently saturated. The correct response is to
add scheduler instances, not to increase `MAX_CONCURRENT_JOBS` on a
single instance. Node.js is single-threaded. More concurrent I/O-bound
jobs per instance has diminishing returns above 100.

Alert threshold: if `scheduler_executor_pool_utilization` stays above
0.9 for more than 60 seconds, page the on-call engineer. That is a
signal the cluster needs horizontal scaling before jobs start missing
their execution windows.