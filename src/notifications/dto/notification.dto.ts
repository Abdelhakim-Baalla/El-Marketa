export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAID = 'ORDER_PAID',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  LOW_STOCK_ALERT = 'LOW_STOCK_ALERT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export interface NotificationPayload {
  type: NotificationType;
  userId?: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}
