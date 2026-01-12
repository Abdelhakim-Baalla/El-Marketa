import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;
  let inventoryService: InventoryService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockInventoryService = {
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('devrait créer une commande avec succès', async () => {
      const userId = 'user-123';
      const createOrderDto = {
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 },
        ],
      };

      mockPrismaService.product.findUnique
        .mockResolvedValueOnce({
          id: 'product-1',
          name: 'Tajine',
          price: 299.99,
          isActive: true,
        })
        .mockResolvedValueOnce({
          id: 'product-2',
          name: 'Théière',
          price: 150.0,
          isActive: true,
        });

      mockInventoryService.reserveStock.mockResolvedValue({});

      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-123',
        userId,
        status: OrderStatus.PENDING,
        totalPrice: 749.98, // (299.99 * 2) + (150.00 * 1)
        items: [],
      });

      const result = await service.create(userId, createOrderDto);

      expect(result.order.totalPrice).toBe(749.98);
      expect(mockInventoryService.reserveStock).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.order.create).toHaveBeenCalled();
    });

    it('devrait calculer correctement le prix total', async () => {
      const userId = 'user-123';
      const createOrderDto = {
        items: [{ productId: 'product-1', quantity: 3 }],
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-1',
        price: 100.0,
        isActive: true,
      });

      mockInventoryService.reserveStock.mockResolvedValue({});

      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-123',
        totalPrice: 300.0, // 100 * 3
        items: [],
      });

      const result = await service.create(userId, createOrderDto);

      expect(result.order.totalPrice).toBe(300.0);
    });

    it('devrait lancer une erreur si un produit n\'existe pas', async () => {
      const createOrderDto = {
        items: [{ productId: 'fake-product', quantity: 1 }],
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.create('user-123', createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockInventoryService.reserveStock).not.toHaveBeenCalled();
    });

    it('devrait lancer une erreur si un produit est inactif', async () => {
      const createOrderDto = {
        items: [{ productId: 'product-1', quantity: 1 }],
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-1',
        name: 'Produit désactivé',
        isActive: false,
      });

      await expect(service.create('user-123', createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devrait réserver le stock pour chaque produit', async () => {
      const createOrderDto = {
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 3 },
        ],
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-1',
        price: 100,
        isActive: true,
      });

      mockInventoryService.reserveStock.mockResolvedValue({});
      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-123',
        items: [],
      });

      await service.create('user-123', createOrderDto);

      expect(mockInventoryService.reserveStock).toHaveBeenCalledWith({
        productId: 'product-1',
        quantity: 2,
      });
      expect(mockInventoryService.reserveStock).toHaveBeenCalledWith({
        productId: 'product-2',
        quantity: 3,
      });
    });
  });

  describe('findAll', () => {
    it('CLIENT devrait voir seulement ses commandes', async () => {
      const userId = 'user-123';
      const isAdmin = false;

      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'order-1', userId },
        { id: 'order-2', userId },
      ]);

      await service.findAll(userId, isAdmin);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        }),
      );
    });

    it('ADMIN devrait voir toutes les commandes', async () => {
      const isAdmin = true;

      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'order-1', userId: 'user-1' },
        { id: 'order-2', userId: 'user-2' },
      ]);

      await service.findAll(undefined, isAdmin);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('devrait retourner une commande avec ses détails', async () => {
      const orderId = 'order-123';
      const userId = 'user-123';

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
        items: [],
      });

      const result = await service.findOne(orderId, userId, false);

      expect(result.id).toBe(orderId);
    });

    it('CLIENT ne peut pas voir la commande d\'un autre', async () => {
      const orderId = 'order-123';

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'other-user',
      });

      await expect(
        service.findOne(orderId, 'user-123', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN peut voir n\'importe quelle commande', async () => {
      const orderId = 'order-123';

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'other-user',
      });

      const result = await service.findOne(orderId, 'admin-123', true);

      expect(result.id).toBe(orderId);
    });
  });

  describe('cancel', () => {
    it('devrait annuler une commande et libérer le stock', async () => {
      const orderId = 'order-123';
      const userId = 'user-123';

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PENDING,
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 },
        ],
      });

      mockInventoryService.releaseStock.mockResolvedValue({});

      mockPrismaService.order.update.mockResolvedValue({
        id: orderId,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancel(orderId, userId, false);

      expect(result.order.status).toBe(OrderStatus.CANCELLED);
      expect(mockInventoryService.releaseStock).toHaveBeenCalledTimes(2);
      expect(mockInventoryService.releaseStock).toHaveBeenCalledWith(
        'product-1',
        2,
      );
      expect(mockInventoryService.releaseStock).toHaveBeenCalledWith(
        'product-2',
        1,
      );
    });

    it('ne peut pas annuler une commande déjà annulée', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: OrderStatus.CANCELLED,
        items: [],
      });

      await expect(
        service.cancel('order-123', 'user-123', false),
      ).rejects.toThrow(BadRequestException);
      expect(mockInventoryService.releaseStock).not.toHaveBeenCalled();
    });

    it('ne peut pas annuler une commande déjà payée', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: OrderStatus.PAID,
        items: [],
      });

      await expect(
        service.cancel('order-123', 'user-123', false),
      ).rejects.toThrow(BadRequestException);
      expect(mockInventoryService.releaseStock).not.toHaveBeenCalled();
    });
  });
});
