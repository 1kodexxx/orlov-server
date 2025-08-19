import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Order } from './order.entity';

/**
 * ВАЖНО: эта сущность должна отражать реальные колонки таблицы `customer`.
 * Раньше не было avatar_url (и часть полей профиля), поэтому TypeORM их не выбирал,
 * и в телеграм улетали инициалы. Теперь добавили недостающие поля.
 */
@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn({ name: 'customer_id', type: 'integer' })
  id!: number;

  // базовые
  @Column({ name: 'email', type: 'varchar', length: 200 })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  // то, чего не хватало в orders-модуле
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'avatar_updated_at', type: 'timestamptz', nullable: true })
  avatarUpdatedAt!: Date | null;

  // опционально — телефон/адреса (есть в таблице, пусть будут, вреда нет)
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 120, nullable: true })
  country!: string | null;

  @Column({ name: 'home_address', type: 'text', nullable: true })
  homeAddress!: string | null;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress!: string | null;

  // связь с заказами
  @OneToMany(() => Order, (o) => o.customer)
  orders!: Order[];
}
