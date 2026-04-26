import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderOrchestrator } from './OrderOrchestrator';
import type { OrderRepository } from '../../domain/interfaces/OrderRepository';
import type { CreateOrderDTO } from '../../domain/types';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('OrderOrchestrator', () => {
  let mockRepository: OrderRepository;
  let orchestrator: OrderOrchestrator;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByOrderId: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findAll: vi.fn().mockResolvedValue([]),
    };
    orchestrator = new OrderOrchestrator(mockRepository);
  });

  const validDto: CreateOrderDTO = {
    customer: { name: 'João Silva', email: 'joao@email.com' },
    items: [
      { productId: '1', productName: 'Notebook', quantity: 1, price: 2999.99 },
      { productId: '2', productName: 'Mouse', quantity: 2, price: 49.99 },
    ],
  };

  it('should create order successfully', async () => {
    const order = await orchestrator.createOrder(validDto);

    expect(order.orderId).toMatch(/^ORD-\d+-\d+$/);
    expect(order.customer.email).toBe('joao@email.com');
    expect(order.totalAmount).toBe(3099.97);
    expect(order.status).toBe('PENDING');
    expect(order.items).toHaveLength(2);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should calculate total amount correctly', async () => {
    const order = await orchestrator.createOrder(validDto);
    expect(order.totalAmount).toBe(2999.99 + 2 * 49.99);
  });

  it('should generate unique order IDs', async () => {
    const order1 = await orchestrator.createOrder(validDto);
    const order2 = await orchestrator.createOrder(validDto);
    expect(order1.orderId).not.toBe(order2.orderId);
  });

  it('should update order status', async () => {
    const orderId = 'ORD-123';
    await orchestrator.updateOrderStatus(orderId, 'PAYMENT_COMPLETED');
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(orderId, 'PAYMENT_COMPLETED');
  });

  it('should get order by orderId', async () => {
    const expectedOrder = {
      id: 'uuid',
      orderId: 'ORD-123',
      customer: { name: 'Teste', email: 'teste@email.com' },
      items: [],
      totalAmount: 100,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (mockRepository.findByOrderId as ReturnType<typeof vi.fn>).mockResolvedValue(expectedOrder);

    const order = await orchestrator.getOrder('ORD-123');
    expect(order).toEqual(expectedOrder);
    expect(mockRepository.findByOrderId).toHaveBeenCalledWith('ORD-123');
  });

  it('should return null for non-existent order', async () => {
    (mockRepository.findByOrderId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const order = await orchestrator.getOrder('ORD-999');
    expect(order).toBeNull();
  });

  it('should get all orders', async () => {
    const orders = [
      {
        id: '1',
        orderId: 'ORD-1',
        customer: { name: 'A', email: 'a@a.com' },
        items: [],
        totalAmount: 100,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        orderId: 'ORD-2',
        customer: { name: 'B', email: 'b@b.com' },
        items: [],
        totalAmount: 200,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (mockRepository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue(orders);

    const result = await orchestrator.getAllOrders();
    expect(result).toHaveLength(2);
    expect(mockRepository.findAll).toHaveBeenCalled();
  });

  it('should handle empty items array', async () => {
    const emptyDto: CreateOrderDTO = {
      customer: { name: 'Teste', email: 'teste@email.com' },
      items: [],
    };
    const order = await orchestrator.createOrder(emptyDto);
    expect(order.totalAmount).toBe(0);
  });
});
