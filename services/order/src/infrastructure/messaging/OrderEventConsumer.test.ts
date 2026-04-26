import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderEventConsumer } from './OrderEventConsumer';
import type { Connection, Channel, Message } from 'amqplib';
import type { OrderOrchestrator } from '../../application/services/OrderOrchestrator';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

interface MockChannel {
  assertExchange: ReturnType<typeof vi.fn>;
  assertQueue: ReturnType<typeof vi.fn>;
  bindQueue: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
  ack: ReturnType<typeof vi.fn>;
  nack: ReturnType<typeof vi.fn>;
}

describe('OrderEventConsumer', () => {
  let mockConnection: Connection;
  let mockChannel: MockChannel;
  let mockOrderOrchestrator: OrderOrchestrator;
  let consumer: OrderEventConsumer;
  let capturedCallbacks: Map<string, (msg: Message | null) => Promise<void>>;

  beforeEach(() => {
    capturedCallbacks = new Map();

    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      consume: vi
        .fn()
        .mockImplementation((queue: string, callback: (msg: Message | null) => void) => {
          capturedCallbacks.set(queue, callback as (msg: Message | null) => Promise<void>);
          return vi.fn();
        }),
      ack: vi.fn(),
      nack: vi.fn(),
    };

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel as unknown as Channel),
    } as unknown as Connection;

    mockOrderOrchestrator = {
      updateOrderStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderOrchestrator;

    consumer = new OrderEventConsumer(mockConnection, mockOrderOrchestrator);
  });

  const createMessage = (content: unknown): Message => {
    return {
      content: Buffer.from(JSON.stringify(content)),
      fields: { exchange: '', routingKey: '', consumerTag: '', deliveryTag: 1, redelivered: false },
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

  it('should handle payment.processed event', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: { orderId: 'ORD-123', transactionId: 'TXN-123' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    const callback = capturedCallbacks.get('order.payment.queue');
    await callback!(msg);

    expect(mockOrderOrchestrator.updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'PAYMENT_COMPLETED'
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle payment.failed event', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.failed',
      data: { orderId: 'ORD-123', error: 'Insufficient funds' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    const callback = capturedCallbacks.get('order.payment.queue');
    await callback!(msg);

    expect(mockOrderOrchestrator.updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'PAYMENT_FAILED'
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle inventory.reserved event', async () => {
    await consumer.start();

    const event = {
      eventName: 'inventory.reserved',
      data: { orderId: 'ORD-123', success: true },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    const callback = capturedCallbacks.get('order.inventory.queue');
    await callback!(msg);

    expect(mockOrderOrchestrator.updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'INVENTORY_RESERVED'
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle inventory.failed event', async () => {
    await consumer.start();

    const event = {
      eventName: 'inventory.failed',
      data: { orderId: 'ORD-123', success: false, message: 'Out of stock' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    const callback = capturedCallbacks.get('order.inventory.queue');
    await callback!(msg);

    expect(mockOrderOrchestrator.updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'INVENTORY_FAILED'
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should ignore unknown payment events', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.unknown',
      data: { orderId: 'ORD-123' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    const callback = capturedCallbacks.get('order.payment.queue');
    await callback!(msg);

    expect(mockOrderOrchestrator.updateOrderStatus).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });
});
