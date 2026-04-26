import { Connection, Channel, Message } from 'amqplib';
import type { InventoryService } from '../../domain/interfaces/InventoryService';
import { logger } from '../logger';
import { config } from '../config';

interface PaymentProcessedEvent {
  eventName: string;
  data: {
    orderId: string;
    paymentId: string;
    transactionId: string;
    paymentMethod: string;
    amount: number;
    customer?: {
      name: string;
      email: string;
    };
    items?: Array<{
      productId?: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
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
    await this.channel.bindQueue(config.rabbitmq.queue, 'payment.events', 'payment.processed');

    await this.channel.consume(config.rabbitmq.queue, async (msg: Message | null) => {
      if (!msg) return;

      const content: PaymentProcessedEvent = JSON.parse(msg.content.toString());
      logger.info(
        { eventName: content.eventName, orderId: content.data.orderId },
        'Received payment.processed event'
      );

      try {
        await this.handleEvent(content);
        this.channel!.ack(msg);
      } catch (error) {
        logger.error({ error }, 'Error processing inventory');
        this.channel!.nack(msg, false, true);
      }
    });

    logger.info('Inventory consumer started');
  }

  private async handleEvent(event: PaymentProcessedEvent): Promise<void> {
    const { orderId, items } = event.data;

    if (!items || items.length === 0) {
      logger.warn({ orderId }, 'No products found in event');
      return;
    }

    const inventoryItems = items.map((item) => ({
      productId: this.getProductIdByName(item.productName),
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
    }));

    const result = await this.inventoryService.reserveStock({
      orderId,
      items: inventoryItems,
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
