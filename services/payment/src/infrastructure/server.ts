import amqp from 'amqplib';
import { Pool } from 'pg';

import { config } from './config';
import { logger } from './logger';
import { PostgresPaymentRepository } from './repositories/PostgresPaymentRepository';
import { RabbitMQEventPublisher } from './messaging/RabbitMQEventPublisher';
import { MockPaymentGateway } from './gateways/MockPaymentGateway';
import { CreatePaymentUseCase } from '../application/useCases/CreatePaymentUseCase';
import { ProcessPaymentUseCase } from '../application/useCases/ProcessPaymentUseCase';
import { PaymentConsumer } from './messaging/PaymentConsumer';

async function main() {
  logger.info('🚀 Starting Payment Service...');

  const pgPool = new Pool(config.postgres);
  await pgPool.connect();
  logger.info('✅ Connected to PostgreSQL');

  const rabbitConnection = await amqp.connect(config.rabbitmq.url);
  logger.info('✅ Connected to RabbitMQ');

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

  const consumer = new PaymentConsumer(
    rabbitConnection,
    createPaymentUseCase,
    processPaymentUseCase
  );
  await consumer.start();

  logger.info('🎧 Payment Service ready and listening for events');

  process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down...');
    await consumer.stop();
    await rabbitConnection.close();
    await pgPool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, '💥 Fatal error');
  process.exit(1);
});
