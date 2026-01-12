import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

describe('PaymentService', () => {
  let service: PaymentService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_fake_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_fake_secret',
        STRIPE_SUCCESS_URL: 'http://localhost:3000/success',
        STRIPE_CANCEL_URL: 'http://localhost:3000/cancel',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it("devrait lancer une erreur si la commande n'existe pas", async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('fake-order-id', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it("devrait lancer une erreur si la commande n'appartient pas à l'utilisateur", async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'other-user',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.createCheckoutSession('order-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it("devrait lancer une erreur si la commande n'est pas PENDING", async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: OrderStatus.PAID,
      });

      await expect(
        service.createCheckoutSession('order-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
