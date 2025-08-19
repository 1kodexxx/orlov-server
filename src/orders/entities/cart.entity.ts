import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { CartItem } from './cart-item.entity';
import { User } from '../../users/users.entity';

@Entity('cart')
export class Cart {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  customer?: User | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId!: number | null;

  @OneToMany(() => CartItem, (ci) => ci.cart)
  items!: CartItem[];
}
