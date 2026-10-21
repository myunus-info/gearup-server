import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum.js';
import { UserStatus } from '../../../common/enums/user-status.enum.js';
import { ProviderProfile } from './provider-profile.entity.js';
import { GearItem } from '../../gears/entities/gear-item.entity.js';
import { RentalOrder } from '../../rentals/entities/rental-order.entity.js';
import { Review } from '../../reviews/entities/review.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string = randomUUID();

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({
    type: 'varchar',
    default: Role.CUSTOMER,
  })
  role: Role;

  @Column({ nullable: true, unique: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({
    type: 'varchar',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true })
  avatarUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => ProviderProfile, (profile) => profile.user, {
    cascade: true,
  })
  providerProfile?: Relation<ProviderProfile>;

  @OneToMany(() => GearItem, (gear) => gear.provider)
  gearItems: Relation<GearItem[]>;

  @OneToMany(() => RentalOrder, (order) => order.customer)
  rentalOrders: Relation<RentalOrder[]>;

  @OneToMany(() => Review, (review) => review.customer)
  reviews: Relation<Review[]>;
}
