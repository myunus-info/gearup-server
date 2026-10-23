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
import { GearCondition } from '../../../common/enums/gear-condition.enum.js';
import { User } from '../../auth/entities/user.entity.js';
import { Category } from '../../categories/entities/category.entity.js';
import { RentalOrderItem } from '../../rentals/entities/rental-order-item.entity.js';
import { Review } from '../../reviews/entities/review.entity.js';
import { numericTransformer } from '../../../common/transformers/numeric.transformer.js';

@Entity('gear_items')
@Index(['categoryId'])
@Index(['providerId'])
export class GearItem {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

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

  @ManyToOne(() => User, user => user.gearItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'providerId' })
  provider: Relation<User>;

  @ManyToOne(() => Category, category => category.gearItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Relation<Category>;

  @OneToMany(() => RentalOrderItem, item => item.gearItem)
  orderItems: Relation<RentalOrderItem[]>;

  @OneToMany(() => Review, review => review.gearItem)
  reviews: Relation<Review[]>;
}
