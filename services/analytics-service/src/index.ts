import "dotenv/config";
import { createApp } from "./app";
import { startConsumer } from "./messaging/consumer";

const app = createApp();
const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  console.log(`[analytics-service] listening on port ${PORT}`);
});

startConsumer().catch((err) => {
  console.error("[analytics-service] failed to start consumer:", err);
  process.exit(1);
});