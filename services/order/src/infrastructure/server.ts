import amqp from 'amqplib';
import http from 'http';
import { OrderOrchestrator } from '../application/services/OrderOrchestrator';
import { InMemoryOrderRepository } from './repositories/InMemoryOrderRepository';
import { OrderEventConsumer } from './messaging/OrderEventConsumer';
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

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && req.url === '/orders') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const orderData = JSON.parse(body);
          const order = await orderOrchestrator.createOrder(orderData);

          const paymentEvent = {
            eventName: 'payment.create',
            data: {
              orderId: order.orderId,
              amount: order.totalAmount,
              customer: order.customer,
              items: order.items.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
              })),
            },
            timestamp: new Date().toISOString(),
          };

          channel.publish(EXCHANGE, 'payment.create', Buffer.from(JSON.stringify(paymentEvent)), {
            persistent: true,
          });

          logger.info({ orderId: order.orderId }, 'Payment event published');

          res.writeHead(201);
          res.end(
            JSON.stringify({
              orderId: order.orderId,
              status: order.status,
              totalAmount: order.totalAmount,
            })
          );
        } catch (error) {
          logger.error({ error }, 'Error creating order');
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    } else if (req.method === 'GET' && req.url?.startsWith('/orders/')) {
      const orderId = req.url.split('/')[2];
      const order = await orderRepository.findByOrderId(orderId);

      if (order) {
        res.writeHead(200);
        res.end(JSON.stringify(order));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Order not found' }));
      }
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    logger.info(`Order API listening on http://localhost:${PORT}`);
    logger.info('  POST /orders - Create new order');
    logger.info('  GET /orders/:orderId - Get order status');
  });
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
