import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';

@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn({ name: 'order_item_id', type: 'integer' })
  id!: number;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  order!: Order;

  @Column({ name: 'order_id', type: 'int' })
  orderId!: number;

  @ManyToOne(() => Product, { eager: true, onDelete: 'NO ACTION' })
  product!: Product;

  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: string;

  // В БД: GENERATED ALWAYS AS (quantity * unit_price) STORED → читаем как есть
  @Column({ name: 'line_total', type: 'decimal', precision: 10, scale: 2 })
  lineTotal!: string;
}
