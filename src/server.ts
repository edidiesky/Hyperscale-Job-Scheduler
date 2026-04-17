import { app } from "./app";
import logger from "./shared/utils/logger";
import { bootstrapServer } from "./bootStrap";
import { registerShutdownHooks } from "./shutdown";
import { SCHEDULER_PORT, SERVICE_NAME } from "./shared/constants";

async function main(): Promise<void> {
  await bootstrapServer();

  const server = app.listen(SCHEDULER_PORT, () => {
    logger.info("server_started", {
      event: "server_started",
      service: SERVICE_NAME,
      port: SCHEDULER_PORT,
    });
  });

  registerShutdownHooks(server);
}

main().catch((error: Error) => {
  logger.error("server_fatal_error", {
    event: "server_fatal_error",
    service: SERVICE_NAME,
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});