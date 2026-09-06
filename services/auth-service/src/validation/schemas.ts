import {z} from "zod";

export const registerSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, "Password must be atleast 8 characters").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;