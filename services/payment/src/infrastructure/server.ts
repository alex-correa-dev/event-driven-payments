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

  const queueName = 'payment.service.queue';
  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, 'payment.events', 'payment.create');

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

  await channel.consume(queueName, async (msg) => {
    if (!msg) return;

    const content = JSON.parse(msg.content.toString());
    logger.info(
      { eventName: content.eventName, orderId: content.data?.orderId },
      'Received payment event'
    );

    try {
      if (content.eventName === 'payment.create') {
        const { orderId, amount, customer, items } = content.data;
        const payment = await createPaymentUseCase.execute({ orderId, amount });
        await processPaymentUseCase.execute(payment.id, customer, items);
      }

      channel.ack(msg);
    } catch (error) {
      logger.error({ error }, 'Error processing payment');
      channel.nack(msg, false, true);
    }
  });

  logger.info(`Payment Service listening for payment.create events on queue: ${queueName}`);

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
