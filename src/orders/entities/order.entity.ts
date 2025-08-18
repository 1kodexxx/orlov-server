import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Customer } from './customer.entity';
import { OrderItem } from './order-item.entity';

export type OrderStatus = 'in_transit' | 'completed' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ name: 'order_id', type: 'integer' })
  id!: number;

  @ManyToOne(() => Customer, (c) => c.orders, {
    onDelete: 'NO ACTION',
    eager: true,
  })
  customer!: Customer;

  @Column({ name: 'customer_id', type: 'int' })
  customerId!: number;

  @Column({ name: 'order_date', type: 'timestamptz' })
  orderDate!: Date;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status!: OrderStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: string;

  @OneToMany(() => OrderItem, (i) => i.order, { eager: true })
  items!: OrderItem[];
}
