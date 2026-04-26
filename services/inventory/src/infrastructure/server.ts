import amqp from 'amqplib';
import { MockInventoryService } from '../application/services/MockInventoryService';
import { InMemoryInventoryRepository } from './repositories/InMemoryInventoryRepository';
import { InventoryConsumer } from './messaging/InventoryConsumer';
import { logger } from './logger';
import { config } from './config';

async function main() {
  logger.info('Starting Inventory Service...');

  const connection = await amqp.connect(config.rabbitmq.url);
  logger.info('Connected to RabbitMQ');

  const inventoryRepository = new InMemoryInventoryRepository();
  const inventoryService = new MockInventoryService(inventoryRepository);
  const consumer = new InventoryConsumer(connection, inventoryService);

  await consumer.start();

  logger.info('Inventory Service listening for payment.processed events...');

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
