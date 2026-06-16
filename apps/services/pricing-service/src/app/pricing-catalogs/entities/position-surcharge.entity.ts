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
import { CatalogPosition } from './catalog-position.entity';

@Entity({ schema: 'pricing_service', name: 'position_surcharges' })
@Unique(['positionId', 'key'])
export class PositionSurcharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'position_id', type: 'uuid' })
  @Index()
  positionId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  /** Flat surcharge in integer cents. XOR with percentageRate (enforced in DB). */
  @Column({ name: 'flat_amount', type: 'integer', nullable: true })
  flatAmount: number | null;

  /** Decimal fraction, e.g. 0.075 = 7.5%. XOR with flatAmount (enforced in DB). */
  @Column({ name: 'percentage_rate', type: 'numeric', precision: 8, scale: 6, nullable: true })
  percentageRate: string | null;

  /** Declaration order for surcharge application on a line. */
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => CatalogPosition, (p) => p.surcharges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'position_id' })
  position: CatalogPosition;
}
