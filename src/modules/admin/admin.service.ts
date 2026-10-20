import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { GearItem } from '../gears/entities/gear-item.entity.js';
import { RentalOrder } from '../rentals/entities/rental-order.entity.js';
import { UserStatus } from '../../common/enums/user-status.enum.js';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(GearItem)
    private readonly gearRepository: Repository<GearItem>,
    @InjectRepository(RentalOrder)
    private readonly rentalOrderRepository: Repository<RentalOrder>,
  ) {}

  async getAllUsers() {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      relations: { providerProfile: true },
    });

    if (!users || users.length === 0) {
      throw new NotFoundException('Users not found!');
    }

    return users.map((user) => {
      const { password: _pw, ...safeUser } = user;
      void _pw;
      return safeUser;
    });
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    user.status = status;
    const updated = await this.userRepository.save(user);

    const { password: _pw, ...safeUser } = updated;
    void _pw;
    return safeUser;
  }

  async getAllGearListings() {
    const gearListings = await this.gearRepository.find({
      relations: { category: true, provider: true },
      order: { createdAt: 'DESC' },
    });

    if (!gearListings || gearListings.length === 0) {
      throw new NotFoundException('No gear listing found!');
    }

    return gearListings;
  }

  async getAllRentalOrders() {
    const rentals = await this.rentalOrderRepository.find({
      relations: {
        customer: true,
        items: { gearItem: true },
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!rentals || rentals.length === 0) {
      throw new NotFoundException('No rental order found!');
    }

    return rentals;
  }
}
