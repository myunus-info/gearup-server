import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { PaymentProvider } from '../../common/enums/payment-provider.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { SslcommerzService } from './sslcommerz.service.js';
import { StripeService } from './stripe.service.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import type {
  IPaymentGateway,
  PaymentCustomerData,
  PaymentOrderData,
  PaymentVerificationResult,
} from './interfaces/payment-gateway.interface.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
    private readonly sslcommerzService: SslcommerzService,
    private readonly stripeService: StripeService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Strategy Pattern resolver for payment providers
   */
  private getGateway(provider: PaymentProvider = PaymentProvider.SSLCOMMERZ): IPaymentGateway {
    if (provider === PaymentProvider.STRIPE) {
      return this.stripeService;
    }
    return this.sslcommerzService;
  }

  async initiatePayment(
    customer: PaymentCustomerData,
    order: PaymentOrderData,
    provider: PaymentProvider = PaymentProvider.SSLCOMMERZ,
  ): Promise<string> {
    const gateway = this.getGateway(provider);
    this.logger.log(`Initiating checkout with provider: ${provider} for order ${order.id}`);
    return gateway.initiatePayment(customer, order);
  }

  /**
   * Initiate payment for an existing unpaid rental order
   */
  async initiateOrderPayment(
    orderId: string,
    customerId: string,
    provider: PaymentProvider = PaymentProvider.SSLCOMMERZ,
  ): Promise<{ paymentUrl: string; provider: PaymentProvider }> {
    const order = await this.rentalOrderRepository.findOne({
      where: { id: orderId },
      relations: { customer: true, items: { gearItem: true } },
    });

    if (!order) {
      throw new NotFoundException(`Rental order #${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have access to pay for this rental order');
    }

    if (order.status === RentalStatus.CONFIRMED || order.status === RentalStatus.PICKED_UP) {
      throw new BadRequestException('This rental order is already confirmed and paid');
    }

    // Ensure payment record exists and records selected provider
    let payment = await this.paymentRepository.findOne({
      where: { rentalOrderId: order.id },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        rentalOrderId: order.id,
        amount: order.totalAmount,
        provider,
        status: PaymentStatus.PENDING,
      });
    } else {
      payment.provider = provider;
    }
    await this.paymentRepository.save(payment);

    const paymentUrl = await this.initiatePayment(
      {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        address: order.customer.address,
      },
      {
        id: order.id,
        totalAmount: order.totalAmount,
        items: order.items?.map(i => ({
          name: i.gearItem?.name || 'Equipment Rental',
          quantity: i.quantity,
          unitPrice: Number(i.pricePerDaySnapshot),
        })),
      },
      provider,
    );

    return { paymentUrl, provider };
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    const { orderId, tranId, sessionId, payload } = dto;

    // Detect payment record to determine provider
    const existingPayment = await this.paymentRepository.findOne({
      where: { rentalOrderId: orderId },
    });

    const isStripe =
      dto.provider === PaymentProvider.STRIPE ||
      existingPayment?.provider === PaymentProvider.STRIPE ||
      sessionId?.startsWith('cs_') ||
      tranId?.startsWith('cs_') ||
      (typeof payload?.session_id === 'string' && payload.session_id.startsWith('cs_'));

    const provider = isStripe ? PaymentProvider.STRIPE : PaymentProvider.SSLCOMMERZ;
    let verification: PaymentVerificationResult;

    if (isStripe) {
      const targetSessionId = sessionId || tranId || (payload?.session_id as string) || (payload?.sessionId as string);
      if (!targetSessionId) {
        throw new BadRequestException('Stripe checkout session_id is required for verification.');
      }
      verification = await this.stripeService.verifyPayment(targetSessionId);
    } else {
      const valId = (payload?.val_id as string) || tranId || `VAL-${Date.now()}`;
      verification = await this.sslcommerzService.verifyPayment(valId);
    }

    if (!verification.isPaid) {
      throw new BadRequestException(`Payment verification failed with ${provider}.`);
    }

    const result = await this.dataSource.transaction(async manager => {
      let payment = await manager.findOne(Payment, {
        where: { rentalOrderId: orderId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment record for order ${orderId} not found!`);
      }

      // Idempotency: Return immediately if already confirmed
      if (payment.status === PaymentStatus.PAID) {
        const existingOrder = await manager.findOne(RentalOrder, {
          where: { id: orderId },
        });
        return {
          payment,
          order: existingOrder,
          verification,
        };
      }

      const finalTransactionId = verification.transactionId || tranId || sessionId || `TXN-${Date.now()}`;
      payment.transactionId = finalTransactionId;
      payment.status = PaymentStatus.PAID;
      payment.provider = provider;
      payment.method = verification.method || (isStripe ? 'STRIPE_CARD' : 'CREDIT_CARD');
      payment.gatewayResponse = (verification.rawResponse as Record<string, unknown>) || (verification as any);
      payment.paidAt = payload?.tran_date ? new Date(payload.tran_date) : new Date();

      await manager.save(Payment, payment);

      const order = await manager.findOne(RentalOrder, {
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Rental order ${orderId} not found!`);
      }

      order.status = RentalStatus.CONFIRMED;
      await manager.save(RentalOrder, order);

      return {
        payment,
        order,
        verification,
      };
    });

    return result;
  }

  async handleStripeWebhook(payload: any, signature?: string) {
    let event: any = payload;

    if (signature) {
      try {
        event = this.stripeService.constructWebhookEvent(payload, signature);
      } catch (err: any) {
        this.logger.error(`Stripe Webhook Signature Verification failed: ${err.message}`);
        throw new BadRequestException(`Webhook signature verification error: ${err.message}`);
      }
    }

    if (event.type === 'checkout.session.completed' || event.status === 'complete') {
      const session = event.data?.object || event;
      const orderId = session.client_reference_id || session.metadata?.orderId;

      if (orderId) {
        this.logger.log(`Processing verified webhook for order ${orderId}`);
        await this.confirmPayment({
          orderId,
          sessionId: session.id,
          tranId: (session.payment_intent as string) || session.id,
          provider: PaymentProvider.STRIPE,
          payload: session,
        });
      }
    }

    return { received: true };
  }

  async getMyPayments(customerId: string): Promise<Payment[]> {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.rentalOrder', 'order')
      .where('order.customerId = :customerId', { customerId })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    if (!payments || payments.length === 0) {
      throw new NotFoundException('No payment found!');
    }

    return payments;
  }

  async getPaymentById(paymentId: string, customerId?: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { rentalOrder: true },
    });

    if (!payment) {
      throw new NotFoundException('No payment found!');
    }

    if (customerId && payment.rentalOrder.customerId !== customerId) {
      throw new ForbiddenException('You do not own this payment record!');
    }

    return payment;
  }
}
