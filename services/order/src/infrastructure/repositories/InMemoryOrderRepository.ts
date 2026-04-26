import type { OrderRepository } from '../../domain/interfaces/OrderRepository';
import type { Order, OrderStatus } from '../../domain/types';
import { logger } from '../logger';

export class InMemoryOrderRepository implements OrderRepository {
  private ordersByOrderId: Map<string, Order> = new Map();
  private ordersById: Map<string, Order> = new Map();

  async save(order: Order): Promise<void> {
    this.ordersByOrderId.set(order.orderId, order);
    this.ordersById.set(order.id, order);
    logger.debug({ orderId: order.orderId, status: order.status }, 'Order saved');
  }

  async findById(id: string): Promise<Order | null> {
    return this.ordersById.get(id) || null;
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    return this.ordersByOrderId.get(orderId) || null;
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const order = this.ordersByOrderId.get(orderId);
    if (order) {
      const updatedOrder: Order = {
        ...order,
        status,
        updatedAt: new Date(),
      };
      this.ordersByOrderId.set(orderId, updatedOrder);
      this.ordersById.set(updatedOrder.id, updatedOrder);
      logger.info({ orderId, status }, 'Order status updated');
    }
  }

  async findAll(): Promise<Order[]> {
    return Array.from(this.ordersById.values());
  }
}
