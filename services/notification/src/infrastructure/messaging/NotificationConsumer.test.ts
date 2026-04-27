import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationConsumer } from './NotificationConsumer';
import type { Connection, Channel, Message } from 'amqplib';
import type { NotificationService } from '../../domain/interfaces/NotificationService';

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

describe('NotificationConsumer', () => {
  let mockConnection: Connection;
  let mockChannel: MockChannel;
  let mockNotificationService: NotificationService;
  let consumer: NotificationConsumer;
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
    };

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel as unknown as Channel),
    } as unknown as Connection;

    mockNotificationService = {
      send: vi.fn().mockResolvedValue({ id: 'notif-123', status: 'SENT' }),
    };

    consumer = new NotificationConsumer(mockConnection, mockNotificationService);
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

  it('should handle payment.create event', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.create',
      data: {
        orderId: 'ORD-123',
        customer: {
          email: 'cliente@test.com',
          name: 'Cliente Teste',
        },
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'cliente@test.com',
        type: 'ORDER_RECEIVED',
      })
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle payment.processed event', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORD-123',
        customer: {
          email: 'cliente@test.com',
          name: 'Cliente Teste',
        },
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'cliente@test.com',
        type: 'PAYMENT_PROCESSED',
      })
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle payment.failed event', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.failed',
      data: {
        orderId: 'ORD-123',
        customer: {
          email: 'cliente@test.com',
          name: 'Cliente Teste',
        },
        error: 'Insufficient funds',
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'cliente@test.com',
        type: 'PAYMENT_FAILED',
      })
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle missing customer data gracefully', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.create',
      data: {
        orderId: 'ORD-123',
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockNotificationService.send).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should nack message with requeue true on error', async () => {
    await consumer.start();
    mockNotificationService.send = vi.fn().mockRejectedValue(new Error('Service failed'));

    const event = {
      eventName: 'payment.create',
      data: {
        orderId: 'ORD-123',
        customer: {
          email: 'cliente@test.com',
          name: 'Cliente Teste',
        },
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, true);
  });

  it('should ignore unknown events', async () => {
    await consumer.start();

    const event = {
      eventName: 'unknown.event',
      data: {},
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockNotificationService.send).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });
});
