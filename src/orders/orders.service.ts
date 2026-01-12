import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // Créer une commande
  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items } = createOrderDto;

    // Vérifier que tous les produits existent et calculer le prix
    let totalPrice = 0;
    const orderItems: Array<{
      productId: string;
      quantity: number;
      price: number;
    }> = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Produit ${item.productId} non trouvé`);
      }

      if (!product.isActive) {
        throw new BadRequestException(
          `Le produit ${product.name} n'est plus disponible`,
        );
      }

      // Calculer le prix de cet item
      const itemPrice = product.price * item.quantity;
      totalPrice += itemPrice;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Réserver le stock pour chaque produit
    for (const item of orderItems) {
      await this.inventoryService.reserveStock({
        productId: item.productId,
        quantity: item.quantity,
      });
    }

    // Créer la commande dans la base de données
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        totalPrice,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Commande créée avec succès',
      order,
    };
  }

  // Récupérer toutes les commandes (avec filtrage par utilisateur)
  async findAll(userId?: string, isAdmin: boolean = false) {
    const where: { userId?: string } = {};

    // Si ce n'est pas un admin, on filtre par userId
    if (!isAdmin && userId) {
      where.userId = userId;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders;
  }

  // Récupérer une commande par son ID
  async findOne(orderId: string, userId?: string, isAdmin: boolean = false) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // Vérifier que l'utilisateur a le droit de voir cette commande
    if (!isAdmin && order.userId !== userId) {
      throw new BadRequestException("Vous n'avez pas accès à cette commande");
    }

    return order;
  }

  // Annuler une commande
  async cancel(orderId: string, userId?: string, isAdmin: boolean = false) {
    const order = await this.findOne(orderId, userId, isAdmin);

    // Vérifier que la commande peut être annulée
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cette commande est déjà annulée');
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException(
        "Impossible d'annuler une commande déjà payée",
      );
    }

    // Libérer le stock réservé
    for (const item of order.items) {
      await this.inventoryService.releaseStock(item.productId, item.quantity);
    }

    // Mettre à jour le statut de la commande
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    return {
      message: 'Commande annulée avec succès',
      order: updatedOrder,
    };
  }
}
