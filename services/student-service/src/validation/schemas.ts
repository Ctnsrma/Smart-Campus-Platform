import {z} from "zod";

export const createProfileSchema = z.object({
    fullName: z.string().trim().min(1,"Full name is required").max(255),
    department: z.string().trim().min(1,"Department is required").max(255),
    semester: z.number().int().min(1,"Semester must be atleast 1").max(12,"Semester must be 12"), 
});

export type CreatorProfileInput = z.infer<typeof createProfileSchema>;
