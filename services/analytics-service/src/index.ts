import "dotenv/config";
import express, { Request, Response } from "express";
import { startConsumer } from "./messaging/consumer";

const app = express();
const PORT = process.env.PORT || 3006;

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "analytics-service",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[analytics-service] listening on port ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("[analytics-service] failed to start consumer:", err);
  process.exit(1);
});