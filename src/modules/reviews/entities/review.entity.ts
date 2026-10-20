import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { GearItem } from '../../gears/entities/gear-item.entity.js';
import { RentalOrder } from '../../rentals/entities/rental-order.entity.js';

@Entity('reviews')
@Unique(['customerId', 'gearItemId', 'rentalOrderId'])
@Index(['gearItemId'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @Column()
  gearItemId: string;

  @Column()
  rentalOrderId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @ManyToOne(() => GearItem, (gear) => gear.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'gearItemId' })
  gearItem: GearItem;

  @ManyToOne(() => RentalOrder, (order) => order.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentalOrderId' })
  rentalOrder: RentalOrder;
}
