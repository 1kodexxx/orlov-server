import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn({ name: 'product_id', type: 'integer' })
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  // DECIMAL хранить как string (точность не теряем)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: string;
}
