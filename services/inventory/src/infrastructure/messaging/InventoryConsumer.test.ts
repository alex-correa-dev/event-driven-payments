import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryConsumer } from './InventoryConsumer';
import type { Connection, Channel, Message } from 'amqplib';
import type { InventoryService } from '../../domain/interfaces/InventoryService';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  config: {
    rabbitmq: {
      queue: 'inventory.queue',
      deadLetterQueue: 'inventory.dead-letter',
    },
  },
}));

interface MockChannel {
  assertExchange: ReturnType<typeof vi.fn>;
  assertQueue: ReturnType<typeof vi.fn>;
  bindQueue: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
  ack: ReturnType<typeof vi.fn>;
  nack: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
}

describe('InventoryConsumer', () => {
  let mockConnection: Connection;
  let mockChannel: MockChannel;
  let mockInventoryService: InventoryService;
  let consumer: InventoryConsumer;
  let capturedCallback: ((msg: Message | null) => Promise<void>) | null;

  beforeEach(() => {
    capturedCallback = null;

    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      consume: vi
        .fn()
        .mockImplementation((_queue: string, callback: (msg: Message | null) => void) => {
          capturedCallback = callback as (msg: Message | null) => Promise<void>;
          return vi.fn();
        }),
      ack: vi.fn(),
      nack: vi.fn(),
      publish: vi.fn(),
    };

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel as unknown as Channel),
    } as unknown as Connection;

    mockInventoryService = {
      reserveStock: vi.fn().mockResolvedValue({ success: true, orderId: 'ORDER-123' }),
    };

    consumer = new InventoryConsumer(mockConnection, mockInventoryService);
  });

  const createMessage = (content: unknown): Message => {
    return {
      content: Buffer.from(JSON.stringify(content)),
      fields: {
        exchange: '',
        routingKey: '',
        consumerTag: '',
        deliveryTag: 1,
        redelivered: false,
      },
      properties: {
        headers: {},
        deliveryMode: 0,
        priority: 0,
        correlationId: '',
        replyTo: '',
        expiration: '',
        messageId: '',
        timestamp: Date.now(),
        type: '',
        userId: '',
        appId: '',
        clusterId: '',
        contentEncoding: '',
        contentLength: 0,
      },
    } as Message;
  };

  it('should handle payment.processed event and reserve stock', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        items: [{ productName: 'Notebook', quantity: 2, price: 2999.99 }],
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInventoryService.reserveStock).toHaveBeenCalledWith({
      orderId: 'ORDER-123',
      items: expect.arrayContaining([
        expect.objectContaining({ productName: 'Notebook', quantity: 2 }),
      ]),
    });
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should publish inventory.reserved event on success', async () => {
    await consumer.start();
    mockInventoryService.reserveStock = vi
      .fn()
      .mockResolvedValue({ success: true, orderId: 'ORDER-123' });

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        items: [{ productName: 'Notebook', quantity: 2, price: 2999.99 }],
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      'inventory.events',
      'inventory.reserved',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  it('should publish inventory.failed event on failure', async () => {
    await consumer.start();
    mockInventoryService.reserveStock = vi
      .fn()
      .mockResolvedValue({ success: false, orderId: 'ORDER-123', message: 'Stock failed' });

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        items: [{ productName: 'Notebook', quantity: 2, price: 2999.99 }],
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      'inventory.events',
      'inventory.failed',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  it('should ignore non-payment.processed events', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.create',
      data: { orderId: 'ORDER-123' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInventoryService.reserveStock).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle missing items gracefully', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: { orderId: 'ORDER-123' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInventoryService.reserveStock).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should nack message on error', async () => {
    await consumer.start();
    mockInventoryService.reserveStock = vi.fn().mockRejectedValue(new Error('Service failed'));

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        items: [{ productName: 'Notebook', quantity: 2, price: 2999.99 }],
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.nack).toHaveBeenCalled();
  });

  it('should map product names to IDs correctly', async () => {
    await consumer.start();

    const items = [
      { productName: 'Notebook', quantity: 1, price: 2999.99 },
      { productName: 'Mouse', quantity: 2, price: 49.99 },
      { productName: 'Teclado', quantity: 1, price: 199.99 },
    ];

    const event = {
      eventName: 'payment.processed',
      data: { orderId: 'ORDER-123', items },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInventoryService.reserveStock).toHaveBeenCalledWith({
      orderId: 'ORDER-123',
      items: expect.arrayContaining([
        expect.objectContaining({ productId: '1', productName: 'Notebook' }),
        expect.objectContaining({ productId: '2', productName: 'Mouse' }),
        expect.objectContaining({ productId: '3', productName: 'Teclado' }),
      ]),
    });
  });
});
