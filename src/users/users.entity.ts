import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'admin' | 'manager' | 'customer';

@Entity({ name: 'customer' })
export class User {
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  id!: number;

  // === базовые поля
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'customer' })
  role!: UserRole;

  @Column({
    name: 'registered_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  registeredAt!: Date;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  // === профиль (всё — nullable, т.к. пользователь может не заполнять)
  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'headline', type: 'varchar', length: 200, nullable: true })
  headline!: string | null;

  @Column({
    name: 'organization',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  organization!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 120, nullable: true })
  country!: string | null;

  @Column({ name: 'home_address', type: 'text', nullable: true })
  homeAddress!: string | null;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress!: string | null;
}
