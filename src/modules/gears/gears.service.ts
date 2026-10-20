import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GearItem } from './entities/gear-item.entity.js';
import { QueryGearDto } from './dto/query-gear.dto.js';

@Injectable()
export class GearsService {
  constructor(
    @InjectRepository(GearItem)
    private readonly gearRepository: Repository<GearItem>,
  ) {}

  async findAll(query: QueryGearDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.gearRepository
      .createQueryBuilder('gear')
      .leftJoinAndSelect('gear.category', 'category')
      .leftJoin('gear.provider', 'provider')
      .addSelect(['provider.id', 'provider.name'])
      .leftJoinAndSelect('gear.reviews', 'review')
      .where('gear.isActive = :isActive', { isActive: true });

    if (query.search?.trim()) {
      const searchTerm = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(gear.name) LIKE :searchTerm OR LOWER(gear.description) LIKE :searchTerm OR LOWER(gear.brand) LIKE :searchTerm OR LOWER(category.name) LIKE :searchTerm)',
        { searchTerm },
      );
    }

    if (query.category?.trim()) {
      qb.andWhere('LOWER(category.name) = :catName', {
        catName: query.category.trim().toLowerCase(),
      });
    }

    if (query.brand?.trim()) {
      qb.andWhere('LOWER(gear.brand) = :brandName', {
        brandName: query.brand.trim().toLowerCase(),
      });
    }

    if (query.condition) {
      qb.andWhere('gear.condition = :condition', {
        condition: query.condition,
      });
    }

    if (query.price !== undefined) {
      qb.andWhere('gear.pricePerDay <= :maxPrice', {
        maxPrice: query.price,
      });
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder?.toUpperCase() || 'DESC') as 'ASC' | 'DESC';

    qb.orderBy(`gear.${sortField}`, sortOrder).addOrderBy('gear.id', 'ASC');

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const formattedItems = items.map((gear) => {
      const reviews = gear.reviews || [];
      const totalReviews = reviews.length;
      const avgRating =
        totalReviews > 0
          ? Math.round(
              (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10,
            ) / 10
          : 0;
      Object.assign(gear, {
        avgRating,
        averageRating: avgRating,
        totalReviews,
      });
      return gear;
    });

    return {
      data: formattedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const gear = await this.gearRepository
      .createQueryBuilder('gear')
      .leftJoinAndSelect('gear.category', 'category')
      .leftJoin('gear.provider', 'provider')
      .addSelect(['provider.id', 'provider.name', 'provider.email'])
      .leftJoinAndSelect('gear.reviews', 'review')
      .leftJoin('review.customer', 'customer')
      .addSelect(['customer.id', 'customer.name', 'customer.avatarUrl'])
      .where('gear.id = :id', { id })
      .getOne();

    if (!gear) {
      throw new NotFoundException(`The gear item with id ${id} not found!`);
    }

    const reviews = gear.reviews || [];
    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10,
          ) / 10
        : 0;

    Object.assign(gear, {
      avgRating,
      averageRating: avgRating,
      totalReviews,
    });

    return gear;
  }
}
