import {z} from "zod";

export const registerSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, "Password must be atleast 8 characters").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;


export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1,"Password is Required"),
});

export type LoginInput = z.infer<typeof loginSchema>