import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Connexion à la base de données au démarrage du module
  async onModuleInit() {
    await this.$connect();
  }

  // Déconnexion propre lors de l'arrêt de l'application
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
