import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOrderRepository } from './InMemoryOrderRepository';
import type { Order } from '../../domain/types';

describe('InMemoryOrderRepository', () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  const createTestOrder = (orderId: string): Order => ({
    id: `uuid-${orderId}`,
    orderId,
    customer: { name: 'Teste', email: 'teste@email.com' },
    items: [{ productId: '1', productName: 'Produto', quantity: 1, price: 100 }],
    totalAmount: 100,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should save and find order by orderId', async () => {
    const order = createTestOrder('ORD-123');
    await repository.save(order);
    const found = await repository.findByOrderId('ORD-123');
    expect(found).toEqual(order);
  });

  it('should return null for non-existent order', async () => {
    const found = await repository.findByOrderId('ORD-999');
    expect(found).toBeNull();
  });

  it('should find order by id', async () => {
    const order = createTestOrder('ORD-123');
    await repository.save(order);
    const found = await repository.findById(order.id);
    expect(found).toEqual(order);
  });

  it('should update order status', async () => {
    const order = createTestOrder('ORD-123');
    await repository.save(order);

    const originalUpdatedAt = order.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 10));

    await repository.updateStatus('ORD-123', 'PAYMENT_COMPLETED');
    const updated = await repository.findByOrderId('ORD-123');

    expect(updated?.status).toBe('PAYMENT_COMPLETED');
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
  });

  it('should not fail updating non-existent order', async () => {
    await expect(repository.updateStatus('ORD-999', 'COMPLETED')).resolves.not.toThrow();
  });

  it('should find all orders', async () => {
    const order1 = createTestOrder('ORD-1');
    const order2 = createTestOrder('ORD-2');
    await repository.save(order1);
    await repository.save(order2);

    const all = await repository.findAll();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(order1);
    expect(all).toContainEqual(order2);
  });

  it('should return empty array when no orders', async () => {
    const all = await repository.findAll();
    expect(all).toHaveLength(0);
  });
});
