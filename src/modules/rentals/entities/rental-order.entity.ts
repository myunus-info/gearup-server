import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { RentalStatus } from '../../../common/enums/rental-status.enum.js';
import { User } from '../../auth/entities/user.entity.js';
import { RentalOrderItem } from './rental-order-item.entity.js';
import { Payment } from '../../payments/entities/payment.entity.js';
import { Review } from '../../reviews/entities/review.entity.js';
import { numericTransformer } from '../../../common/transformers/numeric.transformer.js';

@Entity('rental_orders')
@Index(['customerId'])
export class RentalOrder {
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

  @Column({
    type: 'varchar',
    default: RentalStatus.PLACED,
  })
  status: RentalStatus;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({ nullable: true })
  pickupConfirmedAt?: Date;

  @Column({ nullable: true })
  returnConfirmedAt?: Date;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, user => user.rentalOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Relation<User>;

  @OneToMany(() => RentalOrderItem, item => item.rentalOrder, {
    cascade: true,
  })
  items: Relation<RentalOrderItem[]>;

  @OneToMany(() => Payment, payment => payment.rentalOrder)
  payments: Relation<Payment[]>;

  @OneToMany(() => Review, review => review.rentalOrder)
  reviews: Relation<Review[]>;
}
