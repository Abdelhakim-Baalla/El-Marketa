import {
  Controller,
  Post,
  Body,
  UseGuards,
  Headers,
  Req,
  BadRequestException
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post('create-checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ) {
    return this.paymentService.createCheckoutSession(
      createCheckoutDto.orderId,
      user.sub,
    );
  }

  @Post('webhook')
  handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw body is required for webhook validation');
    }
    return this.paymentService.handleWebhook(signature, request.rawBody);
  }
}
