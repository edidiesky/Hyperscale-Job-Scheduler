Hyperscale-Job-Scheduler/
├── src/
│   ├── shared/
│   │   ├── constants/
│   │   │   └── index.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── rabbitmq.ts
│   │   ├── messaging/
│   │   │   └── rabbitmq-publisher.ts
│   │   └── middleware/
│   │       ├── auth.middleware.ts
│   │       ├── error-handler.ts
│   │       ├── request-id.middleware.ts
│   │       └── validate-request.middleware.ts
│   │
│   ├── domains/
│   │   ├── auth/
│   │   │   ├── user.model.ts
│   │   │   ├── otp.model.ts
│   │   │   ├── token.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.validator.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   │
│   │   ├── job/
│   │   │   ├── job.model.ts
│   │   │   ├── IJobRepository.ts
│   │   │   ├── job.repository.ts
│   │   │   ├── job.service.ts
│   │   │   ├── job.validator.ts
│   │   │   ├── job.controller.ts
│   │   │   └── job.routes.ts
│   │   │
│   │   ├── dead-letter/
│   │   │   ├── dead-letter.model.ts
│   │   │   ├── dead-letter.repository.ts
│   │   │   └── dead-letter.service.ts
│   │   │
│   │   ├── execution/
│   │   │   ├── execution.model.ts
│   │   │   ├── job-executor.ts
│   │   │   ├── worker.ts
│   │   │   └── retry.service.ts
│   │   │
│   │   ├── scheduler/
│   │   │   ├── redis-job-queue.ts
│   │   │   └── poll-loop.ts
│   │   │
│   │   ├── election/
│   │   │   ├── redlock.ts
│   │   │   └── leader-election.service.ts
│   │   │
│   │   ├── watchdog/
│   │   │   └── heartbeat-watchdog.ts
│   │   │
│   │   └── worker/
│   │       ├── IJobHandler.ts
│   │       ├── job-definitions.ts
│   │       ├── reservation-expiry.handler.ts
│   │       ├── payout-batch.handler.ts
│   │       ├── order-abandonment.handler.ts
│   │       ├── low-stock-alert.handler.ts
│   │       └── scheduled-report.handler.ts
│   │
│   ├── models/
│   │   └── outbox-event.model.ts
│   │
│   ├── utils/
│   │   └── outbox-poller.ts
│   │
│   ├── app.ts
│   ├── bootStrap.ts
│   ├── server.ts
│   └── shutdown.ts
│
├── prometheus/
│   └── prometheus.yml
├── loki/
│   └── loki-config.yml
├── promtail/
│   └── promtail-config.yml
├── tempo/
│   └── tempo-config.yml
├── grafana/
│   └── provisioning/
│       └── datasources/
│           └── datasources.yml
├── rabbitmq/
│   ├── rabbitmq.conf
│   ├── enabled_plugins
│   └── definitions.json
│
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── jest.config.ts
├── package.json
└── tsconfig.json