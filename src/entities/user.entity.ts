import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums/role.enum.js';
import { UserStatus } from '../common/enums/user-status.enum.js';
import { ProviderProfile } from './provider-profile.entity.js';
import { GearItem } from './gear-item.entity.js';
import { RentalOrder } from './rental-order.entity.js';
import { Review } from './review.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
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
  providerProfile?: ProviderProfile;

  @OneToMany(() => GearItem, (gear) => gear.provider)
  gearItems: GearItem[];

  @OneToMany(() => RentalOrder, (order) => order.customer)
  rentalOrders: RentalOrder[];

  @OneToMany(() => Review, (review) => review.customer)
  reviews: Review[];
}
