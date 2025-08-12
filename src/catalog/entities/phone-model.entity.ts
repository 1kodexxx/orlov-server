// src/shop/entities/phone-model.entity.ts
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'phone_model' })
@Index(['brand', 'modelName'])
export class PhoneModel {
  @PrimaryGeneratedColumn({ name: 'model_id' })
  id!: number;

  @Column({ name: 'brand', type: 'varchar', length: 100 })
  brand!: string;

  @Column({ name: 'model_name', type: 'varchar', length: 100 })
  modelName!: string;

  @Column({ name: 'release_year', type: 'int', nullable: true })
  releaseYear!: number | null;

  @OneToMany(() => Product, (p) => p.phoneModel)
  products!: Product[];
}
