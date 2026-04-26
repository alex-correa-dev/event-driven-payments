import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePaymentUseCase } from './CreatePaymentUseCase';
import { Payment } from '../../domain/entities/Payment';
import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import type { CreatePaymentDTO } from '../dtos/CreatePaymentDTO';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('CreatePaymentUseCase', () => {
  let createPaymentUseCase: CreatePaymentUseCase;
  let mockPaymentRepository: PaymentRepository;
  let mockEventPublisher: EventPublisher;

  beforeEach(() => {
    mockPaymentRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByOrderId: vi.fn(),
    };

    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    createPaymentUseCase = new CreatePaymentUseCase(mockPaymentRepository, mockEventPublisher);
  });

  const validDto: CreatePaymentDTO = {
    orderId: 'TEST-ORDER-123',
    amount: 99.99,
  };

  it('should create a payment successfully', async () => {
    const payment = await createPaymentUseCase.execute(validDto);

    expect(payment).toBeInstanceOf(Payment);
    expect(payment.orderId).toBe(validDto.orderId);
    expect(payment.amount).toBe(validDto.amount);
    expect(payment.status).toBe('PENDING');
    expect(payment.id).toBeDefined();
  });

  it('should save the payment to the repository', async () => {
    const payment = await createPaymentUseCase.execute(validDto);

    expect(mockPaymentRepository.save).toHaveBeenCalledTimes(1);
    expect(mockPaymentRepository.save).toHaveBeenCalledWith(payment);
  });

  it('should publish payment.created event', async () => {
    const payment = await createPaymentUseCase.execute(validDto);

    expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith('payment.created', {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
    });
  });

  it('should handle repository save failure', async () => {
    const error = new Error('Database connection failed');
    mockPaymentRepository.save = vi.fn().mockRejectedValue(error);

    await expect(createPaymentUseCase.execute(validDto)).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('should handle event publisher failure', async () => {
    const error = new Error('RabbitMQ connection failed');
    mockEventPublisher.publish = vi.fn().mockRejectedValue(error);

    await expect(createPaymentUseCase.execute(validDto)).rejects.toThrow(
      'RabbitMQ connection failed'
    );
  });

  it('should create different IDs for different payments', async () => {
    const payment1 = await createPaymentUseCase.execute(validDto);
    const payment2 = await createPaymentUseCase.execute(validDto);

    expect(payment1.id).not.toBe(payment2.id);
  });

  it('should create payment with correct amount format', async () => {
    const dtoWithDecimal: CreatePaymentDTO = {
      orderId: 'TEST-ORDER-456',
      amount: 123.45,
    };

    const payment = await createPaymentUseCase.execute(dtoWithDecimal);

    expect(payment.amount).toBe(123.45);
  });
});
