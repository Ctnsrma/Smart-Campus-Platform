import { createApp } from "./app";

const app = createApp();
const PORT = process.env.PORT || 3002;

app.listen(PORT,()=>{
    console.log(`[student-service] listening on port ${PORT}`);
});