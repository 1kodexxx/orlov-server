import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Role } from '../auth/types';

@Entity({ name: 'customer' })
export class User {
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  id!: number;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string;

  // ⚠️ Явно задаём тип, чтобы union не превращался в Object
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  // В Postgres лучше хранить в timestamptz
  @Column({ name: 'registered_at', type: 'timestamptz' })
  registeredAt!: Date;

  // Argon2-хэш длинный — используем text
  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ name: 'role', type: 'varchar', length: 20, default: 'customer' })
  role!: Role;
}
