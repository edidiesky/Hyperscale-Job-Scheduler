import express from "express";
import cors from 'cors' 
import helmet from 'helmet' 
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import logger from "./utils/logger";
import { INTERNAL_SERVER_ERROR } from "./utils/constants/constants";

dotenv.config();
const app = express();


app.use(helmet())
app.use(
  cors({
    origin: [
      process.env.WEB_ORIGIN!
    ],
    credentials: true,
  })
);

// logs
app.use(morgan('dev'));
app.use(cookieParser())
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// endpoints
app.use((req, res, next)=> {
    const start = process.hrtime();
    res.on("finish", ()=> {
        logger.info("Request latency has been tracked.")
    })
    next()
})

/** HEALTH CHECK */
app.get("/health", (_req, res) => {
  res.json({ status: "Auth route is Fine!" });
});

/** ROUTES */
app.use("/api/v1/tasks", ()=> {});


app.get("/metrics", async (req, res) => {
  try {
    // res.set("Content-Type", authRegistry.contentType);
    // res.end(await authRegistry.metrics());
    logger.info("Auth Metrics has been scraped successfully!");
  } catch (error) {
    logger.error("Auth Metrics scraping error:", { error });
    res.status(INTERNAL_SERVER_ERROR).end();
  }
});

export { app };
