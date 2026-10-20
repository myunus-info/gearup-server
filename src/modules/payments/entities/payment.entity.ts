import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum.js';
import { PaymentStatus } from '../../../common/enums/payment-status.enum.js';
import { RentalOrder } from '../../rentals/entities/rental-order.entity.js';
import { numericTransformer } from '../../../common/transformers/numeric.transformer.js';

@Entity('payments')
@Index(['rentalOrderId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rentalOrderId: string;

  @Column({ nullable: true, unique: true })
  transactionId?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({
    type: 'varchar',
    default: PaymentProvider.SSLCOMMERZ,
  })
  provider: PaymentProvider;

  @Column({ nullable: true })
  method?: string;

  @Column({ nullable: true })
  paidAt?: Date;

  @Column({
    type: 'varchar',
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column('simple-json', { nullable: true })
  gatewayResponse?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => RentalOrder, (order) => order.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentalOrderId' })
  rentalOrder: Relation<RentalOrder>;
}
