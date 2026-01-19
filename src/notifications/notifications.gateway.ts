import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NotificationPayload } from './dto/notification.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');
  private userSockets = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`User ${userId} disconnected`);
        break;
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    this.userSockets.set(data.userId, client.id);
    this.logger.log(`User ${data.userId} registered with socket ${client.id}`);

    return {
      event: 'registered',
      data: { success: true, userId: data.userId },
    };
  }

  sendNotificationToUser(userId: string, notification: NotificationPayload) {
    const socketId = this.userSockets.get(userId);

    if (socketId) {
      this.server.to(socketId).emit('notification', notification);
      this.logger.log(`Notification sent to user ${userId}`);
      return true;
    }

    this.logger.warn(`User ${userId} not connected`);
    return false;
  }

  sendNotificationToAll(notification: NotificationPayload) {
    this.server.emit('notification', notification);
    this.logger.log('Notification sent to all users');
  }

  sendNotificationToAdmins(notification: NotificationPayload) {
    this.server.emit('admin-notification', notification);
    this.logger.log('Notification sent to admins');
  }
}
