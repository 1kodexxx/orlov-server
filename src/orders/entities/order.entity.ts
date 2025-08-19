import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { User } from '../../users/users.entity';

export type OrderStatus = 'in_transit' | 'completed' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ name: 'order_id', type: 'integer' })
  id!: number;

  /**
   * Заказчик — зарегистрированный пользователь.
   * Внешний ключ в БД называется customer_id → явно привязываем JoinColumn.
   * Это важно, чтобы TypeORM НЕ генерировал "customerId" как отдельный столбец.
   */
  @ManyToOne(() => User, { onDelete: 'NO ACTION', eager: true })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  /**
   * Доступ к ID без загрузки relation.
   * НЕ создаёт отдельного столбца, а читает значение из customer_id.
   */
  @RelationId((order: Order) => order.customer)
  readonly customerId!: number;

  @Column({ name: 'order_date', type: 'timestamptz' })
  orderDate!: Date;

  @Column({ name: 'status', type: 'varchar', length: 50 })
  status!: OrderStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: string;

  @OneToMany(() => OrderItem, (i) => i.order, { eager: true })
  items!: OrderItem[];
}
