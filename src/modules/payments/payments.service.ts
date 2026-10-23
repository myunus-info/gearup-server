import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { PaymentProvider } from '../../common/enums/payment-provider.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory.js';
import { StripeGateway } from './gateways/stripe.gateway.js';
import type {
  PaymentCustomerData,
  PaymentOrderData,
} from './interfaces/payment-gateway.interface.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly stripeGateway: StripeGateway,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Initiate payment checkout session using the resolved gateway
   */
  async initiatePayment(
    customer: PaymentCustomerData,
    order: PaymentOrderData,
    provider: PaymentProvider = PaymentProvider.SSLCOMMERZ,
  ): Promise<string> {
    const gateway = this.gatewayFactory.get(provider);
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

  /**
   * Verify and confirm payment transaction, then atomically update order to CONFIRMED
   */
  async confirmPayment(dto: ConfirmPaymentDto) {
    const { orderId } = dto;

    const existingPayment = await this.paymentRepository.findOne({
      where: { rentalOrderId: orderId },
    });

    // Strategy Pattern: Resolve appropriate gateway
    const provider = this.gatewayFactory.resolveProvider(dto, existingPayment?.provider);
    const gateway = this.gatewayFactory.get(provider);

    // Delegate verification to the gateway
    const verification = await gateway.verifyPayment(dto);

    if (!verification.isPaid) {
      throw new BadRequestException(`Payment verification failed with ${provider}.`);
    }

    // Atomically persist verified payment and update rental order status
    return this.dataSource.transaction(async manager => {
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

      const finalTransactionId =
        verification.transactionId ||
        dto.tranId ||
        dto.sessionId ||
        `TXN-${Date.now()}`;

      payment.transactionId = finalTransactionId;
      payment.status = PaymentStatus.PAID;
      payment.provider = provider;
      payment.method = verification.method || (provider === PaymentProvider.STRIPE ? 'STRIPE_CARD' : 'CREDIT_CARD');
      payment.gatewayResponse =
        (verification.rawResponse as Record<string, unknown>) || (verification as any);
      payment.paidAt = dto.payload?.tran_date ? new Date(dto.payload.tran_date) : new Date();

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
  }

  /**
   * Process asynchronous Stripe checkout webhook events
   */
  async handleStripeWebhook(payload: any, signature?: string) {
    const eventData = this.stripeGateway.processWebhook(payload, signature);

    if (eventData.orderId) {
      this.logger.log(`Processing verified Stripe webhook for order ${eventData.orderId}`);
      await this.confirmPayment({
        orderId: eventData.orderId,
        sessionId: eventData.sessionId,
        tranId: eventData.tranId,
        provider: PaymentProvider.STRIPE,
        payload: eventData.rawEvent,
      });
    }

    return { received: true };
  }

  /**
   * Get payments history for a customer
   */
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

  /**
   * Get single payment details
   */
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
