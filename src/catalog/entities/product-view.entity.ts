// src/shop/entities/product-like.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/users.entity';

@Entity({ name: 'product_view' })
export class ProductView {
  @PrimaryGeneratedColumn({ name: 'view_id' })
  id!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  @Index()
  product!: Product;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer?: User | null;

  /** антинакрутка: посетитель-гость */
  @Column({ name: 'visitor_id', type: 'text', nullable: true })
  visitorId!: string | null;

  @Column({ name: 'ip', type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  /** колонка в миграции называется viewed_at */
  @CreateDateColumn({ name: 'viewed_at', type: 'timestamptz' })
  viewedAt!: Date;
}
