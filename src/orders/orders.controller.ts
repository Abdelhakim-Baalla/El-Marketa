import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    const userId = 'temp-user-id';
    return this.ordersService.create(userId, createOrderDto);
  }

  @Get()
  findAll() {
    const userId = 'temp-user-id';
    const isAdmin = false;
    return this.ordersService.findAll(userId, isAdmin);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const userId = 'temp-user-id';
    const isAdmin = false;
    return this.ordersService.findOne(id, userId, isAdmin);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    const userId = 'temp-user-id';
    const isAdmin = false;
    return this.ordersService.cancel(id, userId, isAdmin);
  }
}
