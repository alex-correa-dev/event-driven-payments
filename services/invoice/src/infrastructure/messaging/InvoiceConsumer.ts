import { Connection, Channel, Message } from 'amqplib';
import type { InvoiceService } from '../../domain/interfaces/InvoiceService';
import type { GenerateInvoiceDTO } from '../../domain/types';
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
      productName: string;
      quantity: number;
      price: number;
    }>;
  };
  timestamp: string;
}

export class InvoiceConsumer {
  private channel: Channel | null = null;

  constructor(
    private connection: Connection,
    private invoiceService: InvoiceService
  ) {}

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('payment.events', 'topic', { durable: true });
    await this.channel.assertExchange('invoice.events', 'topic', { durable: true });

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
        logger.error({ error }, 'Error processing invoice');
        this.channel!.nack(msg, false, true);
      }
    });

    logger.info('Invoice consumer started');
  }

  private async handleEvent(event: PaymentProcessedEvent): Promise<void> {
    const { orderId, customer, items, amount } = event.data;

    if (!customer) {
      logger.warn({ orderId }, 'No customer data found');
      return;
    }

    if (!items || items.length === 0) {
      logger.warn({ orderId }, 'No items found');
      return;
    }

    const invoiceItems = items.map((item) => ({
      productId: this.getProductIdByName(item.productName),
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    }));

    const dto: GenerateInvoiceDTO = {
      orderId,
      customer: {
        name: customer.name,
        email: customer.email,
        document: `CPF-${Math.floor(Math.random() * 999999999)}`,
      },
      items: invoiceItems,
      totalAmount: amount,
    };

    const result = await this.invoiceService.generate(dto);

    await this.publishInvoiceResult(orderId, result);
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

  private async publishInvoiceResult(
    orderId: string,
    result: { success: boolean; invoiceNumber?: string; accessKey?: string; message?: string }
  ): Promise<void> {
    const event = {
      orderId,
      success: result.success,
      invoiceNumber: result.invoiceNumber,
      accessKey: result.accessKey,
      message: result.message,
    };

    const routingKey = result.success ? 'invoice.generated' : 'invoice.failed';

    this.channel!.publish('invoice.events', routingKey, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });

    logger.info(
      { orderId, success: result.success, invoiceNumber: result.invoiceNumber },
      'Invoice result published'
    );
  }
}
