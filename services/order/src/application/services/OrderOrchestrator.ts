import type { OrderRepository } from '../../domain/interfaces/OrderRepository';
import type { Order, CreateOrderDTO, OrderStatus } from '../../domain/types';
import { logger } from '../../infrastructure/logger';

export class OrderOrchestrator {
  constructor(private orderRepository: OrderRepository) {}

  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const totalAmount = dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order: Order = {
      id: crypto.randomUUID(),
      orderId,
      customer: dto.customer,
      items: dto.items,
      totalAmount,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.orderRepository.save(order);
    logger.info({ orderId, totalAmount, itemsCount: dto.items.length }, 'Order created');

    return order;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderRepository.updateStatus(orderId, status);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepository.findByOrderId(orderId);
  }

  async getAllOrders(): Promise<Order[]> {
    return this.orderRepository.findAll();
  }
}
