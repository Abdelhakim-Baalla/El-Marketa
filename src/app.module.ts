import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Charge les variables .env
    PrismaModule, AuthModule, CatalogModule, // Ajoute le module Prisma
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
