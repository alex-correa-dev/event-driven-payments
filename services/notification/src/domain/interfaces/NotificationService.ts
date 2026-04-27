import type { Notification, SendNotificationDTO } from '../types';

export interface NotificationService {
  send(dto: SendNotificationDTO): Promise<Notification>;
}
