import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Product } from './product.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'product_like' })
export class ProductLike {
  @PrimaryColumn({ name: 'product_id', type: 'int' })
  productId!: number;

  @PrimaryColumn({ name: 'customer_id', type: 'int' })
  customerId!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;
}
