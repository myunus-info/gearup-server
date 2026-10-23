import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider } from '../../common/enums/payment-provider.enum.js';
import type {
  IPaymentGateway,
  PaymentCustomerData,
  PaymentOrderData,
  PaymentVerificationResult,
} from './interfaces/payment-gateway.interface.js';

@Injectable()
export class StripeService implements IPaymentGateway {
  readonly provider = PaymentProvider.STRIPE;
  private readonly logger = new Logger(StripeService.name);
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

  async initiatePayment(customer: PaymentCustomerData, order: PaymentOrderData): Promise<string> {
    if (!this.stripe) {
      // Re-check config in case it was loaded dynamically
      const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
        this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
      } else {
        throw new BadRequestException(
          'Stripe is not configured on the server. Please add STRIPE_SECRET_KEY to your environment variables.',
        );
      }
    }

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
      const session = await this.stripe.checkout.sessions.create({
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

  async verifyPayment(verificationId: string): Promise<PaymentVerificationResult> {
    if (!verificationId) {
      return { isPaid: false };
    }

    if (!this.stripe) {
      const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (secretKey) {
        this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
      }
    }

    if (this.stripe) {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(verificationId);
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
      }
    }

    return { isPaid: false };
  }

  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    if (!this.stripe || !this.webhookSecret) {
      throw new Error('Stripe Webhook Secret is not configured on the server.');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
