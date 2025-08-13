import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  Check,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/users.entity';

@Entity({ name: 'product_like' })
@Unique('ux_product_like_user', ['productId', 'customerId'])
@Unique('ux_product_like_visitor', ['productId', 'visitorId'])
@Check(
  'product_like_exactly_one_owner',
  `
  (customer_id IS NOT NULL AND visitor_id IS NULL) OR
  (customer_id IS NULL AND visitor_id IS NOT NULL)
`,
)
export class ProductLike {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @Column({ name: 'product_id', type: 'int' })
  @Index()
  productId!: number;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId!: number | null;

  @Column({ name: 'visitor_id', type: 'uuid', nullable: true })
  visitorId!: string | null;

  @Column({ name: 'liked_at', type: 'timestamptz', default: () => 'now()' })
  likedAt!: Date;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer!: User | null;
}
