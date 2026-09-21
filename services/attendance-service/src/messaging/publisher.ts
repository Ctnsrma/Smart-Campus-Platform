import amqp, {Channel, ChannelModel} from "amqplib";

const EXCHANGE_NAME = "attendance_events";

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

export async function getChannel() : Promise<Channel>{
    if (channel) return channel;
    connection = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    return channel;
}

export async function publishEvent(routingKey: string, payload: object): Promise<void> {
  const ch = await getChannel();
  const message = Buffer.from(JSON.stringify(payload));

  ch.publish(EXCHANGE_NAME, routingKey, message, { persistent: true });
  console.log(`[attendance-service] published event: ${routingKey}`, payload);
}

export async function closeConnection(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
  channel = undefined;
  connection = undefined;
}