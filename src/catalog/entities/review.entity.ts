// src/shop/entities/review.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/users.entity';

@Entity({ name: 'review' })
@Index(['product', 'customer'], { unique: true })
export class Review {
  @PrimaryGeneratedColumn({ name: 'review_id' })
  id!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ name: 'rating', type: 'int' })
  rating!: number; // 1..5

  /** в твоей миграции колонка называется comment */
  @Column({ name: 'comment', type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'review_date', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
