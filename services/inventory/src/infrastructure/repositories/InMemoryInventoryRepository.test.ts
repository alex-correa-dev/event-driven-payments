import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryInventoryRepository } from './InMemoryInventoryRepository';

describe('InMemoryInventoryRepository', () => {
  let repository: InMemoryInventoryRepository;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
  });

  it('should find product by id', async () => {
    const product = await repository.findProductById('1');

    expect(product).toBeDefined();
    expect(product?.id).toBe('1');
    expect(product?.name).toBe('Notebook');
    expect(product?.quantity).toBe(50);
  });

  it('should return null for non-existent product', async () => {
    const product = await repository.findProductById('999');

    expect(product).toBeNull();
  });

  it('should update stock quantity', async () => {
    await repository.updateStock('1', 45);

    const product = await repository.findProductById('1');
    expect(product?.quantity).toBe(45);
  });

  it('should create reservation', async () => {
    const reservation = {
      id: 'res-123',
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Notebook', quantity: 2, price: 2999.99 }],
      status: 'RESERVED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repository.createReservation(reservation);

    const found = await repository.findReservationByOrderId('ORDER-123');
    expect(found).toEqual(reservation);
  });

  it('should return null for non-existent reservation', async () => {
    const reservation = await repository.findReservationByOrderId('ORDER-999');
    expect(reservation).toBeNull();
  });

  it('should have 10 products initialized', async () => {
    for (let i = 1; i <= 10; i++) {
      const product = await repository.findProductById(i.toString());
      expect(product).toBeDefined();
    }

    const product11 = await repository.findProductById('11');
    expect(product11).toBeNull();
  });
});
