import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentConsumer } from './PaymentConsumer';
import type { Connection, Channel, Message } from 'amqplib';
import type { CreatePaymentUseCase } from '../../application/useCases/CreatePaymentUseCase';
import type { ProcessPaymentUseCase } from '../../application/useCases/ProcessPaymentUseCase';

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('PaymentConsumer', () => {
  let mockConnection: Connection;
  let mockChannel: Channel;
  let mockCreatePaymentUseCase: CreatePaymentUseCase;
  let mockProcessPaymentUseCase: ProcessPaymentUseCase;
  let consumer: PaymentConsumer;
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
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Channel;

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
    } as unknown as Connection;

    mockCreatePaymentUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'payment-123',
        orderId: 'ORD-123',
        amount: 99.99,
        status: 'PENDING',
      }),
    } as unknown as CreatePaymentUseCase;

    mockProcessPaymentUseCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProcessPaymentUseCase;

    consumer = new PaymentConsumer(
      mockConnection,
      mockCreatePaymentUseCase,
      mockProcessPaymentUseCase
    );
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

  describe('start', () => {
    it('should create channel and assert exchange', async () => {
      await consumer.start();

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('payment.events', 'topic', {
        durable: true,
      });
    });

    it('should assert queue and bind to payment.create', async () => {
      await consumer.start();

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('payment.service.queue', {
        durable: true,
      });
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        'payment.service.queue',
        'payment.events',
        'payment.create'
      );
    });

    it('should start consuming messages', async () => {
      await consumer.start();

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'payment.service.queue',
        expect.any(Function)
      );
    });
  });

  describe('message handling', () => {
    const validEvent = {
      eventName: 'payment.create',
      data: {
        orderId: 'ORD-123',
        amount: 99.99,
        customer: {
          name: 'João Silva',
          email: 'joao@email.com',
        },
        items: [{ productName: 'Notebook', quantity: 1, price: 99.99 }],
      },
      timestamp: new Date().toISOString(),
    };

    it('should process payment.create event successfully', async () => {
      await consumer.start();

      const msg = createMessage(validEvent);
      await capturedCallback!(msg);

      expect(mockCreatePaymentUseCase.execute).toHaveBeenCalledWith({
        orderId: 'ORD-123',
        amount: 99.99,
      });
      expect(mockProcessPaymentUseCase.execute).toHaveBeenCalledWith(
        'payment-123',
        validEvent.data.customer,
        validEvent.data.items
      );
      expect(mockChannel.ack).toHaveBeenCalled();
    });

    it('should ignore non-payment.create events', async () => {
      await consumer.start();

      const event = {
        eventName: 'payment.processed',
        data: { orderId: 'ORD-123' },
        timestamp: new Date().toISOString(),
      };

      const msg = createMessage(event);
      await capturedCallback!(msg);

      expect(mockCreatePaymentUseCase.execute).not.toHaveBeenCalled();
      expect(mockProcessPaymentUseCase.execute).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalled();
    });

    it('should handle missing data gracefully', async () => {
      await consumer.start();

      const event = {
        eventName: 'payment.create',
        data: {},
        timestamp: new Date().toISOString(),
      };

      const msg = createMessage(event);
      await capturedCallback!(msg);

      expect(mockCreatePaymentUseCase.execute).toHaveBeenCalledWith({
        orderId: undefined,
        amount: undefined,
      });
    });

    it('should nack message with requeue true on error', async () => {
      await consumer.start();
      mockCreatePaymentUseCase.execute = vi.fn().mockRejectedValue(new Error('Database error'));

      const msg = createMessage(validEvent);
      await capturedCallback!(msg);

      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, true);
    });
  });

  describe('stop', () => {
    it('should close channel when stop is called', async () => {
      await consumer.start();
      await consumer.stop();

      expect(mockChannel.close).toHaveBeenCalled();
    });

    it('should not throw if stop called before start', async () => {
      await expect(consumer.stop()).resolves.not.toThrow();
    });
  });
});
