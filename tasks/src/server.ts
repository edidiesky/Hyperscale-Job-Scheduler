import { app } from "./app";
import { config } from "./config";
import { validateConfig } from "./config/config";
import { redisClient } from "./infrastructure/cache/redisClient";
import logger from "./utils/logger";

const PORT = config.server.port;

const startServer = async () => {
  // app listen
  // graceful shutdown
  try {
    // validate config
    validateConfig();
    // set up the various infrastructure
    // redis
    logger.info("Waiting for Redis connection...");
    await redisClient.waitForConnection(1000);
    await redisClient.getClient().ping();
    logger.info("Redis connection established successfully");
    // pg
    // kafka
    // server startup
    const server = app.listen(PORT, () => {
      //   const duration = process.hrtime(startTime);
      //   const seconds = duration[0] + duration[1] / 1e9;
      //   logger.info(`Server is running in ${config.env} mode on port ${PORT}`, {
      //     startupDuration: seconds.toFixed(3),
      //   });
    });

    // GRACEFUL SHTDOWN FOR UNHANDLEREJECTION
    // GRACEFUL SHTDOWN FOR UNCAUGHTEXECPTION
  } catch (error) {
    if (error instanceof Error) {
      logger.error("Server start");
    }
  }
};

startServer().catch((error) => {
  logger.error("Server start");
});
