import type { Order, OrderStatus } from '../types';

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByOrderId(orderId: string): Promise<Order | null>;
  updateStatus(orderId: string, status: OrderStatus): Promise<void>;
}
