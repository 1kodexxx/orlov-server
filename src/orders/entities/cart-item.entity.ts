import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from './product.entity';

@Entity('cart_item')
export class CartItem {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @ManyToOne(() => Cart, (c) => c.items, { onDelete: 'CASCADE' })
  cart!: Cart;

  @Column({ name: 'cart_id', type: 'bigint' })
  cartId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  product!: Product;

  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @Column({ name: 'qty', type: 'int' })
  qty!: number;
}
