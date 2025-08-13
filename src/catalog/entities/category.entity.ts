import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

export type CategoryKind = 'normal' | 'material' | 'collection' | 'popularity';

@Entity({ name: 'category' })
export class Category {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  @Index()
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 150, unique: true })
  slug!: string;

  @Column({ name: 'kind', type: 'text', default: 'normal' })
  kind!: CategoryKind;

  @ManyToOne(() => Category, (c) => c.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null;

  @OneToMany(() => Category, (c) => c.parent)
  children!: Category[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  // Навигационное поле, если используешь ManyToMany через join table
  @OneToMany(() => Product, (p) => p.categories)
  _productsNav?: Product[];
}
