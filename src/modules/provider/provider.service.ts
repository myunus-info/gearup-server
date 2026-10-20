import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GearItem } from '../../entities/gear-item.entity.js';
import { Category } from '../../entities/category.entity.js';
import { RentalOrder } from '../../entities/rental-order.entity.js';
import { RentalStatus } from '../../common/enums/rental-status.enum.js';
import { CreateGearDto } from './dto/create-gear.dto.js';
import { UpdateGearDto } from './dto/update-gear.dto.js';

@Injectable()
export class ProviderService {
  constructor(
    @InjectRepository(GearItem)
    private readonly gearRepository: Repository<GearItem>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
    private readonly dataSource: DataSource,
  ) {}

  async addGear(dto: CreateGearDto, providerId: string): Promise<GearItem> {
    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }

    const gear = this.gearRepository.create({
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description,
      brand: dto.brand,
      pricePerDay: dto.pricePerDay,
      depositAmount: dto.depositAmount,
      quantityTotal: dto.quantityTotal,
      condition: dto.condition,
      providerId,
      quantityAvailable: dto.quantityTotal,
      images: dto.images || [],
    });

    return this.gearRepository.save(gear);
  }

  async getMyGears(providerId: string): Promise<GearItem[]> {
    const gears = await this.gearRepository.find({
      where: { providerId },
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });

    if (!gears || gears.length === 0) {
      throw new NotFoundException('No gear items found!');
    }

    return gears;
  }

  async getGearById(gearId: string, providerId: string): Promise<GearItem> {
    const gear = await this.gearRepository.findOne({
      where: { id: gearId },
      relations: { category: true },
    });

    if (!gear) {
      throw new NotFoundException('No gear item found!');
    }

    if (gear.providerId !== providerId) {
      throw new ForbiddenException('You do not own this gear item!');
    }

    return gear;
  }

  async updateGear(
    gearId: string,
    dto: UpdateGearDto,
    providerId: string,
  ): Promise<GearItem> {
    const gear = await this.getGearById(gearId, providerId);

    if (dto.categoryId && dto.categoryId !== gear.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Invalid categoryId');
      }
    }

    Object.assign(gear, dto);
    return this.gearRepository.save(gear);
  }

  async deleteGear(gearId: string, providerId: string): Promise<{ id: string }> {
    const gear = await this.getGearById(gearId, providerId);
    await this.gearRepository.remove(gear);
    return { id: gearId };
  }

  async getProviderOrders(providerId: string): Promise<RentalOrder[]> {
    const orders = await this.rentalOrderRepository
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.items', 'item')
      .innerJoinAndSelect('item.gearItem', 'gear')
      .innerJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.payments', 'payment')
      .where('gear.providerId = :providerId', { providerId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();

    return orders;
  }

  async updateOrderStatus(
    orderId: string,
    status: RentalStatus,
    providerId: string,
  ): Promise<RentalOrder> {
    const order = await this.rentalOrderRepository.findOne({
      where: { id: orderId },
      relations: { items: { gearItem: true } },
    });

    if (!order) {
      throw new NotFoundException('Rental order not found!');
    }

    const ownsGear = order.items.some(
      (item) => item.gearItem.providerId === providerId,
    );

    if (!ownsGear) {
      throw new ForbiddenException('You do not have gear in this order!');
    }

    const validTransitions: Record<RentalStatus, RentalStatus[]> = {
      [RentalStatus.PLACED]: [RentalStatus.CONFIRMED, RentalStatus.CANCELLED],
      [RentalStatus.CONFIRMED]: [RentalStatus.PICKED_UP, RentalStatus.CANCELLED],
      [RentalStatus.PICKED_UP]: [RentalStatus.RETURNED],
      [RentalStatus.RETURNED]: [],
      [RentalStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${status}`,
      );
    }

    // Process update with rollback in a transaction
    return this.dataSource.transaction(async (manager) => {
      order.status = status;
      if (status === RentalStatus.PICKED_UP) {
        order.pickupConfirmedAt = new Date();
      }
      if (status === RentalStatus.RETURNED) {
        order.returnConfirmedAt = new Date();
      }
      if (status === RentalStatus.CANCELLED) {
        order.cancelledAt = new Date();
      }

      const updatedOrder = await manager.save(RentalOrder, order);

      // Restore gear stock if order was returned or cancelled
      if (status === RentalStatus.RETURNED || status === RentalStatus.CANCELLED) {
        for (const item of order.items) {
          await manager.increment(
            GearItem,
            { id: item.gearItemId },
            'quantityAvailable',
            item.quantity,
          );
        }
      }

      return updatedOrder;
    });
  }
}
