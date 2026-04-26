import type { NotificationService } from '../../domain/interfaces/NotificationService';
import type { Notification, SendNotificationDTO } from '../../domain/types';
import { logger } from '../../infrastructure/logger';

export class MockNotificationService implements NotificationService {
  async send(dto: SendNotificationDTO): Promise<Notification> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    const success = Math.random() < 0.9;

    const notification: Notification = {
      id: crypto.randomUUID(),
      userId: dto.userId,
      email: dto.email,
      type: dto.type,
      message: dto.message,
      status: success ? 'SENT' : 'FAILED',
      createdAt: new Date(),
      sentAt: success ? new Date() : undefined,
    };

    if (success) {
      logger.info(
        {
          notificationId: notification.id,
          type: dto.type,
          email: dto.email,
          message: dto.message.substring(0, 50) + '...',
        },
        '✅ Notification sent successfully'
      );
    } else {
      logger.error(
        {
          notificationId: notification.id,
          type: dto.type,
          email: dto.email,
        },
        '❌ Notification failed to send'
      );
    }

    return notification;
  }
}
