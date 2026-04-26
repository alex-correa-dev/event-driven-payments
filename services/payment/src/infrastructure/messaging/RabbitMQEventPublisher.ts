import { Connection, Channel } from 'amqplib';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import { logger } from '../logger';

interface EventMessage {
  eventName: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export class RabbitMQEventPublisher implements EventPublisher {
  private connection: Connection;
  private channel: Channel | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async connect(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', {
      durable: true,
      autoDelete: false,
    });

    logger.info('RabbitMQ Publisher ready');
  }

  async publish(eventName: string, data: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    const message: EventMessage = {
      eventName,
      data,
      timestamp: new Date().toISOString(),
    };

    this.channel!.publish('payment.events', eventName, Buffer.from(JSON.stringify(message)));
    logger.debug({ eventName, data }, 'Event published');
  }
}
