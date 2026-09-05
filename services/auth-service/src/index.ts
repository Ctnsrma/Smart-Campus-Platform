import express, {Request,Response} from "express";


const app = express();
const PORT = 3001;

app.get('/health',(_req: Request,res: Response)=>{
    res.status(200).json({
        status: "OK",
        service: "auth-service",
        timestamp: new Date().toISOString(), 
    });
});

app.listen(PORT,()=>{
    console.log(`[auth-service] listening on port ${PORT}`);
});
