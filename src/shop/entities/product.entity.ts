// src/shop/entities/product.entity.ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { PhoneModel } from './phone-model.entity';

const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value !== null && value !== undefined
      ? parseFloat(value as unknown as string)
      : null,
};

@Entity({ name: 'product' })
@Index(['title', 'slug'])
export class Product {
  @PrimaryGeneratedColumn({ name: 'product_id' })
  id!: number;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'RUB' })
  currency!: string;

  // ✅ важная правка — типизируем m: PhoneModel
  @ManyToOne(() => PhoneModel, (m: PhoneModel) => m.products, {
    nullable: true,
  })
  @JoinColumn({ name: 'model_id' })
  phoneModel!: PhoneModel | null;

  @ManyToMany(() => Category, { cascade: false })
  @JoinTable({
    name: 'product_category',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories!: Category[];

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount!: number;

  @Column({ name: 'like_count', type: 'integer', default: 0 })
  likeCount!: number;

  @Column({
    name: 'avg_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  avgRating!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
