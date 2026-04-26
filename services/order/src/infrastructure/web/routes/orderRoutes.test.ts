import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { OrderRoutes } from './orderRoutes';
import { OrderController } from '../controllers/OrderController';

vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('OrderRoutes', () => {
  let mockController: OrderController;
  let routes: OrderRoutes;
  let mockReq: Partial<IncomingMessage>;
  let mockRes: Partial<ServerResponse>;

  beforeEach(() => {
    mockController = {
      createOrder: vi.fn().mockResolvedValue(undefined),
      getOrder: vi.fn().mockResolvedValue(undefined),
      getAllOrders: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderController;

    routes = new OrderRoutes(mockController);

    mockRes = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
  });

  it('should route POST /orders to createOrder', async () => {
    mockReq = {
      method: 'POST',
      url: '/orders',
    };

    await routes.handle(mockReq as IncomingMessage, mockRes as ServerResponse);

    expect(mockController.createOrder).toHaveBeenCalled();
  });

  it('should route GET /orders to getAllOrders', async () => {
    mockReq = {
      method: 'GET',
      url: '/orders',
    };

    await routes.handle(mockReq as IncomingMessage, mockRes as ServerResponse);

    expect(mockController.getAllOrders).toHaveBeenCalled();
  });

  it('should route GET /orders/:orderId to getOrder', async () => {
    mockReq = {
      method: 'GET',
      url: '/orders/ORD-123',
    };

    await routes.handle(mockReq as IncomingMessage, mockRes as ServerResponse);

    expect(mockController.getOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'ORD-123'
    );
  });

  it('should return 404 for unknown routes', async () => {
    mockReq = {
      method: 'GET',
      url: '/unknown',
    };

    await routes.handle(mockReq as IncomingMessage, mockRes as ServerResponse);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Not found' }));
  });

  it('should return 404 for unknown method', async () => {
    mockReq = {
      method: 'PUT',
      url: '/orders',
    };

    await routes.handle(mockReq as IncomingMessage, mockRes as ServerResponse);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
  });
});
