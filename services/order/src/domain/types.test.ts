import { describe, it, expect } from 'vitest';
import type { Order, OrderItem, OrderStatus, CreateOrderDTO } from './types';

describe('Order Types', () => {
  it('should have valid Order structure', () => {
    const order: Order = {
      id: 'uuid-123',
      orderId: 'ORD-123',
      customer: { name: 'João', email: 'joao@email.com' },
      items: [],
      totalAmount: 100,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(order.id).toBe('uuid-123');
    expect(order.orderId).toBe('ORD-123');
    expect(order.status).toBe('PENDING');
  });

  it('should allow all order status types', () => {
    const statuses: OrderStatus[] = [
      'PENDING',
      'PAYMENT_PENDING',
      'PAYMENT_PROCESSING',
      'PAYMENT_COMPLETED',
      'PAYMENT_FAILED',
      'INVENTORY_RESERVED',
      'INVENTORY_FAILED',
      'COMPLETED',
      'CANCELLED',
    ];
    expect(statuses).toHaveLength(9);
  });

  it('should have valid OrderItem structure', () => {
    const item: OrderItem = {
      productId: '1',
      productName: 'Notebook',
      quantity: 2,
      price: 2999.99,
    };
    expect(item.productId).toBe('1');
    expect(item.quantity).toBe(2);
  });

  it('should have valid CreateOrderDTO structure', () => {
    const dto: CreateOrderDTO = {
      customer: { name: 'Maria', email: 'maria@email.com' },
      items: [{ productId: '1', productName: 'Mouse', quantity: 1, price: 49.99 }],
    };
    expect(dto.customer.email).toBe('maria@email.com');
    expect(dto.items).toHaveLength(1);
  });
});
