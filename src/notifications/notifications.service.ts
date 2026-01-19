import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationPayload, NotificationType } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private notificationsGateway: NotificationsGateway) {}

  // Notifier un utilisateur spécifique
  notifyUser(userId: string, notification: NotificationPayload) {
    return this.notificationsGateway.sendNotificationToUser(
      userId,
      notification,
    );
  }

  // Notifier tous les utilisateurs
  notifyAll(notification: NotificationPayload) {
    this.notificationsGateway.sendNotificationToAll(notification);
  }

  // Notifier les admins
  notifyAdmins(notification: NotificationPayload) {
    this.notificationsGateway.sendNotificationToAdmins(notification);
  }

  // Notification de commande créée
  notifyOrderCreated(userId: string, orderId: string, totalPrice: number) {
    this.notifyUser(userId, {
      type: NotificationType.ORDER_CREATED,
      userId,
      title: '✅ Commande créée',
      message: `Votre commande #${orderId.slice(0, 8)} de ${totalPrice} DH a été créée`,
      data: { orderId, totalPrice },
      timestamp: new Date(),
    });
  }

  // Notification de paiement réussi
  notifyOrderPaid(userId: string, orderId: string, totalPrice: number) {
    this.notifyUser(userId, {
      type: NotificationType.ORDER_PAID,
      userId,
      title: '💳 Paiement réussi',
      message: `Votre paiement de ${totalPrice} DH a été accepté`,
      data: { orderId, totalPrice },
      timestamp: new Date(),
    });
  }

  // Notification de paiement échoué
  notifyPaymentFailed(userId: string, orderId: string) {
    this.notifyUser(userId, {
      type: NotificationType.PAYMENT_FAILED,
      userId,
      title: '❌ Paiement échoué',
      message: 'Votre paiement a échoué. Veuillez réessayer.',
      data: { orderId },
      timestamp: new Date(),
    });
  }

  // Notification de commande annulée
  notifyOrderCancelled(userId: string, orderId: string) {
    this.notifyUser(userId, {
      type: NotificationType.ORDER_CANCELLED,
      userId,
      title: '🚫 Commande annulée',
      message: `Votre commande #${orderId.slice(0, 8)} a été annulée`,
      data: { orderId },
      timestamp: new Date(),
    });
  }

  // Alerte stock bas (pour les admins)
  notifyLowStock(productName: string, available: number, threshold: number) {
    this.notifyAdmins({
      type: NotificationType.LOW_STOCK_ALERT,
      title: '⚠️ Stock bas',
      message: `${productName} : ${available} unités restantes (seuil: ${threshold})`,
      data: { productName, available, threshold },
      timestamp: new Date(),
    });
  }
}
