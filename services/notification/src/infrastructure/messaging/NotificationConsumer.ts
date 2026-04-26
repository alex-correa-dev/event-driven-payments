import { Connection, Channel } from 'amqplib';
import type { NotificationService } from '../../domain/interfaces/NotificationService';
import { logger } from '../logger';
import { config } from '../config';

interface PaymentEvent {
  eventName: string;
  data: {
    orderId: string;
    paymentId?: string;
    amount?: number;
    customer?: {
      name: string;
      email: string;
    };
    error?: string;
    status?: string;
  };
  timestamp: string;
}

export class NotificationConsumer {
  private channel: Channel | null = null;

  constructor(
    private connection: Connection,
    private notificationService: NotificationService
  ) {}

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', { durable: true });
    await this.channel.assertExchange('order.events', 'topic', { durable: true });

    await this.channel.assertQueue(config.rabbitmq.queue, { durable: true });
    await this.channel.assertQueue(config.rabbitmq.deadLetterQueue, { durable: true });

    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.*');
    await this.channel.bindQueue(config.rabbitmq.queue, 'order.events', 'order.*');

    await this.channel.consume(config.rabbitmq.queue, async (msg) => {
      if (!msg) return;

      const content: PaymentEvent = JSON.parse(msg.content.toString());
      logger.info({ eventName: content.eventName }, 'Received event');

      try {
        await this.handleEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error, content }, 'Error processing event');
        this.channel!.nack(msg, false, false);
      }
    });

    logger.info('Notification consumer started');
  }

  private async handleEvent(event: PaymentEvent): Promise<void> {
    switch (event.eventName) {
      case 'payment.create':
        await this.handleOrderReceived(event);
        break;
      case 'payment.processed':
        await this.handlePaymentProcessed(event);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(event);
        break;
      default:
        logger.debug({ eventName: event.eventName }, 'Unhandled event type');
    }
  }

  private async handleOrderReceived(event: PaymentEvent): Promise<void> {
    const { orderId, customer } = event.data;

    if (!customer) {
      logger.warn({ orderId }, 'No customer data found for order received notification');
      return;
    }

    await this.notificationService.send({
      userId: customer.email,
      email: customer.email,
      type: 'ORDER_RECEIVED',
      message: `Seu pedido ${orderId} foi recebido e está sendo processado.`,
    });
  }

  private async handlePaymentProcessed(event: PaymentEvent): Promise<void> {
    const { orderId, customer } = event.data;

    if (!customer) {
      logger.warn({ orderId }, 'No customer data found for payment processed notification');
      return;
    }

    await this.notificationService.send({
      userId: customer.email,
      email: customer.email,
      type: 'PAYMENT_PROCESSED',
      message: `Seu pagamento para o pedido ${orderId} foi processado com sucesso!`,
    });
  }

  private async handlePaymentFailed(event: PaymentEvent): Promise<void> {
    const { orderId, customer, error } = event.data;

    if (!customer) {
      logger.warn({ orderId }, 'No customer data found for payment failed notification');
      return;
    }

    await this.notificationService.send({
      userId: customer.email,
      email: customer.email,
      type: 'PAYMENT_FAILED',
      message: `Falha no processamento do pagamento do pedido ${orderId}. Motivo: ${error || 'Erro desconhecido'}`,
    });
  }
}
