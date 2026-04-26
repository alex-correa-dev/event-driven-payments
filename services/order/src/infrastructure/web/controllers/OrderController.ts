import { IncomingMessage, ServerResponse } from 'http';
import { OrderOrchestrator } from '../../../application/services/OrderOrchestrator';
import { logger } from '../../logger';
import amqp from 'amqplib';

const EXCHANGE = 'payment.events';

export class OrderController {
  private channel: amqp.Channel | null = null;

  constructor(
    private orderOrchestrator: OrderOrchestrator,
    private rabbitChannel: amqp.Channel
  ) {
    this.channel = rabbitChannel;
  }

  async createOrder(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const orderData = JSON.parse(body);
        const order = await this.orderOrchestrator.createOrder(orderData);

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

        this.channel!.publish(
          EXCHANGE,
          'payment.create',
          Buffer.from(JSON.stringify(paymentEvent)),
          {
            persistent: true,
          }
        );

        logger.info({ orderId: order.orderId }, 'Payment event published');

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            orderId: order.orderId,
            status: order.status,
            totalAmount: order.totalAmount,
          })
        );
      } catch (error) {
        logger.error({ error }, 'Error creating order');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  }

  async getOrder(req: IncomingMessage, res: ServerResponse, orderId: string): Promise<void> {
    const order = await this.orderOrchestrator.getOrder(orderId);

    if (order) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(order));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Order not found' }));
    }
  }

  async getAllOrders(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const orders = await this.orderOrchestrator.getAllOrders();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(orders));
  }
}
