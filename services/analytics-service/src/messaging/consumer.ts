import amqp from "amqplib";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client";
import { analytics } from "../db/schema";

const EXCHANGE_NAME = "attendance_events";
const QUEUE_NAME = "analytics_service.attendance_marked";
const ROUTING_KEY = "attendance.marked";

interface AttendanceMarkedPayload {
  studentUserId: string;
  courseId: string;
  status: "PRESENT" | "ABSENT";
  attendancePercentage: number;
}

export async function startConsumer(): Promise<void> {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();
  await channel.prefetch(1);

  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  console.log(`[analytics-service] listening for '${ROUTING_KEY}' events...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const payload: AttendanceMarkedPayload = JSON.parse(msg.content.toString());
      console.log("[analytics-service] received event:", payload);

      const wasPresent = payload.status === "PRESENT" ? 1 : 0;

  await db
    .insert(analytics)
    .values({
      studentUserId: payload.studentUserId,
      courseId: payload.courseId,
      totalMarked: 1,
      totalPresent: wasPresent,
      lastAttendancePercentage: payload.attendancePercentage,
    })
    .onConflictDoUpdate({
      target: [analytics.studentUserId, analytics.courseId],
      set: {
        totalMarked: sql`${analytics.totalMarked} + 1`,
        totalPresent: sql`${analytics.totalPresent} + ${wasPresent}`,
        lastAttendancePercentage: payload.attendancePercentage,
        updatedAt: new Date(),
      },
    });

    channel.ack(msg);
    } catch (err) {
      console.error("[analytics-service] failed to process message:", err);
      channel.nack(msg, false, false);
    }
  });
}