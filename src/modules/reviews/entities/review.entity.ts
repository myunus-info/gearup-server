import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { GearItem } from '../../gears/entities/gear-item.entity.js';
import { RentalOrder } from '../../rentals/entities/rental-order.entity.js';

@Entity('reviews')
@Unique(['customerId', 'gearItemId', 'rentalOrderId'])
@Index(['gearItemId'])
export class Review {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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

  @ManyToOne(() => User, user => user.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Relation<User>;

  @ManyToOne(() => GearItem, gear => gear.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'gearItemId' })
  gearItem: Relation<GearItem>;

  @ManyToOne(() => RentalOrder, order => order.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentalOrderId' })
  rentalOrder: Relation<RentalOrder>;
}
