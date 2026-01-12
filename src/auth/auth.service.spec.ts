import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('devrait créer un nouvel utilisateur avec succès', async () => {
      const registerDto = {
        email: 'test@elmarketa.com',
        password: '123456',
        role: Role.CLIENT,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        role: registerDto.role,
        createdAt: new Date(),
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.access_token).toBe('fake-jwt-token');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('devrait lancer une erreur si l\'email existe déjà', async () => {
      const registerDto = {
        email: 'existing@elmarketa.com',
        password: '123456',
        role: Role.CLIENT,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('devrait hasher le mot de passe', async () => {
      const registerDto = {
        email: 'test@elmarketa.com',
        password: '123456',
        role: Role.CLIENT,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation((args) => {
        expect(args.data.password).not.toBe(registerDto.password);
        expect(args.data.password.length).toBeGreaterThan(20);
        return Promise.resolve({
          id: 'user-123',
          email: registerDto.email,
          role: registerDto.role,
          createdAt: new Date(),
        });
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      await service.register(registerDto);

      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('devrait connecter un utilisateur avec des credentials valides', async () => {
      const loginDto = {
        email: 'test@elmarketa.com',
        password: '123456',
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        password: hashedPassword,
        role: Role.CLIENT,
      });
      mockJwtService.sign.mockReturnValue('fake-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe(loginDto.email);
      expect(result.access_token).toBe('fake-jwt-token');
    });

    it('devrait lancer une erreur si l\'email n\'existe pas', async () => {
      const loginDto = {
        email: 'nonexistent@elmarketa.com',
        password: '123456',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('devrait lancer une erreur si le mot de passe est incorrect', async () => {
      const loginDto = {
        email: 'test@elmarketa.com',
        password: 'wrongpassword',
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        password: hashedPassword,
        role: Role.CLIENT,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateUser', () => {
    it('devrait retourner l\'utilisateur si trouvé', async () => {
      const userId = 'user-123';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@elmarketa.com',
        role: Role.CLIENT,
      });

      const result = await service.validateUser(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
    });

    it('devrait lancer une erreur si l\'utilisateur n\'existe pas', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('fake-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
