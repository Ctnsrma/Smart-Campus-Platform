import "dotenv/config";
import express,{ Request,Response } from "express";
import { requireAuth, requireRole,AuthenticatedRequest } from "./middleware/auth";
import { createCourseSchema } from "./validation/schemas";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { courses } from "./db/schema";

export function createApp(){
    const app = express();
    app.use(express.json());

    app.get("/health",(_req:Request,res:Response)=>{
        res.status(200).json({
            status: "OK",
            service: "course-service",
            timestamp: new Date().toISOString(),
        });
    });

    app.post("/courses",requireAuth, requireRole("FACULTY", "ADMIN"), async (req:AuthenticatedRequest, res:Response)=>{
        const parsed = createCourseSchema.safeParse(req.body);
        if(!parsed.success){
            res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
            return;
        }
        
        const {code,title,department,facultyUserId: requestedFacultyUserId} = parsed.data;

        const facultyUserId = 
            req.user?.role === "ADMIN" && requestedFacultyUserId ? requestedFacultyUserId : req.user?.sub;

        if (!facultyUserId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const existing = await db.select().from(courses).where(eq(courses.code,code)).limit(1);
        if(existing.length > 0){
            res.status(409).json({error: "A course with this code already exists"});
            return;
        }

        const [created] = await db
            .insert(courses)
            .values({code,title,department,facultyUserId})
            .returning();

        res.status(201).json({course: created});
    })

    app.get("/courses",requireAuth, async(req:AuthenticatedRequest,res:Response)=>{
        const allCourses = await db.select().from(courses);
        return res.status(200).json({courses: allCourses});
    })
    return app;
};

