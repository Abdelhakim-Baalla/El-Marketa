import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend PrismaService disponible dans tous les modules sans import
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Exporte pour que les autres modules puissent l'utiliser
})
export class PrismaModule {}
