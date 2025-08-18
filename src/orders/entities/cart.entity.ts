import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Customer } from './customer.entity';
import { CartItem } from './cart-item.entity';

@Entity('cart')
export class Cart {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'CASCADE' })
  customer?: Customer | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId!: number | null;

  @OneToMany(() => CartItem, (ci) => ci.cart)
  items!: CartItem[];
}
