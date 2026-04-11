# ADR-SCHED-001: Redlock on Single Redis Node in Dev

## Context

The scheduler requires exactly-once job execution across multiple instances.
I chose Redlock for leader election because it is the correct algorithm for
distributed mutex acquisition. Redlock acquires locks on a quorum of N
independent Redis nodes. In production this means N=3 or N=5 nodes.

In my current dev environment I run a single Redis node.

## The Risk

Redlock's quorum guarantee does not apply on a single node. If Redis restarts
between lock acquisition and TTL expiry, the lock disappears. Two scheduler
instances can both believe they are leader simultaneously. This creates a
window where the same job executes twice.

I am paying the operational cost of Redlock without getting the theoretical
safety guarantee that justifies that cost.

## Why I Am Accepting This for Now

I have a second layer of exactly-once protection that does not depend on
Redis quorum: MongoDB MVCC. Before executing any job, the executor runs:

```
findOneAndUpdate(
  { jobId, status: 'pending', version: <known> },
  { $set: { status: 'running', version: version + 1 } }
)
```

If two instances both win the Redlock race due to the single-node failure
mode, only one wins the MVCC race. The second gets null back and aborts.
The MVCC guard is atomic at the MongoDB storage engine level and does not
depend on Redis at all.

So in the worst case failure scenario:

```
Redis restarts > both instances acquire leader lock
Instance A wins MVCC claim > executes job
Instance B loses MVCC claim > aborts, logs conflict
```

The job executes exactly once. The double-leader window is survivable.

## What I Gave Up

Linearisability at the election layer. Two instances can both be in the
leader state simultaneously for the duration of the Redis restart window.
Redlock on a proper quorum prevents this. My single-node setup does not.

## Production Requirement

In production this must be corrected. The fix is one of:

1. Redis Cluster with 3 primary nodes, Redlock uses quorum across all 3
2. Three independent Redis Sentinel setups, Redlock uses one lock per node
3. Redis Enterprise with guaranteed HA

Until this is in place, production deployments run with the same MVCC
safety net as dev, but the leader election layer is not quorum-safe.

## Consequences

I added `REDIS_NODE_COUNT` to the environment config. When it equals 1 the
scheduler logs a startup warning:

```
WARN  redlock_single_node_mode: quorum unavailable, MVCC is the only
      exactly-once guarantee. Do not use this in production.
```

I will monitor `scheduler_leader_conflict_total` in Grafana. Any value
above zero in production is a signal to fix the Redis topology immediately.