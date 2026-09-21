import "dotenv/config";
import express, { Request, Response } from "express";
import { startConsumer } from "./messaging/consumer";

const app = express();
const PORT = process.env.PORT || 3005;

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[notification-service] listening on port ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("[notification-service] failed to start consumer:", err);
  process.exit(1);
});