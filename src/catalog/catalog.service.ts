import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}
  async create(createProductDto: CreateProductDto) {
    const { sku } = createProductDto;

    const existingProduct = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      throw new ConflictException('Ce SKU existe déjà');
    }

    const product = await this.prisma.product.create({
      data: createProductDto,
    });

    await this.prisma.inventory.create({
      data: {
        productId: product.id,
        available: 0,
        reserved: 0,
      },
    });

    return product;
  }

  async findAll(filterDto: FilterProductDto) {
    const { category, minPrice, maxPrice, page = 1, limit = 10 } = filterDto;

    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    const skip = (page - 1) * limit;

    const products = await this.prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.product.count({ where });

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        inventory: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    return product;
  }
  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });

    return updatedProduct;
  }

  async remove(id: string) {
    await this.findOne(id);

    // SOFT DELETE
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Produit désactivé avec succès' };
  }
}
