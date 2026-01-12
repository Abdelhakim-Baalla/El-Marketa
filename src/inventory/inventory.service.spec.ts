import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockOperation } from './dto/update-stock.dto';

describe('InventoryService', () => {
  let service: InventoryService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
    },
    inventory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStock', () => {
    it('devrait retourner le stock avec totalStock calculé', async () => {
      const productId = 'product-123';

      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        productId,
        available: 10,
        reserved: 2,
        product: {
          id: productId,
          name: 'Tajine',
          sku: 'TAJ-001',
        },
      });

      const result = await service.getStock(productId);

      expect(result.available).toBe(10);
      expect(result.reserved).toBe(2);
      expect(result.totalStock).toBe(12); // 10 + 2
    });

    it('devrait lancer une erreur si l\'inventaire n\'existe pas', async () => {
      mockPrismaService.inventory.findUnique.mockResolvedValue(null);

      await expect(service.getStock('fake-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStock', () => {
    it('devrait ajouter du stock (ADD)', async () => {
      const updateDto = {
        productId: 'product-123',
        quantity: 50,
        operation: StockOperation.ADD,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: updateDto.productId,
      });
      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        productId: updateDto.productId,
        available: 10,
        reserved: 2,
      });
      mockPrismaService.inventory.update.mockResolvedValue({
        id: 'inv-123',
        available: 60, // 10 + 50
        reserved: 2,
      });

      const result = await service.updateStock(updateDto);

      expect(result.inventory.available).toBe(60);
      expect(mockPrismaService.inventory.update).toHaveBeenCalledWith({
        where: { productId: updateDto.productId },
        data: { available: 60 },
      });
    });

    it('devrait retirer du stock (REMOVE)', async () => {
      const updateDto = {
        productId: 'product-123',
        quantity: 5,
        operation: StockOperation.REMOVE,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: updateDto.productId,
      });
      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        productId: updateDto.productId,
        available: 10,
        reserved: 2,
      });
      mockPrismaService.inventory.update.mockResolvedValue({
        id: 'inv-123',
        available: 5, // 10 - 5
        reserved: 2,
      });

      const result = await service.updateStock(updateDto);

      expect(result.inventory.available).toBe(5);
    });

    it('devrait lancer une erreur si on retire plus que disponible', async () => {
      const updateDto = {
        productId: 'product-123',
        quantity: 20,
        operation: StockOperation.REMOVE,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: updateDto.productId,
      });
      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        available: 10,
        reserved: 2,
      });

      await expect(service.updateStock(updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.inventory.update).not.toHaveBeenCalled();
    });

    it('devrait lancer une erreur si le produit n\'existe pas', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStock({
          productId: 'fake-id',
          quantity: 10,
          operation: StockOperation.ADD,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reserveStock', () => {
    it('devrait réserver du stock avec succès', async () => {
      const reserveDto = {
        productId: 'product-123',
        quantity: 3,
      };

      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        productId: reserveDto.productId,
        available: 10,
        reserved: 2,
      });
      mockPrismaService.inventory.update.mockResolvedValue({
        id: 'inv-123',
        available: 7, // 10 - 3
        reserved: 5, // 2 + 3
      });

      const result = await service.reserveStock(reserveDto);

      expect(result.inventory.available).toBe(7);
      expect(result.inventory.reserved).toBe(5);
      expect(mockPrismaService.inventory.update).toHaveBeenCalledWith({
        where: { productId: reserveDto.productId },
        data: {
          available: 7,
          reserved: 5,
        },
      });
    });

    it('devrait lancer une erreur si stock insuffisant', async () => {
      const reserveDto = {
        productId: 'product-123',
        quantity: 15,
      };

      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        available: 10,
        reserved: 2,
      });

      await expect(service.reserveStock(reserveDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.inventory.update).not.toHaveBeenCalled();
    });
  });

  describe('releaseStock', () => {
    it('devrait libérer du stock réservé', async () => {
      const productId = 'product-123';
      const quantity = 3;

      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        productId,
        available: 7,
        reserved: 5,
      });
      mockPrismaService.inventory.update.mockResolvedValue({
        id: 'inv-123',
        available: 10, // 7 + 3
        reserved: 2, // 5 - 3
      });

      const result = await service.releaseStock(productId, quantity);

      expect(result.inventory.available).toBe(10);
      expect(result.inventory.reserved).toBe(2);
    });

    it('devrait lancer une erreur si stock réservé insuffisant', async () => {
      mockPrismaService.inventory.findUnique.mockResolvedValue({
        id: 'inv-123',
        available: 7,
        reserved: 2,
      });

      await expect(service.releaseStock('product-123', 5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getLowStock', () => {
    it('devrait retourner les produits en rupture de stock', async () => {
      const threshold = 5;

      mockPrismaService.inventory.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          available: 0,
          product: { name: 'Tajine', sku: 'TAJ-001' },
        },
        {
          id: 'inv-2',
          available: 3,
          product: { name: 'Théière', sku: 'THE-001' },
        },
      ]);

      const result = await service.getLowStock(threshold);

      expect(result.threshold).toBe(threshold);
      expect(result.count).toBe(2);
      expect(result.products).toHaveLength(2);
      expect(mockPrismaService.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            available: {
              lte: threshold,
            },
          },
        }),
      );
    });

    it('devrait utiliser le threshold par défaut (5)', async () => {
      mockPrismaService.inventory.findMany.mockResolvedValue([]);

      await service.getLowStock();

      expect(mockPrismaService.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            available: {
              lte: 5,
            },
          },
        }),
      );
    });
  });
});
