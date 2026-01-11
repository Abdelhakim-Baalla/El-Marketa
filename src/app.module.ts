import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Charge les variables .env
    PrismaModule, AuthModule, CatalogModule, InventoryModule, // Ajoute le module Prisma
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
