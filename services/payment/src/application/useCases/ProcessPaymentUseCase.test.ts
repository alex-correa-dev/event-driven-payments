import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessPaymentUseCase } from './ProcessPaymentUseCase';
import { Payment } from '../../domain/entities/Payment';
import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import type { EventPublisher } from '../../domain/interfaces/EventPublisher';
import type { PaymentGateway } from '../../domain/interfaces/PaymentGateway';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('ProcessPaymentUseCase', () => {
  let processPaymentUseCase: ProcessPaymentUseCase;
  let mockPaymentRepository: PaymentRepository;
  let mockPaymentGateway: PaymentGateway;
  let mockEventPublisher: EventPublisher;
  let testPayment: Payment;

  beforeEach(() => {
    testPayment = new Payment({
      orderId: 'TEST-ORDER-123',
      amount: 99.99,
      status: 'PENDING',
    });

    mockPaymentRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(testPayment),
      findByOrderId: vi.fn(),
    };

    mockPaymentGateway = {
      charge: vi.fn().mockResolvedValue(undefined),
    };

    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    processPaymentUseCase = new ProcessPaymentUseCase(
      mockPaymentRepository,
      mockPaymentGateway,
      mockEventPublisher
    );
  });

  it('should process payment successfully when random success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    await processPaymentUseCase.execute(testPayment.id);

    expect(mockPaymentGateway.charge).toHaveBeenCalledWith(testPayment.orderId, testPayment.amount);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'payment.processed',
      expect.objectContaining({
        paymentId: testPayment.id,
        orderId: testPayment.orderId,
        status: 'COMPLETED',
      })
    );
  });

  it('should fail payment when random fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);

    await processPaymentUseCase.execute(testPayment.id);

    expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'payment.failed',
      expect.objectContaining({
        paymentId: testPayment.id,
        orderId: testPayment.orderId,
        error: 'Payment processing failed',
      })
    );
  });

  it('should throw error when payment not found', async () => {
    mockPaymentRepository.findById = vi.fn().mockResolvedValue(null);

    await expect(processPaymentUseCase.execute('non-existent-id')).rejects.toThrow(
      'Payment non-existent-id not found'
    );
  });

  it('should call payment.process which changes status to PROCESSING', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const processSpy = vi.spyOn(testPayment, 'process');

    await processPaymentUseCase.execute(testPayment.id);

    expect(processSpy).toHaveBeenCalled();
  });

  it('should save payment at least once during process', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    await processPaymentUseCase.execute(testPayment.id);

    expect(mockPaymentRepository.save).toHaveBeenCalled();
    expect(mockPaymentRepository.save.mock.calls.length).toBeGreaterThan(0);
  });

  it('should update payment status to COMPLETED on success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    await processPaymentUseCase.execute(testPayment.id);

    expect(testPayment.status).toBe('COMPLETED');
  });

  it('should update payment status to FAILED on failure', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);

    await processPaymentUseCase.execute(testPayment.id);

    expect(testPayment.status).toBe('FAILED');
  });

  it('should handle gateway errors gracefully', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const gatewayError = new Error('Gateway timeout');
    mockPaymentGateway.charge = vi.fn().mockRejectedValue(gatewayError);

    await expect(processPaymentUseCase.execute(testPayment.id)).rejects.toThrow('Gateway timeout');
  });
});
