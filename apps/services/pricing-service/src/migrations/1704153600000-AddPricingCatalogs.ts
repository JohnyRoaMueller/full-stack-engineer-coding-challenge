import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Pricing catalog schema: versioned catalogs with positions, surcharges, and discounts.
 *
 * Exclusion constraint and btree_gist use raw SQL — not expressible via createTable alone.
 */
export class AddPricingCatalogs1704153600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.pricing_catalog_versions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'craftsman_id', type: 'uuid' },
          { name: 'trade', type: 'varchar', length: '32' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'effective_from', type: 'timestamptz', isNullable: true },
          { name: 'effective_until', type: 'timestamptz', isNullable: true },
          { name: 'published_by_user_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.pricing_catalog_versions',
      new TableIndex({
        name: 'idx_pricing_catalog_versions_craftsman_id',
        columnNames: ['craftsman_id'],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.pricing_catalog_versions',
      new TableIndex({
        name: 'idx_pricing_catalog_versions_trade',
        columnNames: ['trade'],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.pricing_catalog_versions',
      new TableIndex({
        name: 'idx_pricing_catalog_versions_craftsman_trade',
        columnNames: ['craftsman_id', 'trade'],
      }),
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX uniq_one_draft_per_craftsman_trade
      ON pricing_service.pricing_catalog_versions (craftsman_id, trade)
      WHERE status = 'DRAFT'
    `);

    await queryRunner.createForeignKey(
      'pricing_service.pricing_catalog_versions',
      new TableForeignKey({
        columnNames: ['craftsman_id'],
        referencedTableName: 'pricing_service.craftsmen',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      ALTER TABLE pricing_service.pricing_catalog_versions
      ADD CONSTRAINT excl_pricing_catalog_active_interval
      EXCLUDE USING gist (
        craftsman_id WITH =,
        trade WITH =,
        tstzrange(effective_from, effective_until, '[)') WITH &&
      )
      WHERE (status = 'PUBLISHED' AND effective_from IS NOT NULL)
    `);

    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.catalog_positions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'version_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '64' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'unit', type: 'varchar', length: '16' },
          { name: 'net_price', type: 'integer' },
          { name: 'vat_rate', type: 'numeric', precision: 8, scale: 6 },
          { name: 'min_quantity', type: 'integer', isNullable: true },
          { name: 'max_quantity', type: 'integer', isNullable: true },
          { name: 'attributes', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          {
            name: 'uniq_catalog_positions_version_key',
            columnNames: ['version_id', 'key'],
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.catalog_positions',
      new TableIndex({
        name: 'idx_catalog_positions_version_id',
        columnNames: ['version_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'pricing_service.catalog_positions',
      new TableForeignKey({
        columnNames: ['version_id'],
        referencedTableName: 'pricing_service.pricing_catalog_versions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.position_surcharges',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'position_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '64' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'flat_amount', type: 'integer', isNullable: true },
          { name: 'percentage_rate', type: 'numeric', precision: 8, scale: 6, isNullable: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          {
            name: 'uniq_position_surcharges_position_key',
            columnNames: ['position_id', 'key'],
          },
        ],
        checks: [
          new TableCheck({
            name: 'chk_position_surcharge_flat_xor_percentage',
            expression: `(flat_amount IS NOT NULL AND percentage_rate IS NULL) OR (flat_amount IS NULL AND percentage_rate IS NOT NULL)`,
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.position_surcharges',
      new TableIndex({
        name: 'idx_position_surcharges_position_id',
        columnNames: ['position_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'pricing_service.position_surcharges',
      new TableForeignKey({
        columnNames: ['position_id'],
        referencedTableName: 'pricing_service.catalog_positions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.catalog_discounts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'version_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '64' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'flat_amount', type: 'integer', isNullable: true },
          { name: 'percentage_rate', type: 'numeric', precision: 8, scale: 6, isNullable: true },
          { name: 'cap', type: 'integer', isNullable: true },
          { name: 'applies_to', type: 'jsonb' },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          {
            name: 'uniq_catalog_discounts_version_key',
            columnNames: ['version_id', 'key'],
          },
        ],
        checks: [
          new TableCheck({
            name: 'chk_catalog_discount_flat_xor_percentage',
            expression: `(flat_amount IS NOT NULL AND percentage_rate IS NULL) OR (flat_amount IS NULL AND percentage_rate IS NOT NULL)`,
          }),
          new TableCheck({
            name: 'chk_catalog_discount_cap_requires_percentage',
            expression: `cap IS NULL OR percentage_rate IS NOT NULL`,
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'pricing_service.catalog_discounts',
      new TableIndex({
        name: 'idx_catalog_discounts_version_id',
        columnNames: ['version_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'pricing_service.catalog_discounts',
      new TableForeignKey({
        columnNames: ['version_id'],
        referencedTableName: 'pricing_service.pricing_catalog_versions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pricing_service.catalog_discounts', true);
    await queryRunner.dropTable('pricing_service.position_surcharges', true);
    await queryRunner.dropTable('pricing_service.catalog_positions', true);

    await queryRunner.query(`
      ALTER TABLE pricing_service.pricing_catalog_versions
      DROP CONSTRAINT IF EXISTS excl_pricing_catalog_active_interval
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS pricing_service.uniq_one_draft_per_craftsman_trade
    `);

    await queryRunner.dropTable('pricing_service.pricing_catalog_versions', true);
  }
}
