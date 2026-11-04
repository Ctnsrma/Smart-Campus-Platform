import "dotenv/config";
import { createApp } from "./app";
import { startConsumer } from "./messaging/consumer";

const app = createApp();
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`[notification-service] listening on port ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("[notification-service] failed to start consumer:", err);
  process.exit(1);
});