import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PostgresPaymentRepository } from './PostgresPaymentRepository';
import { Payment } from '../../domain/entities/Payment';

vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockPool = {
    query: mockQuery,
  };
  return {
    Pool: vi.fn(() => mockPool),
  };
});

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('PostgresPaymentRepository', () => {
  let mockPool: Pool;
  let repository: PostgresPaymentRepository;

  beforeEach(() => {
    mockPool = new Pool();
    repository = new PostgresPaymentRepository(mockPool);
  });

  const createTestPayment = () => {
    return new Payment({
      orderId: 'ORDER-123',
      amount: 99.99,
      status: 'PENDING',
    });
  };

  describe('save', () => {
    it('should save payment successfully', async () => {
      const payment = createTestPayment();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      await repository.save(payment);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments'),
        expect.arrayContaining([
          payment.id,
          payment.orderId,
          payment.amount,
          payment.status,
          payment.createdAt,
          payment.updatedAt,
        ])
      );
    });

    it('should update existing payment on conflict', async () => {
      const payment = createTestPayment();
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      await repository.save(payment);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (id) DO UPDATE'),
        expect.any(Array)
      );
    });

    it('should throw error when database fails', async () => {
      const payment = createTestPayment();
      const dbError = new Error('Database connection failed');
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValue(dbError);

      await expect(repository.save(payment)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should return payment when found', async () => {
      const payment = createTestPayment();
      const mockRow = {
        id: payment.id,
        order_id: payment.orderId,
        amount: payment.amount.toString(),
        status: payment.status,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
      };
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById(payment.id);

      expect(result).toBeInstanceOf(Payment);
      expect(result?.id).toBe(payment.id);
      expect(result?.orderId).toBe(payment.orderId);
      expect(result?.amount).toBe(payment.amount);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM payments WHERE id = $1', [
        payment.id,
      ]);
    });

    it('should return null when payment not found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByOrderId', () => {
    it('should return all payments for an order', async () => {
      const payment1 = createTestPayment();
      const payment2 = createTestPayment();

      const mockRows = [
        {
          id: payment1.id,
          order_id: payment1.orderId,
          amount: payment1.amount.toString(),
          status: payment1.status,
          created_at: payment1.createdAt,
          updated_at: payment1.updatedAt,
        },
        {
          id: payment2.id,
          order_id: payment2.orderId,
          amount: payment2.amount.toString(),
          status: payment2.status,
          created_at: payment2.createdAt,
          updated_at: payment2.updatedAt,
        },
      ];
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: mockRows });

      const results = await repository.findByOrderId('ORDER-123');

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(Payment);
      expect(results[1]).toBeInstanceOf(Payment);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
        ['ORDER-123']
      );
    });

    it('should return empty array when no payments found', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

      const results = await repository.findByOrderId('ORDER-999');

      expect(results).toHaveLength(0);
    });
  });
});
