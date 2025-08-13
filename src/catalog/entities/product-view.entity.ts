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

  @Column({ name: 'visitor_id', type: 'uuid', nullable: true })
  visitorId!: string | null;

  @Column({ name: 'ip', type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'viewed_at', type: 'timestamptz' })
  viewedAt!: Date;

  // служебная дата (триггером в миграции)
  @Column({ name: 'viewed_date', type: 'date' })
  viewedDate!: string;
}
