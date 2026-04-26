import amqp from 'amqplib';
import http from 'http';
import { OrderOrchestrator } from '../application/services/OrderOrchestrator';
import { InMemoryOrderRepository } from './repositories/InMemoryOrderRepository';
import { OrderEventConsumer } from './messaging/OrderEventConsumer';
import { OrderController } from './web/controllers/OrderController';
import { OrderRoutes } from './web/routes/orderRoutes';
import { logger } from './logger';

const EXCHANGE = 'payment.events';
const RABBITMQ_URL = 'amqp://admin:admin123@localhost:5672';

async function main() {
  logger.info('Starting Order Service...');

  const orderRepository = new InMemoryOrderRepository();
  const orderOrchestrator = new OrderOrchestrator(orderRepository);

  const rabbitConnection = await amqp.connect(RABBITMQ_URL);
  logger.info('Connected to RabbitMQ');

  const channel = await rabbitConnection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  const eventConsumer = new OrderEventConsumer(rabbitConnection, orderOrchestrator);
  await eventConsumer.start();

  const orderController = new OrderController(orderOrchestrator, channel);
  const orderRoutes = new OrderRoutes(orderController);

  const server = http.createServer(async (req, res) => {
    await orderRoutes.handle(req, res);
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    logger.info(`✅ Order API listening on http://localhost:${PORT}`);
    logger.info('📋 Endpoints:');
    logger.info('   POST   /orders           - Create new order');
    logger.info('   GET    /orders           - List all orders');
    logger.info('   GET    /orders/:orderId  - Get order status');
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
