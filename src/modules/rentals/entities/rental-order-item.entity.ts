import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { RentalOrder } from './rental-order.entity.js';
import { GearItem } from '../../gears/entities/gear-item.entity.js';
import { numericTransformer } from '../../../common/transformers/numeric.transformer.js';

@Entity('rental_order_items')
@Index(['rentalOrderId'])
@Index(['gearItemId'])
export class RentalOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rentalOrderId: string;

  @Column()
  gearItemId: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  pricePerDaySnapshot: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  subtotal: number;

  @ManyToOne(() => RentalOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rentalOrderId' })
  rentalOrder: Relation<RentalOrder>;

  @ManyToOne(() => GearItem, (gear) => gear.orderItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'gearItemId' })
  gearItem: Relation<GearItem>;
}
