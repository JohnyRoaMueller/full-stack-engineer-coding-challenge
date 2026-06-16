import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogDiscount } from './catalog-discount.entity';
import { CatalogPosition } from './catalog-position.entity';

export enum CatalogVersionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

/**
 * A versioned pricing catalog for one (craftsman, trade) pair.
 * DRAFT versions are mutable; PUBLISHED versions are immutable.
 */
@Entity({ schema: 'pricing_service', name: 'pricing_catalog_versions' })
@Index(['craftsmanId', 'trade'])
export class PricingCatalogVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'craftsman_id', type: 'uuid' })
  @Index()
  craftsmanId: string;

  @Column({ type: 'varchar', length: 32 })
  @Index()
  trade: string;

  @Column({ type: 'varchar', length: 16 })
  status: CatalogVersionStatus;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_until', type: 'timestamptz', nullable: true })
  effectiveUntil: Date | null;

  /** User id from the JWT claim at publish time. */
  @Column({ name: 'published_by_user_id', type: 'uuid', nullable: true })
  publishedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CatalogPosition, (p) => p.version)
  positions: CatalogPosition[];

  @OneToMany(() => CatalogDiscount, (d) => d.version)
  discounts: CatalogDiscount[];
}
