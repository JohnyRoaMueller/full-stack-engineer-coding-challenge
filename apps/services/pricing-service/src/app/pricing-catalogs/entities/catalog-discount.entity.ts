import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PricingCatalogVersion } from './pricing-catalog-version.entity';

/** `appliesTo: 'subtotal'` or `{ positionKeys: string[] }`. */
export type DiscountAppliesTo =
  | { type: 'subtotal' }
  | { type: 'positions'; keys: string[] };

@Entity({ schema: 'pricing_service', name: 'catalog_discounts' })
@Unique(['versionId', 'key'])
export class CatalogDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id', type: 'uuid' })
  @Index()
  versionId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  /** Flat discount in integer cents. XOR with percentageRate (enforced in DB). */
  @Column({ name: 'flat_amount', type: 'integer', nullable: true })
  flatAmount: number | null;

  /** Decimal fraction, e.g. 0.10 = 10%. XOR with flatAmount (enforced in DB). */
  @Column({ name: 'percentage_rate', type: 'numeric', precision: 8, scale: 6, nullable: true })
  percentageRate: string | null;

  /** Max discount in cents; only valid when percentageRate is set. */
  @Column({ type: 'integer', nullable: true })
  cap: number | null;

  @Column({ name: 'applies_to', type: 'jsonb' })
  appliesTo: DiscountAppliesTo;

  /** Declaration order for discount stacking. */
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => PricingCatalogVersion, (v) => v.discounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: PricingCatalogVersion;
}
