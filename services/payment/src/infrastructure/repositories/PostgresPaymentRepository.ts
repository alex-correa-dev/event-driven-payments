import { Pool } from 'pg';
import { Payment, PaymentStatus } from '../../domain/entities/Payment';
import type { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import { logger } from '../logger';

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private pool: Pool) {}

  async save(payment: Payment): Promise<void> {
    const query = `
      INSERT INTO payments (id, order_id, amount, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;

    const values = [
      payment.id,
      payment.orderId,
      payment.amount,
      payment.status,
      payment.createdAt,
      payment.updatedAt,
    ];

    try {
      await this.pool.query(query, values);
      logger.debug({ paymentId: payment.id, status: payment.status }, 'Payment saved');
    } catch (error) {
      logger.error({ paymentId: payment.id, error }, 'Error saving payment');
      throw error;
    }
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await this.pool.query('SELECT * FROM payments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      logger.debug({ paymentId: id }, 'Payment not found');
      return null;
    }

    const row = result.rows[0];
    return new Payment({
      id: row.id,
      orderId: row.order_id,
      amount: parseFloat(row.amount),
      status: row.status as PaymentStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const result = await this.pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );

    return result.rows.map(
      (row) =>
        new Payment({
          id: row.id,
          orderId: row.order_id,
          amount: parseFloat(row.amount),
          status: row.status as PaymentStatus,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
    );
  }
}
