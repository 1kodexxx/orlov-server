import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'product_image' })
@Unique('uq_product_image_product_url', ['productId', 'url'])
export class ProductImage {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'product_id', type: 'int' })
  @Index()
  productId!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'url', type: 'text' })
  url!: string;

  @Column({ name: 'position', type: 'int', default: 0 })
  position!: number;
}
