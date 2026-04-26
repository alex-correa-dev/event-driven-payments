import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import type { PaymentGateway } from '../../domain/interfaces/PaymentGateway';
import { logger } from '../../infrastructure/logger';

interface PaymentProcessedData {
  paymentId: string;
  orderId: string;
  status: 'COMPLETED' | 'FAILED';
}

interface PaymentFailedData {
  paymentId: string;
  orderId: string;
  error: string;
}

export class ProcessPaymentUseCase {
  constructor(
    private paymentRepository: PaymentRepository,
    private paymentGateway: PaymentGateway,
    private eventPublisher: EventPublisher
  ) {}

  async execute(paymentId: string): Promise<void> {
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

      // Mock with a 50% chance of success/error
      const success = Math.random() < 0.5;

      if (success) {
        logger.debug(
          { paymentId, orderId: payment.orderId, amount: payment.amount },
          'Calling payment gateway'
        );
        await this.paymentGateway.charge(payment.orderId, payment.amount);

        payment.complete();
        await this.paymentRepository.save(payment);

        logger.info(
          { paymentId, orderId: payment.orderId, amount: payment.amount },
          'Payment completed successfully'
        );

        const eventData: PaymentProcessedData = {
          paymentId: payment.id,
          orderId: payment.orderId,
          status: 'COMPLETED',
        };
        await this.eventPublisher.publish('payment.processed', eventData);
      } else {
        logger.warn({ paymentId, orderId: payment.orderId }, 'Simulating payment failure');
        payment.fail();
        await this.paymentRepository.save(payment);

        logger.error({ paymentId, orderId: payment.orderId }, 'Payment failed');

        const eventData: PaymentFailedData = {
          paymentId: payment.id,
          orderId: payment.orderId,
          error: 'Payment processing failed',
        };
        await this.eventPublisher.publish('payment.failed', eventData);
      }
    } catch (error) {
      logger.error({ paymentId, error }, 'Error processing payment');
      throw error;
    }
  }
}
