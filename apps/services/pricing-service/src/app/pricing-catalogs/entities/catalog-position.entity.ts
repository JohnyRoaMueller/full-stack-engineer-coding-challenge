import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PositionSurcharge } from './position-surcharge.entity';
import { PricingCatalogVersion } from './pricing-catalog-version.entity';

export enum PositionUnit {
  PIECE = 'piece',
  M2 = 'm2',
  METER = 'meter',
  HOUR = 'hour',
  FLAT = 'flat',
}

@Entity({ schema: 'pricing_service', name: 'catalog_positions' })
@Unique(['versionId', 'key'])
export class CatalogPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id', type: 'uuid' })
  @Index()
  versionId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 16 })
  unit: PositionUnit;

  /** Net unit price in integer cents. */
  @Column({ name: 'net_price', type: 'integer' })
  netPrice: number;

  @Column({ name: 'vat_rate', type: 'numeric', precision: 8, scale: 6 })
  vatRate: string;

  @Column({ name: 'min_quantity', type: 'integer', nullable: true })
  minQuantity: number | null;

  @Column({ name: 'max_quantity', type: 'integer', nullable: true })
  maxQuantity: number | null;

  /** Trade-specific attributes validated against TradeConfig.metadata.pricingSchema. */
  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => PricingCatalogVersion, (v) => v.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: PricingCatalogVersion;

  @OneToMany(() => PositionSurcharge, (s) => s.position)
  surcharges: PositionSurcharge[];
}
