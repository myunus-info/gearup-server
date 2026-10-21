import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('provider_profiles')
export class ProviderProfile {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Column()
  userId: string;

  @Column()
  shopName: string;

  @Column({ nullable: true })
  businessAddress?: string;

  @Column({ default: false })
  isVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.providerProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;
}
