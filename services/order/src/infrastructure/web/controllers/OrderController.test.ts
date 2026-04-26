import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { OrderController } from './OrderController';
import { OrderOrchestrator } from '../../../application/services/OrderOrchestrator';
import type { Channel } from 'amqplib';

vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('OrderController', () => {
  let mockOrderOrchestrator: OrderOrchestrator;
  let mockChannel: Channel;
  let controller: OrderController;
  let mockRes: Partial<ServerResponse>;

  beforeEach(() => {
    mockOrderOrchestrator = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getAllOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
    } as unknown as OrderOrchestrator;

    mockChannel = {
      publish: vi.fn(),
    } as unknown as Channel;

    controller = new OrderController(mockOrderOrchestrator, mockChannel);

    mockRes = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };
  });

  describe('getOrder', () => {
    const mockOrder = {
      orderId: 'ORD-123',
      status: 'PENDING',
      totalAmount: 2999.99,
      customer: { name: 'João', email: 'joao@email.com' },
      items: [],
      id: 'uuid-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return order when found', async () => {
      (mockOrderOrchestrator.getOrder as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      const req = {} as IncomingMessage;
      await controller.getOrder(req, mockRes as ServerResponse, 'ORD-123');

      expect(mockOrderOrchestrator.getOrder).toHaveBeenCalledWith('ORD-123');
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(mockOrder));
    });

    it('should return 404 when order not found', async () => {
      (mockOrderOrchestrator.getOrder as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = {} as IncomingMessage;
      await controller.getOrder(req, mockRes as ServerResponse, 'ORD-999');

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Order not found' }));
    });
  });

  describe('getAllOrders', () => {
    const mockOrders = [
      {
        orderId: 'ORD-1',
        status: 'PENDING',
        totalAmount: 100,
        customer: { name: 'A', email: 'a@a.com' },
        items: [],
        id: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        orderId: 'ORD-2',
        status: 'COMPLETED',
        totalAmount: 200,
        customer: { name: 'B', email: 'b@b.com' },
        items: [],
        id: '2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return all orders', async () => {
      (mockOrderOrchestrator.getAllOrders as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOrders
      );

      const req = {} as IncomingMessage;
      await controller.getAllOrders(req, mockRes as ServerResponse);

      expect(mockOrderOrchestrator.getAllOrders).toHaveBeenCalled();
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(mockOrders));
    });

    it('should return empty array when no orders', async () => {
      (mockOrderOrchestrator.getAllOrders as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = {} as IncomingMessage;
      await controller.getAllOrders(req, mockRes as ServerResponse);

      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify([]));
    });
  });
});
