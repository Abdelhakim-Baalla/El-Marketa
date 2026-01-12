import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get(':productId')
  getStock(@Param('productId') productId: string) {
    return this.inventoryService.getStock(productId);
  }

  @Post('update')
  updateStock(@Body() updateStockDto: UpdateStockDto) {
    return this.inventoryService.updateStock(updateStockDto);
  }

  @Post('reserve')
  reserveStock(@Body() reserveStockDto: ReserveStockDto) {
    return this.inventoryService.reserveStock(reserveStockDto);
  }

  @Post('release')
  releaseStock(
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.inventoryService.releaseStock(productId, quantity);
  }

  @Get('low-stock/alert')
  getLowStock(@Query('threshold') threshold?: number) {
    return this.inventoryService.getLowStock(threshold);
  }
}
