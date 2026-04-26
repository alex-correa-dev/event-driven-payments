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
    type: 'ORDER_RECEIVED' as const,
    message: 'Seu pedido foi recebido',
  };

  it('should send notification successfully', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const result = await notificationService.send(validDto);

    expect(result.id).toBeDefined();
    expect(result.userId).toBe(validDto.userId);
    expect(result.email).toBe(validDto.email);
    expect(result.type).toBe(validDto.type);
    expect(result.message).toBe(validDto.message);
    expect(result.status).toBe('SENT');
    expect(result.sentAt).toBeDefined();
  });

  it('should fail notification when random fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

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
