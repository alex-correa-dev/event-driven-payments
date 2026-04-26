import { Payment } from '../../domain/entities/Payment';
import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import type { CreatePaymentDTO } from '../dtos/CreatePaymentDTO';
import { logger } from '../../infrastructure/logger';

interface PaymentCreatedData {
  paymentId: string;
  orderId: string;
  amount: number;
}

export class CreatePaymentUseCase {
  constructor(
    private paymentRepository: PaymentRepository,
    private eventPublisher: EventPublisher
  ) {}

  async execute(dto: CreatePaymentDTO): Promise<Payment> {
    logger.debug({ orderId: dto.orderId, amount: dto.amount }, 'Creating payment');

    const payment = new Payment({
      orderId: dto.orderId,
      amount: dto.amount,
      status: 'PENDING',
    });

    logger.debug({ paymentId: payment.id }, 'Saving payment to database');
    await this.paymentRepository.save(payment);

    logger.debug({ paymentId: payment.id }, 'Publishing payment.created event');
    const eventData: PaymentCreatedData = {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
    };
    await this.eventPublisher.publish('payment.created', eventData);

    logger.info(
      { paymentId: payment.id, orderId: payment.orderId },
      'Payment created successfully'
    );
    return payment;
  }
}
