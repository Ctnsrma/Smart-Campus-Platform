import { z } from "zod";

export const markAttendanceSchema = z.object({
  studentUserId: z.string().uuid(),
  courseId: z.string().uuid(),
  status: z.enum(["PRESENT", "ABSENT"]),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;