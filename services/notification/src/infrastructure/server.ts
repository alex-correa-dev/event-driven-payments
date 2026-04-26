import amqp from 'amqplib';
import { MockNotificationService } from '../application/services/MockNotificationService';
import { NotificationConsumer } from './messaging/NotificationConsumer';
import { logger } from './logger';
import { config } from './config';

async function main() {
  logger.info('Starting Notification Service...');

  const connection = await amqp.connect(config.rabbitmq.url);
  logger.info('Connected to RabbitMQ');

  const notificationService = new MockNotificationService();
  const consumer = new NotificationConsumer(connection, notificationService);

  await consumer.start();

  logger.info('Notification Service listening for payment.processed and payment.failed events...');

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
