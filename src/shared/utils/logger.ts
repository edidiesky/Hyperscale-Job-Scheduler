import winston, { format } from "winston";
const logger = winston.createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: "scheduler-service" },
  transports: [
    new winston.transports.Console(),
  ],
});


export default logger;


