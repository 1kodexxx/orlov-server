import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/users.entity';

@Entity({ name: 'review' })
@Index(['product', 'customer'], {
  unique: true,
  where: `"customer_id" IS NOT NULL`,
})
@Index(['product', 'visitorId'], {
  unique: true,
  where: `"visitor_id" IS NOT NULL`,
})
@Check(
  'review_exactly_one_owner',
  `(customer_id IS NOT NULL AND visitor_id IS NULL) OR (customer_id IS NULL AND visitor_id IS NOT NULL)`,
)
export class Review {
  @PrimaryGeneratedColumn({ name: 'review_id' })
  id!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer!: User | null;

  @Column({ name: 'visitor_id', type: 'uuid', nullable: true })
  visitorId!: string | null;

  @Column({ name: 'rating', type: 'int' })
  rating!: number; // 1..5

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'review_date', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
