export type NotificationType = 'ORDER_RECEIVED' | 'PAYMENT_PROCESSED' | 'PAYMENT_FAILED';

export interface Notification {
  id: string;
  userId: string;
  email: string;
  type: NotificationType;
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: Date;
  sentAt?: Date;
}

export interface SendNotificationDTO {
  userId: string;
  email: string;
  type: NotificationType;
  message: string;
}
