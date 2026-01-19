import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { NotificationsService } from './notifications/notifications.service';

@Module({
  providers: [NotificationsGateway, NotificationsService]
})
export class NotificationsModule {}
