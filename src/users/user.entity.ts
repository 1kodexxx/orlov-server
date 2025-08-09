import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Role } from '../auth/types';

@Entity({ name: 'customer' })
export class User {
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  id!: number;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'registered_at', type: 'timestamp' })
  registeredAt!: Date;

  @Column({ name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({ name: 'role', default: 'customer' })
  role!: Role;
}
