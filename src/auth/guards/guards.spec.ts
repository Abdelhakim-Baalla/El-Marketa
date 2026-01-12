import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Role } from '@prisma/client';

describe('Guards', () => {
  describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let jwtService: JwtService;

    const mockJwtService = {
      verifyAsync: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtAuthGuard,
          { provide: JwtService, useValue: mockJwtService },
        ],
      }).compile();

      guard = module.get<JwtAuthGuard>(JwtAuthGuard);
      jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    const createMockExecutionContext = (headers: Record<string, string>): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            headers,
            user: undefined,
          }),
        }),
      } as ExecutionContext;
    };

    it('devrait autoriser l\'accès avec un token valide', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@elmarketa.com',
        role: Role.CLIENT,
      };

      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    });

    it('devrait lancer une erreur si le token est manquant', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Token manquant',
      );
    });

    it('devrait lancer une erreur si le token est invalide', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      const context = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Token invalide ou expiré',
      );
    });

    it('devrait rejeter un token sans le préfixe Bearer', async () => {
      const context = createMockExecutionContext({
        authorization: 'InvalidFormat token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('devrait attacher le payload à request.user', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@elmarketa.com',
        role: Role.ADMIN,
      };

      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const mockRequest = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await guard.canActivate(context);

      expect(mockRequest.user).toEqual(mockPayload);
    });
  });

  describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [RolesGuard, Reflector],
      }).compile();

      guard = module.get<RolesGuard>(RolesGuard);
      reflector = module.get<Reflector>(Reflector);
    });

    const createMockExecutionContext = (
      user: { role: Role } | undefined,
      requiredRoles: Role[] | undefined,
    ): ExecutionContext => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;
    };

    it('devrait autoriser l\'accès si aucun rôle n\'est requis', () => {
      const context = createMockExecutionContext(undefined, undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('devrait autoriser l\'accès si l\'utilisateur a le bon rôle', () => {
      const user = { role: Role.ADMIN };
      const context = createMockExecutionContext(user, [Role.ADMIN]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('devrait refuser l\'accès si l\'utilisateur n\'a pas le bon rôle', () => {
      const user = { role: Role.CLIENT };
      const context = createMockExecutionContext(user, [Role.ADMIN]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Accès refusé : rôle insuffisant',
      );
    });

    it('devrait refuser l\'accès si l\'utilisateur n\'est pas authentifié', () => {
      const context = createMockExecutionContext(undefined, [Role.ADMIN]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Utilisateur non authentifié',
      );
    });

    it('devrait autoriser si l\'utilisateur a un des rôles requis', () => {
      const user = { role: Role.CLIENT };
      const context = createMockExecutionContext(user, [
        Role.ADMIN,
        Role.CLIENT,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
