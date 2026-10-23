import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';
import type { ConfirmPaymentDto } from '../dto/confirm-payment.dto.js';
import type { IPaymentGateway } from '../interfaces/payment-gateway.interface.js';
import { SslcommerzGateway } from './sslcommerz.gateway.js';
import { StripeGateway } from './stripe.gateway.js';

@Injectable()
export class PaymentGatewayFactory {
  private readonly gateways = new Map<PaymentProvider, IPaymentGateway>();

  constructor(
    private readonly sslcommerzGateway: SslcommerzGateway,
    private readonly stripeGateway: StripeGateway,
  ) {
    this.gateways.set(PaymentProvider.SSLCOMMERZ, this.sslcommerzGateway);
    this.gateways.set(PaymentProvider.STRIPE, this.stripeGateway);
  }

  get(provider: PaymentProvider = PaymentProvider.SSLCOMMERZ): IPaymentGateway {
    const gateway = this.gateways.get(provider);
    if (!gateway) {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
    return gateway;
  }

  /**
   * Determine payment provider from DTO or existing database record
   */
  resolveProvider(dto: ConfirmPaymentDto, existingProvider?: PaymentProvider): PaymentProvider {
    if (dto.provider) {
      return dto.provider;
    }

    if (existingProvider) {
      return existingProvider;
    }

    const sessionId =
      dto.sessionId || dto.tranId || (typeof dto.payload?.session_id === 'string' ? dto.payload.session_id : undefined);

    if (sessionId && sessionId.startsWith('cs_')) {
      return PaymentProvider.STRIPE;
    }

    return PaymentProvider.SSLCOMMERZ;
  }
}
