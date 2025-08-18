import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Order } from './order.entity';

@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn({ name: 'customer_id', type: 'integer' })
  id!: number;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'email', type: 'varchar', length: 200 })
  email!: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @OneToMany(() => Order, (o) => o.customer)
  orders!: Order[];
}
