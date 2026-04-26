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
  logger.info('🚀 Starting Notification Service...');

  const connection = await amqp.connect(config.rabbitmq.url);
  logger.info('✅ Connected to RabbitMQ');

  const channel = await connection.createChannel();

  await channel.assertExchange('payment.events', 'topic', { durable: true });
  await channel.assertQueue(config.rabbitmq.queue, { durable: true });

  await channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.processed');
  await channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.failed');

  const notificationService = new MockNotificationService();

  await channel.consume(config.rabbitmq.queue, async (msg) => {
    if (!msg) return;

    const content: PaymentEvent = JSON.parse(msg.content.toString());
    const { orderId, customer, amount, error, transactionId } = content.data;

    logger.info(
      {
        eventName: content.eventName,
        orderId,
        hasCustomer: !!customer,
      },
      '📨 Received event for notification'
    );

    try {
      if (!customer) {
        logger.warn({ orderId }, '⚠️ No customer data found, skipping notification');
        channel.ack(msg);
        return;
      }

      if (content.eventName === 'payment.processed') {
        logger.info({ orderId, transactionId, amount }, '💰 Sending payment success notification');

        await notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_PROCESSED',
          message: `✅ Pagamento aprovado! Seu pedido ${orderId} foi processado com sucesso no valor de R$ ${amount?.toFixed(2)}. Transação: ${transactionId}`,
        });
      } else if (content.eventName === 'payment.failed') {
        logger.warn({ orderId, error }, '⚠️ Sending payment failure notification');

        await notificationService.send({
          userId: customer.email,
          email: customer.email,
          type: 'PAYMENT_FAILED',
          message: `❌ Falha no pagamento! Seu pedido ${orderId} não pôde ser processado. Motivo: ${error || 'Erro desconhecido'}. Entre em contato com o suporte.`,
        });
      }

      channel.ack(msg);
      logger.info(
        { orderId, eventName: content.eventName },
        '✅ Notification processed successfully'
      );
    } catch (err) {
      logger.error({ error: err, orderId }, '❌ Error processing notification');
      channel.nack(msg, false, true);
    }
  });

  logger.info(
    `🎧 Notification Service listening on ${config.rabbitmq.queue} for payment.processed and payment.failed events`
  );
  logger.info('📧 Will send email notifications to customers');

  process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down...');
    await connection.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, '💥 Fatal error');
  process.exit(1);
});
