import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload, UserRole } from '@sandbox/types';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { TradeConfig } from '../trades/entities/trade-config.entity';
import { CatalogPosition, PositionUnit } from './entities/catalog-position.entity';
import {
  CatalogVersionStatus,
  PricingCatalogVersion,
} from './entities/pricing-catalog-version.entity';
import { PricingCatalogsService } from './pricing-catalogs.service';

const adminUser: JwtPayload = {
  sub: 'admin-id',
  email: 'admin@example.com',
  roles: [UserRole.ADMIN],
  craftsmanId: null,
};

const partnerUser: JwtPayload = {
  sub: 'partner-user-id',
  email: 'partner@example.com',
  roles: [UserRole.CRAFTSMAN],
  craftsmanId: '11111111-1111-1111-1111-111111111111',
};

const otherCraftsmanUser: JwtPayload = {
  ...partnerUser,
  craftsmanId: '99999999-9999-9999-9999-999999999999',
};

const VERSION_ID = '22222222-2222-2222-2222-222222222222';
const CRAFTSMAN_ID = '11111111-1111-1111-1111-111111111111';

function buildVersion(overrides: Partial<PricingCatalogVersion> = {}): PricingCatalogVersion {
  const position = {
    id: '33333333-3333-3333-3333-333333333333',
    versionId: VERSION_ID,
    key: 'boiler-install',
    label: 'Boiler installation',
    unit: PositionUnit.PIECE,
    netPrice: 10000,
    vatRate: '0.190000',
    minQuantity: null,
    maxQuantity: null,
    attributes: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    surcharges: [],
  };

  return {
    id: VERSION_ID,
    craftsmanId: CRAFTSMAN_ID,
    trade: 'HVAC',
    status: CatalogVersionStatus.DRAFT,
    effectiveFrom: null,
    effectiveUntil: null,
    publishedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    positions: [position as unknown as CatalogPosition],
    discounts: [],
    ...overrides,
  } as PricingCatalogVersion;
}

