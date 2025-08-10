import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'phone_model' })
export class PhoneModel {
  @PrimaryGeneratedColumn({ name: 'phone_model_id' })
  id!: number;

  @Column({ name: 'brand', type: 'varchar', length: 100 })
  @Index()
  brand!: string;

  @Column({ name: 'model', type: 'varchar', length: 100 })
  @Index()
  model!: string;

  @Column({ name: 'slug', type: 'varchar', length: 150, unique: true })
  slug!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @OneToMany(() => Product, (p) => p.phoneModel)
  products!: Product[];
}
