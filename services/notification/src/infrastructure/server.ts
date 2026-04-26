import amqp from 'amqplib';
import { MockNotificationService } from '../application/services/MockNotificationService';
import { logger } from './logger';
import { config } from './config';

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

async function main() {
  logger.info('Starting Notification Service...');

  const connection = await amqp.connect(config.rabbitmq.url);
  logger.info('Connected to RabbitMQ');

  const channel = await connection.createChannel();

  await channel.assertExchange('payment.events', 'topic', { durable: true });
  await channel.assertQueue(config.rabbitmq.queue, { durable: true });

  await channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.processed');
  await channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.failed');

  const notificationService = new MockNotificationService();

  await channel.consume(config.rabbitmq.queue, async (msg) => {
    if (!msg) return;

    const content: PaymentEvent = JSON.parse(msg.content.toString());
    logger.info({ eventName: content.eventName, orderId: content.data.orderId }, 'Received event');

    try {
      const { orderId, customer, amount, error } = content.data;

      if (!customer) {
        logger.warn({ orderId }, 'No customer data found');
        channel.ack(msg);
        return;
      }

      if (content.eventName === 'payment.processed') {
        await notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_PROCESSED',
          message: `Seu pagamento para o pedido ${orderId} no valor de R$ ${amount} foi processado com sucesso!`,
        });
      } else if (content.eventName === 'payment.failed') {
        await notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_FAILED',
          message: `Falha no pagamento do pedido ${orderId}. Motivo: ${error || 'Erro desconhecido'}`,
        });
      }

      channel.ack(msg);
    } catch (error) {
      logger.error({ error }, 'Error processing notification');
      channel.nack(msg, false, true);
    }
  });

  logger.info(`Notification Service listening on ${config.rabbitmq.queue}...`);

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await connection.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
