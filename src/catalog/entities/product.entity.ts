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
@Index(['name'])
export class Product {
  @PrimaryGeneratedColumn({ name: 'product_id' })
  id!: number;

  @Column({ name: 'sku', type: 'varchar', length: 50, unique: true })
  slug!: string; // используем как slug

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

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

  @Column({ name: 'stock_quantity', type: 'int', default: 0 })
  stockQuantity!: number;

  @ManyToOne(() => PhoneModel, (m: PhoneModel) => m.products, {
    nullable: false,
  })
  @JoinColumn({ name: 'phone_model_id' })
  phoneModel!: PhoneModel;

  /* categories (обычные теги, kind='normal') остаются через join table */
  @ManyToMany(() => Category, { cascade: false })
  @JoinTable({
    name: 'product_category',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories!: Category[];

  /* Новые отдельные столбцы под фильтры */
  @Column({ name: 'material', type: 'varchar', length: 20 })
  material!: 'Кожа' | 'Металл' | 'Силикон';

  @Column({ name: 'popularity', type: 'varchar', length: 20 })
  popularity!: 'hit' | 'new' | 'recommended';

  @Column({ name: 'collection', type: 'varchar', length: 20 })
  collection!: 'business' | 'limited' | 'premium' | 'autumn2025';

  @Column({ name: 'view_count', type: 'bigint', default: () => '0' })
  viewCount!: number;

  @Column({ name: 'like_count', type: 'int', default: () => '0' })
  likeCount!: number;

  @Column({
    name: 'avg_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: () => '0.00',
    transformer: numericTransformer,
  })
  avgRating!: number;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
    nullable: true,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
    nullable: true,
  })
  updatedAt!: Date;
}
