# ADR-SCHED-004: RabbitMQ Quorum Queues on Single Node in Dev

## Context

I chose quorum queues over classic mirrored queues for all scheduler
queues. Quorum queues use the Raft consensus algorithm to replicate
messages across N nodes before acknowledging a publish. This gives
genuine durability: a message is not lost even if a minority of nodes
crash simultaneously.

Quorum queues require a cluster of at least 3 nodes for Raft to be
meaningful. A majority quorum on 3 nodes means 2 nodes must acknowledge
before a message is confirmed. On 1 node the quorum is 1 of 1, which
means the queue is durable to disk but there is no replication.

In my dev environment I run a single RabbitMQ node.

## The Risk

On a single node, quorum queue durability reduces to:

```
Message written to disk on one node > acknowledged
Node crashes before fsync completes > message lost
```

This is the same durability guarantee as a classic durable queue on a
single node. I am using quorum queue semantics without the replication
benefit that makes quorum queues worth their overhead.

Additionally, if the single RabbitMQ node goes down entirely, the
scheduler cannot publish job completion events and cannot receive
dispatched jobs until the broker recovers. There is no failover because
there is no second node to fail over to.

## Why I Am Accepting This for Dev

The scheduler has two independent durability layers that do not depend
on RabbitMQ:

```
Layer 1: Redis sorted set
  Jobs live in the sorted set until ZPOPMIN removes them at execution time.
  If RabbitMQ is down, the poll loop still dequeues and executes jobs.
  RabbitMQ is used for publishing completion events, not for job storage.

Layer 2: MongoDB job records
  Every job has a persistent record with status, attempts, and version.
  If a job executes but the completion event fails to publish to RabbitMQ,
  the MongoDB record still shows status: completed.
  The completion event can be replayed from MongoDB by ops tooling.
```

RabbitMQ going down in dev means job completion events are lost, not
jobs themselves. This is acceptable for development and testing.

## Production Requirement

In production the RabbitMQ cluster must have 3 nodes minimum. The
`definitions.json` already declares quorum queues with no hardcoded
replication factor, which means RabbitMQ uses the cluster size to
determine the default quorum. On a 3-node cluster this gives a
replication factor of 3 and a quorum of 2.

The `rabbitmq.conf` setting:

```
quorum_queue.initial_cluster_size = 1
```

This must be changed to 3 in production:

```
quorum_queue.initial_cluster_size = 3
```

Until the cluster has 3 nodes, this line must not be set to 3 in dev
or RabbitMQ will refuse to declare queues because it cannot satisfy the
requested initial cluster size.

## Delivery Guarantee Gap

Quorum queues give at-least-once delivery. Combined with my MVCC job
claim pattern, the end-to-end guarantee is:

```
Dev (single node):
  Job execution:        exactly-once via MVCC
  Completion events:    at-least-once, may be lost on broker crash

Prod (3-node cluster):
  Job execution:        exactly-once via MVCC
  Completion events:    at-least-once, survives minority node failure
```

I accept at-least-once for completion events because downstream
consumers of `job.completed` must be idempotent regardless of the
broker topology. I documented this requirement in the consumer contract.

## Consequences

I added `RABBITMQ_NODE_COUNT` to the environment config. The bootstrap
sequence logs a warning on startup if this is 1:

```
WARN  rabbitmq_single_node_mode: no replication, completion events
      may be lost on broker crash. Do not use this in production.
```

I monitor `rabbitmq_queue_messages_ready` and
`rabbitmq_queue_messages_unacknowledged` per queue in Grafana. A growing
unacknowledged count without a corresponding processing rate increase
means consumers are stuck. A growing ready count means the poll loop
is outpacing consumer processing. Both are actionable alerts.