import { Connection, Channel, Message } from 'amqplib';
import type { NotificationService } from '../../domain/interfaces/NotificationService';
import { logger } from '../logger';
import { config } from '../config';

interface PaymentEvent {
  eventName: string;
  data: {
    orderId: string;
    paymentId?: string;
    transactionId?: string;
    amount?: number;
    customer?: {
      name: string;
      email: string;
    };
    error?: string;
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

    await this.channel.assertQueue(config.rabbitmq.queue, { durable: true });

    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.create');
    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.processed');
    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.failed');

    await this.channel.consume(config.rabbitmq.queue, async (msg: Message | null) => {
      if (!msg) return;

      const content: PaymentEvent = JSON.parse(msg.content.toString());
      logger.info(
        { eventName: content.eventName, orderId: content.data.orderId },
        '📨 Received event'
      );

      try {
        await this.handleEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error, content }, '❌ Error processing event');
        this.channel!.nack(msg, false, true);
      }
    });

    logger.info('✅ Notification consumer started');
  }

  private async handleEvent(event: PaymentEvent): Promise<void> {
    const { orderId, customer, amount, transactionId, error } = event.data;

    if (!customer) {
      logger.warn({ orderId }, '⚠️ No customer data found, skipping notification');
      return;
    }

    switch (event.eventName) {
      case 'payment.create':
        logger.info({ orderId }, '📧 Sending order received notification');
        await this.notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'ORDER_RECEIVED',
          message: `📦 Pedido recebido! Seu pedido ${orderId} foi recebido e está sendo processado.`,
        });
        break;

      case 'payment.processed':
        logger.info({ orderId, transactionId, amount }, '💰 Sending payment success notification');
        await this.notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_PROCESSED',
          message: `✅ Pagamento aprovado! Seu pedido ${orderId} foi processado com sucesso no valor de R$ ${amount?.toFixed(2)}. Transação: ${transactionId}`,
        });
        break;

      case 'payment.failed':
        logger.warn({ orderId, error }, '⚠️ Sending payment failure notification');
        await this.notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_FAILED',
          message: `❌ Falha no pagamento! Seu pedido ${orderId} não pôde ser processado. Motivo: ${error || 'Erro desconhecido'}. Entre em contato com o suporte.`,
        });
        break;

      default:
        logger.debug({ eventName: event.eventName }, '🤔 Unhandled event type');
    }
  }
}
