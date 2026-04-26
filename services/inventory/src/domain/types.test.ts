import { describe, it, expect } from 'vitest';
import type { Product, OrderItem, InventoryReservation, UpdateStockDTO } from './types';

describe('Inventory Types', () => {
  it('should have valid Product structure', () => {
    const product: Product = {
      id: '1',
      name: 'Test Product',
      sku: 'TEST-001',
      quantity: 100,
      reserved: 0,
      price: 99.99,
    };

    expect(product.id).toBe('1');
    expect(product.name).toBe('Test Product');
    expect(product.quantity).toBe(100);
  });

  it('should have valid OrderItem structure', () => {
    const item: OrderItem = {
      productId: '1',
      productName: 'Test Product',
      quantity: 2,
      price: 99.99,
    };

    expect(item.productId).toBe('1');
    expect(item.quantity).toBe(2);
  });

  it('should have valid InventoryReservation structure', () => {
    const reservation: InventoryReservation = {
      id: 'res-123',
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Test', quantity: 2, price: 99.99 }],
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(reservation.id).toBe('res-123');
    expect(reservation.status).toBe('PENDING');
  });

  it('should allow all reservation status types', () => {
    const statuses: InventoryReservation['status'][] = [
      'PENDING',
      'RESERVED',
      'RELEASED',
      'FAILED',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('should have valid UpdateStockDTO structure', () => {
    const dto: UpdateStockDTO = {
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Test', quantity: 2, price: 99.99 }],
    };

    expect(dto.orderId).toBe('ORDER-123');
    expect(dto.items).toHaveLength(1);
  });
});
