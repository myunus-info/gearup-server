import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GearCondition } from '../common/enums/gear-condition.enum.js';
import { User } from './user.entity.js';
import { Category } from './category.entity.js';
import { RentalOrderItem } from './rental-order-item.entity.js';
import { Review } from './review.entity.js';
import { numericTransformer } from './transformers.js';

@Entity('gear_items')
@Index(['categoryId'])
@Index(['providerId'])
export class GearItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerId: string;

  @Column()
  categoryId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  brand?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  pricePerDay: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  depositAmount?: number;

  @Column({ type: 'int' })
  quantityTotal: number;

  @Column({ type: 'int' })
  quantityAvailable: number;

  @Column({
    type: 'varchar',
    nullable: true,
    default: GearCondition.GOOD,
  })
  condition?: GearCondition;

  @Column('simple-array', { nullable: true })
  images: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.gearItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'providerId' })
  provider: User;

  @ManyToOne(() => Category, (category) => category.gearItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => RentalOrderItem, (item) => item.gearItem)
  orderItems: RentalOrderItem[];

  @OneToMany(() => Review, (review) => review.gearItem)
  reviews: Review[];
}
