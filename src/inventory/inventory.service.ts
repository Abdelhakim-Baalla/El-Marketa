import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStockDto, StockOperation } from './dto/update-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // Récupérer le stock d'un produit
  async getStock(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire non trouvé pour ce produit');
    }

    return {
      ...inventory,
      totalStock: inventory.available + inventory.reserved,
    };
  }

  // Mettre à jour le stock (ADMIN)
  async updateStock(updateStockDto: UpdateStockDto) {
    const { productId, quantity, operation } = updateStockDto;

    // Vérifier que le produit existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    // Récupérer l'inventaire
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire non trouvé');
    }

    // Calculer le nouveau stock
    let newAvailable = inventory.available;

    if (operation === StockOperation.ADD) {
      newAvailable += quantity;
    } else if (operation === StockOperation.REMOVE) {
      newAvailable -= quantity;

      // Vérifier qu'on ne passe pas en négatif
      if (newAvailable < 0) {
        throw new BadRequestException(
          `Stock insuffisant. Disponible: ${inventory.available}, Demandé: ${quantity}`,
        );
      }
    }

    // Mettre à jour l'inventaire
    const updatedInventory = await this.prisma.inventory.update({
      where: { productId },
      data: { available: newAvailable },
    });

    return {
      message: `Stock ${operation === StockOperation.ADD ? 'ajouté' : 'retiré'} avec succès`,
      inventory: updatedInventory,
    };
  }

  // Réserver du stock (lors de la création d'une commande)
  async reserveStock(reserveStockDto: ReserveStockDto) {
    const { productId, quantity } = reserveStockDto;

    // Récupérer l'inventaire
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire non trouvé');
    }

    // Vérifier la disponibilité
    if (inventory.available < quantity) {
      throw new BadRequestException(
        `Stock insuffisant. Disponible: ${inventory.available}, Demandé: ${quantity}`,
      );
    }

    // Réserver le stock (transaction atomique)
    const updatedInventory = await this.prisma.inventory.update({
      where: { productId },
      data: {
        available: inventory.available - quantity,
        reserved: inventory.reserved + quantity,
      },
    });

    return {
      message: 'Stock réservé avec succès',
      inventory: updatedInventory,
    };
  }

  // Libérer du stock réservé (annulation de commande)
  async releaseStock(productId: string, quantity: number) {
    // Récupérer l'inventaire
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundException('Inventaire non trouvé');
    }

    // Vérifier qu'on a assez de stock réservé
    if (inventory.reserved < quantity) {
      throw new BadRequestException(
        `Stock réservé insuffisant. Réservé: ${inventory.reserved}, Demandé: ${quantity}`,
      );
    }

    // Libérer le stock
    const updatedInventory = await this.prisma.inventory.update({
      where: { productId },
      data: {
        available: inventory.available + quantity,
        reserved: inventory.reserved - quantity,
      },
    });

    return {
      message: 'Stock libéré avec succès',
      inventory: updatedInventory,
    };
  }

  // Récupérer les produits en rupture de stock
  async getLowStock(threshold: number = 5) {
    const lowStockProducts = await this.prisma.inventory.findMany({
      where: {
        available: {
          lte: threshold,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
          },
        },
      },
      orderBy: {
        available: 'asc',
      },
    });

    return {
      threshold,
      count: lowStockProducts.length,
      products: lowStockProducts,
    };
  }
}
