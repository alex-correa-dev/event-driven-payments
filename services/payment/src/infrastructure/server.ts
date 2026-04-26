import amqp from 'amqplib';
import { Pool } from 'pg';

import { config } from './config';
import { logger } from './logger';
import { PostgresPaymentRepository } from './repositories/PostgresPaymentRepository';
import { RabbitMQEventPublisher } from './messaging/RabbitMQEventPublisher';
import { MockPaymentGateway } from './gateways/MockPaymentGateway';
import { CreatePaymentUseCase } from '../application/useCases/CreatePaymentUseCase';
import { ProcessPaymentUseCase } from '../application/useCases/ProcessPaymentUseCase';

async function main() {
  logger.info('Starting Payment Service...');

  const pgPool = new Pool(config.postgres);
  await pgPool.connect();
  logger.info('Connected to PostgreSQL');

  const rabbitConnection = await amqp.connect(config.rabbitmq.url);
  logger.info('Connected to RabbitMQ');

  const channel = await rabbitConnection.createChannel();

  await channel.assertExchange('payment.events', 'topic', { durable: true });

  // Criar Dead Letter Exchange
  await channel.assertExchange('payment.dlx', 'topic', { durable: true });

  // Criar fila principal com DLQ
  await channel.assertQueue('payment.queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'payment.dlx',
      'x-dead-letter-routing-key': 'payment.dead',
    },
  });

  // Criar Dead Letter Queue
  await channel.assertQueue('payment.dead-letter', { durable: true });
  await channel.bindQueue('payment.dead-letter', 'payment.dlx', 'payment.dead');

  await channel.bindQueue('payment.queue', 'payment.events', 'payment.create');

  const paymentRepository = new PostgresPaymentRepository(pgPool);
  const eventPublisher = new RabbitMQEventPublisher(rabbitConnection);
  const paymentGateway = new MockPaymentGateway();

  await eventPublisher.connect();

  const createPaymentUseCase = new CreatePaymentUseCase(paymentRepository, eventPublisher);
  const processPaymentUseCase = new ProcessPaymentUseCase(
    paymentRepository,
    paymentGateway,
    eventPublisher
  );

  const retryCount = new Map();

  await channel.consume('payment.queue', async (msg) => {
    if (!msg) return;

    const content = JSON.parse(msg.content.toString());
    logger.info(
      { eventName: content.eventName, orderId: content.data?.orderId },
      'Received payment event'
    );

    try {
      if (content.eventName === 'payment.create') {
        const payment = await createPaymentUseCase.execute(content.data);
        await processPaymentUseCase.execute(payment.id);
      }

      channel.ack(msg);
      retryCount.delete(msg.properties.messageId);
    } catch (error) {
      const messageId = msg.properties.messageId || Math.random().toString();
      const currentRetry = retryCount.get(messageId) || 0;
      const maxRetries = 3;

      if (currentRetry < maxRetries) {
        retryCount.set(messageId, currentRetry + 1);
        logger.warn(
          {
            retry: currentRetry + 1,
            maxRetries,
            orderId: content.data?.orderId,
          },
          'Retrying message'
        );

        channel.nack(msg, false, false);
      } else {
        logger.error(
          {
            orderId: content.data?.orderId,
            error: error instanceof Error ? error.message : error,
          },
          'Max retries reached, sending to DLQ'
        );

        channel.publish('payment.dlx', 'payment.dead', msg.content, { persistent: true });
        channel.ack(msg);
        retryCount.delete(messageId);
      }
    }
  });

  logger.info('Payment Service listening for payment.create events...');

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await channel.close();
    await rabbitConnection.close();
    await pgPool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
