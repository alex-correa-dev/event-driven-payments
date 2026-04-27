import { Connection, Channel, Message } from 'amqplib';
import { CreatePaymentUseCase } from '../../application/useCases/CreatePaymentUseCase';
import { ProcessPaymentUseCase } from '../../application/useCases/ProcessPaymentUseCase';
import { logger } from '../logger';

interface PaymentCreateEvent {
  eventName: string;
  data: {
    orderId: string;
    amount: number;
    customer: {
      name: string;
      email: string;
    };
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
  };
  timestamp: string;
}

export class PaymentConsumer {
  private channel: Channel | null = null;

  constructor(
    private connection: Connection,
    private createPaymentUseCase: CreatePaymentUseCase,
    private processPaymentUseCase: ProcessPaymentUseCase
  ) {}

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', { durable: true });

    const queueName = 'payment.service.queue';
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, 'payment.events', 'payment.create');

    await this.channel.consume(queueName, async (msg: Message | null) => {
      if (!msg) return;

      const content: PaymentCreateEvent = JSON.parse(msg.content.toString());
      logger.info(
        { eventName: content.eventName, orderId: content.data?.orderId },
        '📨 Received payment event'
      );

      try {
        if (content.eventName === 'payment.create') {
          const { orderId, amount, customer, items } = content.data;
          const payment = await this.createPaymentUseCase.execute({ orderId, amount });
          await this.processPaymentUseCase.execute(payment.id, customer, items);
        }

        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error }, '❌ Error processing payment');
        this.channel!.nack(msg, false, true);
      }
    });

    logger.info(`✅ Payment consumer started on queue: ${queueName}`);
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
  }
}
