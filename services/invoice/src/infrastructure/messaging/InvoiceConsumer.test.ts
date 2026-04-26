import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoiceConsumer } from './InvoiceConsumer';
import type { Connection, Channel, Message } from 'amqplib';
import type { InvoiceService } from '../../domain/interfaces/InvoiceService';

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
      queue: 'invoice.service.queue',
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

describe('InvoiceConsumer', () => {
  let mockConnection: Connection;
  let mockChannel: MockChannel;
  let mockInvoiceService: InvoiceService;
  let consumer: InvoiceConsumer;
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

    mockInvoiceService = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        invoiceNumber: 'NF-123',
        accessKey: 'KEY-123',
        pdfUrl: 'https://example.com',
      }),
    };

    consumer = new InvoiceConsumer(mockConnection, mockInvoiceService);
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

  it('should handle payment.processed event and generate invoice', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        customer: { name: 'João', email: 'joao@email.com' },
        items: [{ productName: 'Notebook', quantity: 1, price: 2999.99 }],
        amount: 2999.99,
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInvoiceService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORDER-123',
        totalAmount: 2999.99,
      })
    );
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should publish invoice.generated event on success', async () => {
    await consumer.start();
    mockInvoiceService.generate = vi
      .fn()
      .mockResolvedValue({ success: true, invoiceNumber: 'NF-123', accessKey: 'KEY-123' });

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        customer: { name: 'João', email: 'joao@email.com' },
        items: [{ productName: 'Notebook', quantity: 1, price: 2999.99 }],
        amount: 2999.99,
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      'invoice.events',
      'invoice.generated',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  it('should publish invoice.failed event on failure', async () => {
    await consumer.start();
    mockInvoiceService.generate = vi
      .fn()
      .mockResolvedValue({ success: false, message: 'SEFAZ error' });

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        customer: { name: 'João', email: 'joao@email.com' },
        items: [{ productName: 'Notebook', quantity: 1, price: 2999.99 }],
        amount: 2999.99,
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      'invoice.events',
      'invoice.failed',
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

    expect(mockInvoiceService.generate).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle missing customer data gracefully', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: { orderId: 'ORDER-123' },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInvoiceService.generate).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it('should handle missing items gracefully', async () => {
    await consumer.start();

    const event = {
      eventName: 'payment.processed',
      data: {
        orderId: 'ORDER-123',
        customer: { name: 'João', email: 'joao@email.com' },
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInvoiceService.generate).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
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
      data: {
        orderId: 'ORDER-123',
        customer: { name: 'João', email: 'joao@email.com' },
        items,
        amount: 3299.96,
      },
      timestamp: new Date().toISOString(),
    };

    const msg = createMessage(event);
    await capturedCallback!(msg);

    expect(mockInvoiceService.generate).toHaveBeenCalledWith({
      orderId: 'ORDER-123',
      customer: expect.objectContaining({ name: 'João' }),
      items: expect.arrayContaining([
        expect.objectContaining({ productId: '1', productName: 'Notebook' }),
        expect.objectContaining({ productId: '2', productName: 'Mouse' }),
        expect.objectContaining({ productId: '3', productName: 'Teclado' }),
      ]),
      totalAmount: 3299.96,
    });
  });
});
