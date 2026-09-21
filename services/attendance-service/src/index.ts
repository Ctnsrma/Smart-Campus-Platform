import { createApp } from "./app";

const app = createApp();
const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`[attendance-service] listening on port ${PORT}`);
});