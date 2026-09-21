import amqp from "amqplib";
import { db } from "../db/client";
import { notifications } from "../db/schema";

const EXCHANGE_NAME = "attendance_events";
const QUEUE_NAME = "notification_service.attendance_low";
const ROUTING_KEY = "attendance.low";

interface AttendanceLowPayload {
  studentUserId: string;
  courseId: string;
  attendancePercentage: number;
}

export async function startConsumer(): Promise<void> {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

  // A durable, named queue survives a RabbitMQ restart and reconnects to
  // the same accumulated messages if this consumer process is briefly
  // down — unlike an anonymous/exclusive queue, which would be deleted
  // the moment this connection closes.
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  console.log(`[notification-service] listening for '${ROUTING_KEY}' events...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const payload: AttendanceLowPayload = JSON.parse(msg.content.toString());
      console.log("[notification-service] received event:", payload);

      await db.insert(notifications).values({
        studentUserId: payload.studentUserId,
        courseId: payload.courseId,
        attendancePercentage: payload.attendancePercentage,
        message: `Your attendance has dropped to ${payload.attendancePercentage}%. Please review your attendance record.`,
      });

      channel.ack(msg);
    } catch (err) {
      console.error("[notification-service] failed to process message:", err);
      channel.nack(msg, false, false);
    }
  });
}