import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/users.entity'; // проверь путь к сущности пользователя

@Entity({ name: 'company_reviews' })
export class CompanyReview {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'customer_id' })
  customer!: User;

  @Column({ name: 'customer_id', type: 'int' })
  customerId!: number;

  @Column({ type: 'smallint' })
  rating!: number; // 1–5

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
