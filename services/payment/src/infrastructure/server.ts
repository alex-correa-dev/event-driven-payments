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

  await channel.assertExchange('payment.events', 'topic', {
    durable: true,
    autoDelete: false,
  });
  logger.info('Exchange "payment.events" created');

  await channel.assertExchange('payment.dlx', 'topic', {
    durable: true,
    autoDelete: false,
  });
  logger.info('Dead Letter Exchange created');

  await channel.assertQueue('payment.queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'payment.dlx',
      'x-dead-letter-routing-key': 'payment.dead',
    },
  });
  logger.info('Queue "payment.queue" created');

  await channel.assertQueue('payment.dead-letter', { durable: true });
  logger.info('Dead Letter Queue created');

  await channel.bindQueue('payment.queue', 'payment.events', 'payment.*');
  await channel.bindQueue('payment.dead-letter', 'payment.dlx', 'payment.dead');
  logger.info('Bindings configured');

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

  await channel.consume('payment.queue', async (msg) => {
    if (!msg) return;

    const content = JSON.parse(msg.content.toString());
    logger.info({ content }, 'Received message');

    try {
      if (content.eventName === 'payment.create') {
        const payment = await createPaymentUseCase.execute(content.data);
        logger.info({ paymentId: payment.id }, 'Payment created');

        await processPaymentUseCase.execute(payment.id);
      }

      channel.ack(msg);
    } catch (error) {
      logger.error({ error, content }, 'Error processing message');

      const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;

      if (retryCount <= 3) {
        logger.info({ retryCount }, 'Retrying message');
        channel.publish('', 'payment.queue', msg.content, {
          headers: { 'x-retry-count': retryCount },
        });
      } else {
        logger.error('Sending to dead letter queue');
        channel.publish('payment.dlx', 'payment.dead', msg.content);
      }

      channel.ack(msg);
    }
  });

  logger.info('Payment Service listening for messages...');

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
