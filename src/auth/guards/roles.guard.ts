import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('🔍 RolesGuard - Required roles:', requiredRoles);

    if (!requiredRoles) {
      console.log('✅ RolesGuard - No roles required, access granted');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('👤 RolesGuard - User:', user);

    if (!user) {
      console.log('❌ RolesGuard - No user found');
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const hasRole = requiredRoles.includes(user.role);

    console.log('🔐 RolesGuard - User role:', user.role);
    console.log('✔️  RolesGuard - Has required role:', hasRole);

    if (!hasRole) {
      console.log('❌ RolesGuard - Access denied');
      throw new ForbiddenException('Accès refusé : rôle insuffisant');
    }

    console.log('✅ RolesGuard - Access granted');
    return true;
  }
}
