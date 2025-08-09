import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'admin' | 'manager' | 'customer';

@Entity({ name: 'customer' })
export class User {
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  id!: number;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'registered_at', type: 'timestamptz' })
  registeredAt!: Date;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'customer' })
  role!: UserRole;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'avatar_updated_at', type: 'timestamptz', nullable: true })
  avatarUpdatedAt!: Date | null;
}
