import { Connection, Channel, Message } from 'amqplib';
import type { InventoryService } from '../../domain/interfaces/InventoryService';
import { logger } from '../logger';
import { config } from '../config';

interface PaymentEvent {
  eventName: string;
  data: {
    orderId: string;
    paymentId?: string;
    amount?: number;
    customer?: {
      name: string;
      email: string;
    };
    products?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    error?: string;
    status?: string;
  };
  timestamp: string;
}

interface InventoryUpdateEvent {
  orderId: string;
  success: boolean;
  message?: string;
}

export class InventoryConsumer {
  private channel: Channel | null = null;

  constructor(
    private connection: Connection,
    private inventoryService: InventoryService
  ) {}

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', { durable: true });
    await this.channel.assertExchange('inventory.events', 'topic', { durable: true });

    await this.channel.assertQueue(config.rabbitmq.queue, { durable: true });
    await this.channel.assertQueue(config.rabbitmq.deadLetterQueue, { durable: true });

    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.processed');

    await this.channel.consume(config.rabbitmq.queue, async (msg: Message | null) => {
      if (!msg) return;

      const content: PaymentEvent = JSON.parse(msg.content.toString());
      logger.info({ eventName: content.eventName }, 'Received event');

      try {
        await this.handleEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error, content }, 'Error processing event');
        this.channel!.nack(msg, false, false);
      }
    });

    logger.info('Inventory consumer started');
  }

  private async handleEvent(event: PaymentEvent): Promise<void> {
    if (event.eventName !== 'payment.processed') {
      logger.debug({ eventName: event.eventName }, 'Ignoring event');
      return;
    }

    const { orderId, products } = event.data;

    if (!products || products.length === 0) {
      logger.warn({ orderId }, 'No products found in event');
      return;
    }

    const items = products.map((product) => ({
      productId: this.getProductIdByName(product.name),
      productName: product.name,
      quantity: product.quantity,
      price: product.price,
    }));

    const result = await this.inventoryService.reserveStock({
      orderId,
      items,
    });

    await this.publishInventoryUpdate(result);
  }

  private getProductIdByName(productName: string): string {
    const productMap: Record<string, string> = {
      Notebook: '1',
      Mouse: '2',
      Teclado: '3',
      Monitor: '4',
      Webcam: '5',
      Headset: '6',
      SSD: '7',
      'HD Externo': '8',
      Impressora: '9',
      Tablet: '10',
    };

    return productMap[productName] || '0';
  }

  private async publishInventoryUpdate(result: {
    success: boolean;
    orderId: string;
    message?: string;
  }): Promise<void> {
    const event: InventoryUpdateEvent = {
      orderId: result.orderId,
      success: result.success,
      message: result.message,
    };

    const routingKey = result.success ? 'inventory.reserved' : 'inventory.failed';

    this.channel!.publish('inventory.events', routingKey, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });

    logger.info({ orderId: result.orderId, success: result.success }, 'Inventory update published');
  }
}
