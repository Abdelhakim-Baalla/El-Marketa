import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Cette commande ne peut pas être payée');
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      order.items.map((item) => ({
        price_data: {
          currency: 'mad',
          product_data: {
            name: item.product.name,
            description: item.product.description || undefined,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

    const successUrl =
      this.configService.get<string>('STRIPE_SUCCESS_URL') ||
      'http://localhost:3000/payment/success';
    const cancelUrl =
      this.configService.get<string>('STRIPE_CANCEL_URL') ||
      'http://localhost:3000/payment/cancel';

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
      customer_email: order.user.email,
      metadata: {
        orderId: orderId,
        userId: userId,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        stripeSessionId: session.id,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(
        `Webhook signature verification failed: ${errorMessage}`,
      );
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      console.error('No orderId in session metadata');
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
    });

    console.log(`✅ Order ${orderId} marked as PAID`);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    console.error(`❌ Payment failed for intent: ${paymentIntent.id}`);
  }
}