describe('PricingCatalogsService', () => {
  let service: PricingCatalogsService;
  let versions: jest.Mocked<Pick<Repository<PricingCatalogVersion>, 'find' | 'findOne' | 'save' | 'create'>>;
  let craftsmen: jest.Mocked<Pick<Repository<Craftsman>, 'findOne'>>;
  let trades: jest.Mocked<Pick<Repository<TradeConfig>, 'findOne'>>;
  let dataSourceMock: { transaction: jest.Mock };

  beforeEach(async () => {
    versions = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((x: PricingCatalogVersion) => x),
    };
    craftsmen = {
      findOne: jest.fn().mockResolvedValue({
        id: CRAFTSMAN_ID,
        isActive: true,
      } as Craftsman),
    };
    trades = {
      findOne: jest.fn().mockResolvedValue({
        trade: 'HVAC',
        metadata: { pricingSchema: { fields: [] } },
      } as unknown as TradeConfig),
    };
    dataSourceMock = {
      transaction: jest.fn(async (cb: (tx: DataSource) => Promise<unknown>) =>
        cb({
          getRepository: jest.fn().mockReturnValue({
            delete: jest.fn(),
            save: jest
              .fn()
              .mockImplementation((x: unknown) => Promise.resolve({ ...(x as object), id: 'pos-id' })),
            create: jest.fn().mockImplementation((x: unknown) => x),
          }),
        } as unknown as DataSource),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PricingCatalogsService,
        { provide: getRepositoryToken(PricingCatalogVersion), useValue: versions },
        { provide: getRepositoryToken(Craftsman), useValue: craftsmen },
        { provide: getRepositoryToken(TradeConfig), useValue: trades },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(PricingCatalogsService);
  });

  it('creates a draft catalog for an authorized craftsman', async () => {
    versions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildVersion());
    versions.save.mockResolvedValue(buildVersion({ id: VERSION_ID }));

    const result = await service.create(
      { craftsmanId: CRAFTSMAN_ID, trade: 'HVAC' },
      partnerUser,
    );

    expect(result.id).toBe(VERSION_ID);
    expect(result.status).toBe(CatalogVersionStatus.DRAFT);
    expect(versions.save).toHaveBeenCalled();
  });

  it('rejects catalog access for another craftsman', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(service.findOne(VERSION_ID, otherCraftsmanUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('quotes a catalog version for admin', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    const result = await service.quote(
      VERSION_ID,
      { lines: [{ positionKey: 'boiler-install', quantity: 2 }] },
      adminUser,
    );

    expect(result.totals.net).toBe(20000);
    expect(result.totals.vat).toBe(3800);
    expect(result.totals.gross).toBe(23800);
  });

  it('rejects quote when craftsman is inactive', async () => {
    versions.findOne.mockResolvedValue(buildVersion());
    craftsmen.findOne.mockResolvedValue({ id: CRAFTSMAN_ID, isActive: false } as Craftsman);

    await expect(
      service.quote(
        VERSION_ID,
        { lines: [{ positionKey: 'boiler-install', quantity: 1 }] },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates draft positions and validates attributes against schema', async () => {
    versions.findOne
      .mockResolvedValueOnce(buildVersion())
      .mockResolvedValueOnce(buildVersion());
    trades.findOne.mockResolvedValue({
      trade: 'HVAC',
      metadata: {
        pricingSchema: {
          fields: [{ name: 'powerKw', type: 'number', required: true }],
        },
      },
    } as unknown as TradeConfig);

    await expect(
      service.update(
        VERSION_ID,
        {
          positions: [
            {
              key: 'boiler-install',
              label: 'Boiler installation',
              unit: PositionUnit.PIECE,
              netPrice: 10000,
              vatRate: '0.190000',
              attributes: {},
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Position attributes failed schema validation',
      },
    });
  });

  it('rejects invalid discount payloads on update', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(
      service.update(
        VERSION_ID,
        {
          discounts: [
            {
              key: 'welcome',
              label: 'Welcome discount',
              flatAmount: 100,
              cap: 50,
              appliesTo: { type: 'subtotal' },
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Discount "welcome" cap is only valid with percentageRate',
      },
    });
  });

  it('rejects invalid discount appliesTo type on update', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(
      service.update(
        VERSION_ID,
        {
          discounts: [
            {
              key: 'scope-test',
              label: 'Scope test',
              percentageRate: '0.1',
              appliesTo: { type: 'invalid' as 'subtotal' },
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Discount "scope-test" appliesTo.type must be "subtotal" or "positions"',
      },
    });
  });

  it('rejects duplicate discount keys on update', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(
      service.update(
        VERSION_ID,
        {
          discounts: [
            {
              key: 'welcome',
              label: 'Welcome A',
              percentageRate: '0.05',
              appliesTo: { type: 'subtotal' },
            },
            {
              key: 'welcome',
              label: 'Welcome B',
              percentageRate: '0.10',
              appliesTo: { type: 'subtotal' },
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Duplicate discount keys in payload',
      },
    });
  });

  it('rejects subtotal discount when appliesTo.keys is provided', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(
      service.update(
        VERSION_ID,
        {
          discounts: [
            {
              key: 'bad-subtotal',
              label: 'Bad subtotal scope',
              percentageRate: '0.05',
              appliesTo: { type: 'subtotal', keys: ['boiler-install'] } as unknown as {
                type: 'subtotal';
              },
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Discount "bad-subtotal" appliesTo.subtotal must not define keys',
      },
    });
  });

  it('rejects positions discount when appliesTo.keys has duplicates', async () => {
    versions.findOne.mockResolvedValue(buildVersion());

    await expect(
      service.update(
        VERSION_ID,
        {
          discounts: [
            {
              key: 'bad-positions',
              label: 'Bad positions scope',
              percentageRate: '0.05',
              appliesTo: { type: 'positions', keys: ['boiler-install', 'boiler-install'] },
            },
          ],
        },
        adminUser,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'Discount "bad-positions" appliesTo.positions keys must be unique',
      },
    });
  });

  it('applies positions and discounts in a single transaction', async () => {
    versions.findOne
      .mockResolvedValueOnce(buildVersion())
      .mockResolvedValueOnce(buildVersion());

    await service.update(
      VERSION_ID,
      {
        positions: [
          {
            key: 'boiler-install',
            label: 'Boiler installation',
            unit: PositionUnit.PIECE,
            netPrice: 10000,
            vatRate: '0.190000',
            attributes: {},
          },
        ],
        discounts: [
          {
            key: 'welcome',
            label: 'Welcome',
            percentageRate: '0.05',
            appliesTo: { type: 'subtotal' },
          },
        ],
      },
      adminUser,
    );

    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
  });
});
