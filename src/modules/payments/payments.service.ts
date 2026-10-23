import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { SslcommerzService, PaymentUserData } from './sslcommerz.service.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
    private readonly sslcommerzService: SslcommerzService,
    private readonly dataSource: DataSource,
  ) {}

  async initiatePayment(user: PaymentUserData, order: { id: string; totalAmount: number }): Promise<string> {
    return this.sslcommerzService.initPayment(user, order);
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    const { orderId, tranId, payload } = dto;

    const valId = payload?.val_id || `VAL-${Date.now()}`;
    const verificationResponse = await this.sslcommerzService.verifyPayment(valId);

    const result = await this.dataSource.transaction(async manager => {
      const payment = await manager.findOne(Payment, {
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
          verification: verificationResponse,
        };
      }

      payment.transactionId = tranId;
      payment.status = PaymentStatus.PAID;
      payment.method = verificationResponse.card_type || 'CREDIT_CARD';
      payment.gatewayResponse = verificationResponse;
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
        verification: verificationResponse,
      };
    });

    return result;
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
