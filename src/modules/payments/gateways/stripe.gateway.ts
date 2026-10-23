import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';
import type { ConfirmPaymentDto } from '../dto/confirm-payment.dto.js';
import type {
  IPaymentGateway,
  PaymentCustomerData,
  PaymentOrderData,
  PaymentVerificationResult,
} from '../interfaces/payment-gateway.interface.js';

@Injectable()
export class StripeGateway implements IPaymentGateway {
  readonly provider = PaymentProvider.STRIPE;
  private readonly logger = new Logger(StripeGateway.name);
  private stripe: Stripe | null = null;
  private readonly webhookSecret: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || null;

    if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia' as any,
      });
      this.logger.log('Stripe SDK initialized with active API secret key.');
    } else {
      this.logger.warn('Stripe secret key is not set or invalid.');
    }
  }

  private getStripeClient(): Stripe {
    if (this.stripe) {
      return this.stripe;
    }
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
      return this.stripe;
    }
    throw new BadRequestException(
      'Stripe is not configured on the server. Please add STRIPE_SECRET_KEY to your environment variables.',
    );
  }

  async initiatePayment(customer: PaymentCustomerData, order: PaymentOrderData): Promise<string> {
    const stripe = this.getStripeClient();
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const successUrl = `${appUrl}/payment/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}&gateway=STRIPE`;
    const cancelUrl = `${appUrl}/payment/cancel?orderId=${order.id}&gateway=STRIPE`;

    const totalCents = Math.max(50, Math.round(Number(order.totalAmount) * 100));
    const itemsDescription =
      order.items && order.items.length > 0
        ? order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
        : 'Outdoor Equipment Rental';

    const isValidEmail =
      customer.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: isValidEmail ? customer.email?.trim() : undefined,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `GearUp Rental #${order.id.slice(-8)}`,
                description: itemsDescription,
              },
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        client_reference_id: order.id,
        metadata: {
          orderId: order.id,
          customerId: customer.id || '',
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      if (!session.url) {
        throw new BadRequestException('Stripe failed to return a checkout session URL.');
      }

      this.logger.log(`Created Stripe Checkout session: ${session.id} for order ${order.id}`);
      return session.url;
    } catch (error: any) {
      this.logger.error(`Stripe checkout creation failed: ${error?.message}`);
      throw new BadRequestException(
        `Stripe Error: ${error?.message || 'Failed to initialize payment gateway'}`,
      );
    }
  }

  async verifyPayment(dto: ConfirmPaymentDto): Promise<PaymentVerificationResult> {
    const sessionId =
      dto.sessionId ||
      dto.tranId ||
      (dto.payload?.session_id as string) ||
      (dto.payload?.sessionId as string);

    if (!sessionId) {
      throw new BadRequestException('Stripe checkout session_id is required for verification.');
    }

    try {
      const stripe = this.getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const isPaid = session.payment_status === 'paid' || session.status === 'complete';

      return {
        isPaid,
        transactionId: (session.payment_intent as string) || session.id,
        method: 'STRIPE_CARD',
        amount: (session.amount_total || 0) / 100,
        currency: session.currency?.toUpperCase() || 'USD',
        rawResponse: session as unknown as Record<string, unknown>,
      };
    } catch (error: any) {
      this.logger.warn(`Stripe session retrieval note: ${error?.message}`);
      return { isPaid: false };
    }
  }

  processWebhook(payload: any, signature?: string): { orderId?: string; sessionId?: string; tranId?: string; rawEvent: any } {
    let event: any = payload;

    if (signature) {
      if (!this.stripe || !this.webhookSecret) {
        throw new BadRequestException('Stripe Webhook Secret is not configured on the server.');
      }
      try {
        event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      } catch (err: any) {
        this.logger.error(`Stripe Webhook Signature Verification failed: ${err.message}`);
        throw new BadRequestException(`Webhook signature verification error: ${err.message}`);
      }
    }

    if (event.type === 'checkout.session.completed' || event.status === 'complete') {
      const session = event.data?.object || event;
      const orderId = session.client_reference_id || session.metadata?.orderId;
      return {
        orderId,
        sessionId: session.id,
        tranId: (session.payment_intent as string) || session.id,
        rawEvent: session,
      };
    }

    return { rawEvent: event };
  }
}
