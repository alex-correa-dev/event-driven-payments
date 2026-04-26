import { Connection, Channel, Message } from 'amqplib';
import type { OrderOrchestrator } from '../../application/services/OrderOrchestrator';
import { logger } from '../logger';

interface PaymentEvent {
  eventName: string;
  data: {
    orderId: string;
    paymentId?: string;
    transactionId?: string;
    paymentMethod?: string;
    amount?: number;
    error?: string;
  };
  timestamp: string;
}

interface InventoryEvent {
  eventName: string;
  data: {
    orderId: string;
    success?: boolean;
    message?: string;
  };
  timestamp: string;
}

interface InvoiceEvent {
  eventName: string;
  data: {
    orderId: string;
    success?: boolean;
    invoiceNumber?: string;
    accessKey?: string;
    message?: string;
  };
  timestamp: string;
}

export class OrderEventConsumer {
  private channel: Channel | null = null;

  constructor(
    private connection: Connection,
    private orderOrchestrator: OrderOrchestrator
  ) {}

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', { durable: true });
    await this.channel.assertExchange('inventory.events', 'topic', { durable: true });
    await this.channel.assertExchange('invoice.events', 'topic', { durable: true });

    await this.channel.assertQueue('order.payment.queue', { durable: true });
    await this.channel.assertQueue('order.inventory.queue', { durable: true });
    await this.channel.assertQueue('order.invoice.queue', { durable: true });

    await this.channel.bindQueue('order.payment.queue', 'payment.events', 'payment.processed');
    await this.channel.bindQueue('order.payment.queue', 'payment.events', 'payment.failed');
    await this.channel.bindQueue('order.inventory.queue', 'inventory.events', 'inventory.reserved');
    await this.channel.bindQueue('order.inventory.queue', 'inventory.events', 'inventory.failed');
    await this.channel.bindQueue('order.invoice.queue', 'invoice.events', 'invoice.generated');
    await this.channel.bindQueue('order.invoice.queue', 'invoice.events', 'invoice.failed');

    await this.channel.consume('order.payment.queue', async (msg: Message | null) => {
      if (!msg) return;
      try {
        const content: PaymentEvent = JSON.parse(msg.content.toString());
        await this.handlePaymentEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error }, 'Error processing payment event');
        this.channel!.nack(msg, false, false);
      }
    });

    await this.channel.consume('order.inventory.queue', async (msg: Message | null) => {
      if (!msg) return;
      try {
        const content: InventoryEvent = JSON.parse(msg.content.toString());
        await this.handleInventoryEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error }, 'Error processing inventory event');
        this.channel!.nack(msg, false, false);
      }
    });

    await this.channel.consume('order.invoice.queue', async (msg: Message | null) => {
      if (!msg) return;
      try {
        const content: InvoiceEvent = JSON.parse(msg.content.toString());
        await this.handleInvoiceEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error }, 'Error processing invoice event');
        this.channel!.nack(msg, false, false);
      }
    });

    logger.info('Order event consumer started');
  }

  private async handlePaymentEvent(event: PaymentEvent): Promise<void> {
    const { orderId } = event.data;

    if (!orderId) {
      logger.warn({ event }, 'No orderId in payment event');
      return;
    }

    switch (event.eventName) {
      case 'payment.processed':
        logger.info({ orderId, transactionId: event.data.transactionId }, 'Payment processed');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'PAYMENT_COMPLETED');
        break;
      case 'payment.failed':
        logger.warn({ orderId, error: event.data.error }, 'Payment failed');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'PAYMENT_FAILED');
        break;
      default:
        logger.debug({ eventName: event.eventName }, 'Ignoring payment event');
    }
  }

  private async handleInventoryEvent(event: InventoryEvent): Promise<void> {
    const orderId = event.data?.orderId;

    if (!orderId) {
      logger.warn({ event }, 'No orderId in inventory event');
      return;
    }

    switch (event.eventName) {
      case 'inventory.reserved':
        logger.info({ orderId }, 'Inventory reserved');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'INVENTORY_RESERVED');
        break;
      case 'inventory.failed':
        logger.warn({ orderId, error: event.data?.message }, 'Inventory reservation failed');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'INVENTORY_FAILED');
        break;
      default:
        logger.debug({ eventName: event.eventName }, 'Ignoring inventory event');
    }
  }

  private async handleInvoiceEvent(event: InvoiceEvent): Promise<void> {
    const orderId = event.data?.orderId;

    if (!orderId) {
      logger.warn({ event }, 'No orderId in invoice event');
      return;
    }

    switch (event.eventName) {
      case 'invoice.generated':
        logger.info({ orderId, invoiceNumber: event.data?.invoiceNumber }, 'Invoice generated');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'COMPLETED');
        break;
      case 'invoice.failed':
        logger.warn({ orderId, error: event.data?.message }, 'Invoice generation failed');
        await this.orderOrchestrator.updateOrderStatus(orderId, 'COMPLETED');
        break;
      default:
        logger.debug({ eventName: event.eventName }, 'Ignoring invoice event');
    }
  }
}
