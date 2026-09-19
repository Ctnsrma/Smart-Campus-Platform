import {z} from "zod";

export const createCourseSchema = z.object({
    code: z.string().trim().min(3).max(8),
    title: z.string().trim().min(3).max(40),
    department: z.string().trim().min(3).max(20),
    facultyUserId: z.string().uuid().optional(),
});

export type CourseInput = z.infer<typeof createCourseSchema>;