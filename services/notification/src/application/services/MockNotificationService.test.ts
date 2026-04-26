import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockNotificationService } from './MockNotificationService';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('MockNotificationService', () => {
  let notificationService: MockNotificationService;

  beforeEach(() => {
    notificationService = new MockNotificationService();
  });

  const validDto = {
    userId: 'user@test.com',
    email: 'user@test.com',
    type: 'PAYMENT_PROCESSED' as const,
    message: 'Seu pagamento foi processado com sucesso!',
  };

  it('should send payment processed notification successfully', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const result = await notificationService.send(validDto);

    expect(result.id).toBeDefined();
    expect(result.userId).toBe(validDto.userId);
    expect(result.type).toBe('PAYMENT_PROCESSED');
    expect(result.message).toBe(validDto.message);
    expect(result.status).toBe('SENT');
    expect(result.sentAt).toBeDefined();
  });

  it('should send order received notification', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const orderReceivedDto = {
      userId: 'user@test.com',
      email: 'user@test.com',
      type: 'ORDER_RECEIVED' as const,
      message: 'Seu pedido foi recebido e está sendo processado.',
    };

    const result = await notificationService.send(orderReceivedDto);

    expect(result.type).toBe('ORDER_RECEIVED');
    expect(result.status).toBe('SENT');
  });

  it('should send payment failed notification', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const paymentFailedDto = {
      userId: 'user@test.com',
      email: 'user@test.com',
      type: 'PAYMENT_FAILED' as const,
      message: 'Falha no processamento do pagamento.',
    };

    const result = await notificationService.send(paymentFailedDto);

    expect(result.type).toBe('PAYMENT_FAILED');
    expect(result.status).toBe('SENT');
  });

  it('should fail notification when random fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95);

    const result = await notificationService.send(validDto);

    expect(result.status).toBe('FAILED');
    expect(result.sentAt).toBeUndefined();
  });

  it('should generate unique IDs for each notification', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const result1 = await notificationService.send(validDto);
    const result2 = await notificationService.send(validDto);

    expect(result1.id).not.toBe(result2.id);
  });
});
