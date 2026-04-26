import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockInventoryService } from './MockInventoryService';
import type { InventoryRepository } from '../../domain/interfaces/InventoryRepository';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('MockInventoryService - Single Product', () => {
  let mockRepository: InventoryRepository;
  let inventoryService: MockInventoryService;

  beforeEach(() => {
    mockRepository = {
      findProductById: vi.fn(),
      updateStock: vi.fn().mockResolvedValue(undefined),
      createReservation: vi.fn().mockResolvedValue(undefined),
      findReservationByOrderId: vi.fn(),
    };

    inventoryService = new MockInventoryService(mockRepository);
  });

  it('should reserve stock for single product successfully', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    (mockRepository.findProductById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '1',
      name: 'Notebook',
      quantity: 50,
      price: 2999.99,
      sku: 'NB-001',
      reserved: 0,
    });

    const result = await inventoryService.reserveStock({
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Notebook', quantity: 2, price: 2999.99 }],
    });

    expect(result.success).toBe(true);
    expect(mockRepository.updateStock).toHaveBeenCalledTimes(1);
    expect(mockRepository.updateStock).toHaveBeenCalledWith('1', 48);
    expect(mockRepository.createReservation).toHaveBeenCalledTimes(1);
  });

  it('should fail when product not found', async () => {
    (mockRepository.findProductById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await inventoryService.reserveStock({
      orderId: 'ORDER-123',
      items: [{ productId: '999', productName: 'Unknown', quantity: 1, price: 100 }],
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Product 999 not found');
    expect(mockRepository.updateStock).not.toHaveBeenCalled();
  });

  it('should fail when insufficient stock', async () => {
    (mockRepository.findProductById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '1',
      name: 'Notebook',
      quantity: 1,
      price: 2999.99,
      sku: 'NB-001',
      reserved: 0,
    });

    const result = await inventoryService.reserveStock({
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Notebook', quantity: 2, price: 2999.99 }],
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient stock');
    expect(mockRepository.updateStock).not.toHaveBeenCalled();
  });

  it('should fail when random number is high', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    (mockRepository.findProductById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '1',
      name: 'Notebook',
      quantity: 50,
      price: 2999.99,
      sku: 'NB-001',
      reserved: 0,
    });

    const result = await inventoryService.reserveStock({
      orderId: 'ORDER-123',
      items: [{ productId: '1', productName: 'Notebook', quantity: 2, price: 2999.99 }],
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Inventory service temporarily unavailable');
    expect(mockRepository.updateStock).not.toHaveBeenCalled();
  });
});
