import "dotenv/config";
import express, {Request,Response} from "express";
import {Pool} from "pg";

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

app.get('/health',(_req: Request,res: Response)=>{
    res.status(200).json({
        status: "OK",
        service: "auth-service",
        timestamp: new Date().toISOString(), 
    });
});

app.get("/db-check", async (_req: Request,res: Response)=>{
    try {
        const result = await pool.query("SELECT NOW() AS curent_time");
        res.status(200).json({
            dbConnected: true,
            currentTime: result.rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({
            dbConnected: false,
            error: (error as Error).message
        });
    }
});

app.listen(PORT,()=>{
    console.log(`[auth-service] listening on port ${PORT}`);
});
