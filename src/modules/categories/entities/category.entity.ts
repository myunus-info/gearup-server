import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { GearItem } from '../../gears/entities/gear-item.entity.js';

@Entity('categories')
export class Category {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => GearItem, (gear) => gear.category)
  gearItems: Relation<GearItem[]>;
}
