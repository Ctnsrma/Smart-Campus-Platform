import "dotenv/config";
import express, {Request,Response} from "express";
import { db } from "./db/client";
import { users } from "./db/schema"; 
import { hashPassword } from "./utils/password";
import { eq } from "drizzle-orm";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health',(_req: Request,res: Response)=>{
    res.status(200).json({
        status: "OK",
        service: "auth-service",
        timestamp: new Date().toISOString(), 
    });
});

app.post("/auth/register", async (req:Request,res:Response)=>{
    const {email,password} = req.body;
    if(!email || !password){
        res.status(400).json({error : `email and password required`});
        return;
    }
    const existing = await db.select().from(users).where(eq(users.email,email)).limit(1);

    if(existing.length > 0){
        res.status(409).json({error: `An Account with this email ${email} already exists`});
        return;
    }

    const passwordHash = await hashPassword(password);

    const [created] = await db
    .insert(users)
    .values({email,passwordHash})
    .returning({id: users.id, email: users.email, role: users.role});

    res.status(201).json({user : created});
});


app.listen(PORT,()=>{
    console.log(`[auth-service] listening on port ${PORT}`);
});
