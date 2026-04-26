import { IncomingMessage, ServerResponse } from 'http';
import { OrderController } from '../controllers/OrderController';

export class OrderRoutes {
  constructor(private orderController: OrderController) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '';
    const method = req.method || '';

    // POST /orders
    if (method === 'POST' && url === '/orders') {
      await this.orderController.createOrder(req, res);
      return;
    }

    // GET /orders
    if (method === 'GET' && url === '/orders') {
      await this.orderController.getAllOrders(req, res);
      return;
    }

    // GET /orders/:orderId
    if (method === 'GET' && url.startsWith('/orders/')) {
      const orderId = url.split('/')[2];
      if (orderId) {
        await this.orderController.getOrder(req, res, orderId);
        return;
      }
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
