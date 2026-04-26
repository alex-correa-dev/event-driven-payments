import amqp from 'amqplib';
import { MockInvoiceService } from '../application/services/MockInvoiceService';
import { InvoiceConsumer } from './messaging/InvoiceConsumer';
import { logger } from './logger';
import { config } from './config';

async function main() {
  logger.info('Starting Invoice Service...');

  const connection = await amqp.connect(config.rabbitmq.url);
  logger.info('Connected to RabbitMQ');

  const invoiceService = new MockInvoiceService();
  const consumer = new InvoiceConsumer(connection, invoiceService);

  await consumer.start();

  logger.info('Invoice Service listening for payment.processed events...');

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
