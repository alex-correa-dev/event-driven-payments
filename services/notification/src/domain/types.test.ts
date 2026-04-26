import { describe, it, expect } from 'vitest';
import type { Notification, NotificationType, SendNotificationDTO } from './types';

describe('Notification Types', () => {
  it('should have valid NotificationType values', () => {
    const types: NotificationType[] = ['ORDER_RECEIVED', 'PAYMENT_PROCESSED', 'PAYMENT_FAILED'];
    expect(types).toHaveLength(3);
  });

  it('should allow creating valid Notification object', () => {
    const notification: Notification = {
      id: '123',
      userId: 'user@test.com',
      email: 'user@test.com',
      type: 'ORDER_RECEIVED',
      message: 'Test message',
      status: 'PENDING',
      createdAt: new Date(),
    };

    expect(notification.id).toBe('123');
    expect(notification.status).toBe('PENDING');
  });

  it('should allow optional sentAt field', () => {
    const notification: Notification = {
      id: '123',
      userId: 'user@test.com',
      email: 'user@test.com',
      type: 'ORDER_RECEIVED',
      message: 'Test message',
      status: 'SENT',
      createdAt: new Date(),
      sentAt: new Date(),
    };

    expect(notification.sentAt).toBeDefined();
  });

  it('should validate SendNotificationDTO structure', () => {
    const dto: SendNotificationDTO = {
      userId: 'user@test.com',
      email: 'user@test.com',
      type: 'ORDER_RECEIVED',
      message: 'Hello',
    };

    expect(dto.userId).toBe('user@test.com');
    expect(dto.type).toBe('ORDER_RECEIVED');
  });
});
