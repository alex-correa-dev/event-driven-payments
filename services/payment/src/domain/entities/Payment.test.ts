import { describe, it, expect, beforeEach } from 'vitest';
import { Payment } from './Payment';

describe('Payment', () => {
  let payment: Payment;

  beforeEach(() => {
    payment = new Payment({
      orderId: 'ORDER-123',
      amount: 100.5,
      status: 'PENDING',
    });
  });

  it('should create payment with generated id', () => {
    expect(payment.id).toBeDefined();
    expect(payment.id.length).toBeGreaterThan(0);
  });

  it('should create payment with provided id', () => {
    const customId = 'CUSTOM-ID-123';
    const paymentWithId = new Payment({
      id: customId,
      orderId: 'ORDER-456',
      amount: 50.0,
      status: 'PENDING',
    });

    expect(paymentWithId.id).toBe(customId);
  });

  it('should create payment with default timestamps', () => {
    expect(payment.createdAt).toBeInstanceOf(Date);
    expect(payment.updatedAt).toBeInstanceOf(Date);
  });

  it('should create payment with provided timestamps', () => {
    const now = new Date();
    const paymentWithDates = new Payment({
      orderId: 'ORDER-789',
      amount: 75.25,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    expect(paymentWithDates.createdAt).toBe(now);
    expect(paymentWithDates.updatedAt).toBe(now);
  });

  it('should process payment from PENDING to PROCESSING', () => {
    payment.process();
    expect(payment.status).toBe('PROCESSING');
  });

  it('should throw error when processing non-PENDING payment', () => {
    payment.process();
    expect(() => payment.process()).toThrow('Cannot process payment with status PROCESSING');
  });

  it('should complete payment from PROCESSING to COMPLETED', () => {
    payment.process();
    payment.complete();
    expect(payment.status).toBe('COMPLETED');
  });

  it('should throw error when completing non-PROCESSING payment', () => {
    expect(() => payment.complete()).toThrow('Cannot complete payment with status PENDING');
  });

  it('should fail payment from PROCESSING to FAILED', () => {
    payment.process();
    payment.fail();
    expect(payment.status).toBe('FAILED');
  });

  it('should throw error when failing non-PROCESSING payment', () => {
    expect(() => payment.fail()).toThrow('Cannot fail payment with status PENDING');
  });

  it('should update updatedAt timestamp on status change', async () => {
    const originalUpdatedAt = payment.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 10));
    payment.process();
    expect(payment.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should preserve orderId and amount', () => {
    expect(payment.orderId).toBe('ORDER-123');
    expect(payment.amount).toBe(100.5);
  });
});
