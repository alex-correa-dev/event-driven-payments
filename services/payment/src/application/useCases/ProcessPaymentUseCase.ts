import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import type { PaymentGateway } from '../../domain/interfaces/PaymentGateway';
import { logger } from '../../infrastructure/logger';

interface PaymentProcessedData {
  paymentId: string;
  orderId: string;
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
}

interface PaymentFailedData {
  paymentId: string;
  orderId: string;
  error: string;
  amount: number;
  customer?: {
    name: string;
    email: string;
  };
}

export class ProcessPaymentUseCase {
  constructor(
    private paymentRepository: PaymentRepository,
    private paymentGateway: PaymentGateway,
    private eventPublisher: EventPublisher
  ) {}

  async execute(
    paymentId: string,
    customer?: { name: string; email: string },
    items?: Array<{ productName: string; quantity: number; price: number }>
  ): Promise<void> {
    logger.debug({ paymentId }, 'Processing payment');

    const payment = await this.paymentRepository.findById(paymentId);

    if (!payment) {
      logger.error({ paymentId }, 'Payment not found');
      throw new Error(`Payment ${paymentId} not found`);
    }

    try {
      payment.process();
      await this.paymentRepository.save(payment);
      logger.debug({ paymentId, status: payment.status }, 'Payment status updated to PROCESSING');

      const result = await this.paymentGateway.charge(payment.orderId, payment.amount);

      if (!result || !result.transactionId) {
        throw new Error('Payment gateway returned invalid response');
      }

      payment.complete();
      await this.paymentRepository.save(payment);

      logger.info(
        {
          paymentId,
          orderId: payment.orderId,
          amount: payment.amount,
          transactionId: result.transactionId,
          paymentMethod: result.method.type,
        },
        'Payment completed successfully'
      );

      const eventData: PaymentProcessedData = {
        paymentId: payment.id,
        orderId: payment.orderId,
        transactionId: result.transactionId,
        paymentMethod: result.method.type,
        amount: payment.amount,
        customer,
        items,
      };
      await this.eventPublisher.publish('payment.processed', eventData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';

      logger.error(
        {
          paymentId,
          orderId: payment.orderId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Payment failed'
      );

      try {
        payment.fail();
        await this.paymentRepository.save(payment);
      } catch (saveError) {
        logger.error({ paymentId, error: saveError }, 'Failed to update payment status to FAILED');
      }

      const eventData: PaymentFailedData = {
        paymentId: payment.id,
        orderId: payment.orderId,
        error: errorMessage,
        amount: payment.amount,
        customer,
      };
      await this.eventPublisher.publish('payment.failed', eventData);

      throw error;
    }
  }
}
