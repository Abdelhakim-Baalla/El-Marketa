import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    inventory: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('devrait créer un produit avec succès', async () => {
      const createProductDto = {
        name: 'Tajine',
        description: 'Traditionnel',
        price: 299.99,
        category: 'Artisanat',
        sku: 'TAJ-001',
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({
        id: 'product-123',
        ...createProductDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.inventory.create.mockResolvedValue({
        id: 'inv-123',
        productId: 'product-123',
        available: 0,
        reserved: 0,
      });

      const result = await service.create(createProductDto);

      expect(result).toHaveProperty('id', 'product-123');
      expect(result.name).toBe(createProductDto.name);
      expect(mockPrismaService.inventory.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-123',
          available: 0,
          reserved: 0,
        },
      });
    });

    it('devrait lancer une erreur si le SKU existe déjà', async () => {
      const createProductDto = {
        name: 'Tajine',
        price: 299.99,
        category: 'Artisanat',
        sku: 'TAJ-001',
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'existing-product',
        sku: 'TAJ-001',
      });

      await expect(service.create(createProductDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.product.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('devrait retourner une liste paginée de produits', async () => {
      const filterDto = {
        page: 1,
        limit: 10,
      };

      const mockProducts = [
        { id: '1', name: 'Tajine', price: 299.99, isActive: true },
        { id: '2', name: 'Théière', price: 150.0, isActive: true },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(2);

      const result = await service.findAll(filterDto);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('devrait filtrer par catégorie', async () => {
      const filterDto = {
        category: 'Artisanat',
        page: 1,
        limit: 10,
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await service.findAll(filterDto);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Artisanat',
          }),
        }),
      );
    });

    it('devrait filtrer par prix min et max', async () => {
      const filterDto = {
        minPrice: 100,
        maxPrice: 500,
        page: 1,
        limit: 10,
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await service.findAll(filterDto);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: {
              gte: 100,
              lte: 500,
            },
          }),
        }),
      );
    });

    it('devrait calculer correctement la pagination', async () => {
      const filterDto = {
        page: 2,
        limit: 5,
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(12);

      const result = await service.findAll(filterDto);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * limit = (2 - 1) * 5 = 5
          take: 5,
        }),
      );
      expect(result.meta.totalPages).toBe(3); // Math.ceil(12 / 5) = 3
    });
  });

  describe('findOne', () => {
    it('devrait retourner un produit avec son inventaire', async () => {
      const productId = 'product-123';

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: productId,
        name: 'Tajine',
        price: 299.99,
        inventory: {
          available: 10,
          reserved: 2,
        },
      });

      const result = await service.findOne(productId);

      expect(result).toHaveProperty('id', productId);
      expect(result).toHaveProperty('inventory');
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
        include: { inventory: true },
      });
    });

    it('devrait lancer une erreur si le produit n\'existe pas', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('fake-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('devrait mettre à jour un produit', async () => {
      const productId = 'product-123';
      const updateDto = {
        name: 'Tajine Modifié',
        price: 350.0,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: productId,
        name: 'Tajine',
      });
      mockPrismaService.product.update.mockResolvedValue({
        id: productId,
        ...updateDto,
      });

      const result = await service.update(productId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.price).toBe(updateDto.price);
    });

    it('devrait lancer une erreur si le produit n\'existe pas', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update('fake-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('devrait désactiver un produit (soft delete)', async () => {
      const productId = 'product-123';

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: productId,
        name: 'Tajine',
      });
      mockPrismaService.product.update.mockResolvedValue({
        id: productId,
        isActive: false,
      });

      const result = await service.remove(productId);

      expect(result).toHaveProperty('message');
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { isActive: false },
      });
    });
  });
});
