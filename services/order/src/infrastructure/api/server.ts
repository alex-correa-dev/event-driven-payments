import http from 'http';
import { OrderOrchestrator } from '../../application/services/OrderOrchestrator';
import { InMemoryOrderRepository } from '../repositories/InMemoryOrderRepository';
import { logger } from '../logger';
import amqp from 'amqplib';

const EXCHANGE = 'payment.events';

async function main() {
  const orderRepository = new InMemoryOrderRepository();
  const orderOrchestrator = new OrderOrchestrator(orderRepository);

  const rabbitConnection = await amqp.connect('amqp://admin:admin123@localhost:5672');
  const channel = await rabbitConnection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/orders') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const orderData = JSON.parse(body);
          const order = await orderOrchestrator.createOrder(orderData);

          await channel.publish(
            EXCHANGE,
            'payment.create',
            Buffer.from(
              JSON.stringify({
                eventName: 'payment.create',
                data: {
                  orderId: order.orderId,
                  amount: order.totalAmount,
                  customer: order.customer,
                  items: order.items,
                },
                timestamp: new Date().toISOString(),
              })
            ),
            { persistent: true }
          );

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ orderId: order.orderId, status: order.status }));
        } catch (error) {
          logger.error({ error }, 'Error creating order');
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    logger.info(`Order API listening on port ${PORT}`);
  });
}

main().catch(console.error);
