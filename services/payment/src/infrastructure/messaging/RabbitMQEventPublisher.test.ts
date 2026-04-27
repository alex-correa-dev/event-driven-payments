import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RabbitMQEventPublisher } from './RabbitMQEventPublisher';
import type { Connection, Channel } from 'amqplib';

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('RabbitMQEventPublisher', () => {
  let mockChannel: Channel;
  let mockConnection: Connection;
  let publisher: RabbitMQEventPublisher;

  beforeEach(() => {
    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Channel;

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Connection;

    publisher = new RabbitMQEventPublisher(mockConnection);
  });

  describe('connect', () => {
    it('should create channel and assert exchange', async () => {
      await publisher.connect();

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith('payment.events', 'topic', {
        durable: true,
        autoDelete: false,
      });
    });

    it('should log info when connected', async () => {
      await publisher.connect();

      const { logger } = await import('../logger');
      expect(logger.info).toHaveBeenCalledWith('RabbitMQ Publisher ready');
    });
  });

  describe('publish', () => {
    it('should publish message to exchange', async () => {
      await publisher.connect();

      const eventName = 'payment.created';
      const data = { paymentId: '123', orderId: 'ORD-123', amount: 99.99 };

      await publisher.publish(eventName, data);

      expect(mockChannel.publish).toHaveBeenCalledTimes(1);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'payment.events',
        eventName,
        expect.any(Buffer)
      );
    });

    it('should include eventName, data and timestamp in message', async () => {
      await publisher.connect();

      const eventName = 'payment.created';
      const data = { paymentId: '123' };

      await publisher.publish(eventName, data);

      const publishCall = (mockChannel.publish as ReturnType<typeof vi.fn>).mock.calls[0];
      const publishedBuffer = publishCall[2];
      const publishedMessage = JSON.parse(publishedBuffer.toString());

      expect(publishedMessage.eventName).toBe(eventName);
      expect(publishedMessage.data).toEqual(data);
      expect(publishedMessage.timestamp).toBeDefined();
      expect(new Date(publishedMessage.timestamp)).toBeInstanceOf(Date);
    });

    it('should auto-connect if channel does not exist', async () => {
      expect(mockConnection.createChannel).not.toHaveBeenCalled();

      await publisher.publish('payment.created', {});

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('should handle multiple publishes correctly', async () => {
      await publisher.connect();

      await publisher.publish('payment.created', { id: 1 });
      await publisher.publish('payment.processed', { id: 2 });
      await publisher.publish('payment.failed', { id: 3 });

      expect(mockChannel.publish).toHaveBeenCalledTimes(3);
    });

    it('should log debug when event published', async () => {
      await publisher.connect();

      await publisher.publish('payment.created', { test: 'data' });

      const { logger } = await import('../logger');
      expect(logger.debug).toHaveBeenCalledWith(
        { eventName: 'payment.created', data: { test: 'data' } },
        'Event published'
      );
    });
  });
});
