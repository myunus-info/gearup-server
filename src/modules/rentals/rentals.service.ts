import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RentalOrder } from './entities/rental-order.entity.js';
import { RentalOrderItem } from './entities/rental-order-item.entity.js';
import { GearItem } from '../gears/entities/gear-item.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateRentalDto } from './dto/create-rental.dto.js';

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
    @InjectRepository(RentalOrderItem)
    private readonly rentalOrderItemRepository: Repository<RentalOrderItem>,
    @InjectRepository(GearItem)
    private readonly gearRepository: Repository<GearItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  async createRentalOrder(dto: CreateRentalDto, customer: User) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    const numDays = daysBetween(startDate, endDate);

    return this.dataSource.transaction(async (manager) => {
      const gearIds = dto.items.map((i) => i.gearItemId);
      const gearItems = await manager.find(GearItem, {
        where: { id: In(gearIds) },
      });

      if (gearItems.length !== gearIds.length) {
        throw new BadRequestException('One or more gear items do not exist!');
      }

      let totalAmount = 0;
      const orderItemsToCreate: Array<Partial<RentalOrderItem>> = [];

      for (const reqItem of dto.items) {
        const gear = gearItems.find((g) => g.id === reqItem.gearItemId);

        if (!gear || !gear.isActive) {
          throw new BadRequestException(
            `Gear item "${gear?.name || reqItem.gearItemId}" is no longer available`,
          );
        }

        if (gear.quantityAvailable < reqItem.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${gear.name}". Available quantity: (${gear.quantityAvailable})`,
          );
        }

        const subtotal = Number(gear.pricePerDay) * reqItem.quantity * numDays;
        totalAmount += subtotal;

        orderItemsToCreate.push({
          gearItemId: gear.id,
          quantity: reqItem.quantity,
          pricePerDaySnapshot: Number(gear.pricePerDay),
          subtotal,
        });

        // Decrement available stock
        await manager.decrement(
          GearItem,
          { id: gear.id },
          'quantityAvailable',
          reqItem.quantity,
        );
      }

      // Create order
      const order = manager.create(RentalOrder, {
        customerId: customer.id,
        startDate,
        endDate,
        totalAmount,
        status: RentalStatus.PLACED,
      });

      const savedOrder = await manager.save(RentalOrder, order);

      // Create order items
      const items = orderItemsToCreate.map((item) =>
        manager.create(RentalOrderItem, {
          ...item,
          rentalOrderId: savedOrder.id,
        }),
      );
      await manager.save(RentalOrderItem, items);

      // Initiate payment
      const paymentUrl = await this.paymentsService.initiatePayment(
        {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        },
        {
          id: savedOrder.id,
          totalAmount: savedOrder.totalAmount,
        },
      );

      // Record pending payment
      const payment = manager.create(Payment, {
        rentalOrderId: savedOrder.id,
        amount: savedOrder.totalAmount,
        status: PaymentStatus.PENDING,
      });
      await manager.save(Payment, payment);

      const completeOrder = await manager.findOne(RentalOrder, {
        where: { id: savedOrder.id },
        relations: { items: { gearItem: true } },
      });

      return {
        order: completeOrder,
        paymentUrl,
      };
    });
  }

  async getMyRentalOrders(customerId: string): Promise<RentalOrder[]> {
    const orders = await this.rentalOrderRepository.find({
      where: { customerId },
      relations: {
        items: { gearItem: true },
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!orders || orders.length === 0) {
      throw new NotFoundException('No orders found!');
    }

    return orders;
  }

  async getRentalOrderById(
    rentalOrderId: string,
    customerId?: string,
  ): Promise<RentalOrder> {
    const order = await this.rentalOrderRepository.findOne({
      where: { id: rentalOrderId },
      relations: {
        items: { gearItem: true },
        payments: true,
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Rental order not found!');
    }

    if (customerId && order.customerId !== customerId) {
      throw new ForbiddenException('You do not own this rental order!');
    }

    return order;
  }
}
