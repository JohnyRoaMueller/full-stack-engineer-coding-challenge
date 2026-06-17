import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload, UserRole } from '@sandbox/types';

import { Craftsman } from '../craftsmen/entities/craftsman.entity';
import { CraftsmanTradeAssignment } from '../craftsmen/entities/craftsman-trade-assignment.entity';
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

const EFFECTIVE_FROM = new Date('2026-06-01T00:00:00.000Z');
const PREVIOUS_VERSION_ID = '44444444-4444-4444-4444-444444444444';

function buildPublishTransactionMock(
  draft: PricingCatalogVersion,
  options: {
    activePublished?: PricingCatalogVersion | null;
    assignment?: CraftsmanTradeAssignment | null;
    tradeMetadata?: Record<string, unknown>;
  } = {},
): {
  versionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  getDraftState: () => PricingCatalogVersion;
  install: (dataSourceMock: { transaction: jest.Mock }) => void;
} {
  let draftState = { ...draft };

  const assignmentQb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(
      options.assignment === undefined
        ? ({ id: 'assignment-id', craftsmanId: CRAFTSMAN_ID, trade: 'HVAC' } as CraftsmanTradeAssignment)
        : options.assignment,
    ),
  };

  const versionQb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockImplementation(() =>
      Promise.resolve({
        ...draftState,
      }),
    ),
  };

  const versionRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(versionQb),
    findOne: jest.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      if (
        where.status === CatalogVersionStatus.PUBLISHED &&
        Object.prototype.hasOwnProperty.call(where, 'effectiveUntil')
      ) {
        return Promise.resolve(options.activePublished ?? null);
      }
      return Promise.resolve({
        ...draftState,
        positions: draft.positions,
        discounts: draft.discounts,
      });
    }),
    save: jest.fn().mockImplementation((version: PricingCatalogVersion) => {
      if (version.id === draftState.id) {
        draftState = { ...draftState, ...version };
      }
      return Promise.resolve(version);
    }),
  };

  const positionRepo = {
    find: jest.fn().mockResolvedValue(draft.positions ?? []),
  };

  return {
    versionRepo,
    getDraftState: () => draftState,
    install: (dataSourceMock: { transaction: jest.Mock }) => {
      dataSourceMock.transaction.mockImplementation(async (cb: (tx: DataSource) => Promise<unknown>) =>
        cb({
          getRepository: jest.fn().mockImplementation((entity: unknown) => {
            if (entity === CraftsmanTradeAssignment) {
              return { createQueryBuilder: jest.fn().mockReturnValue(assignmentQb) };
            }
            if (entity === PricingCatalogVersion) {
              return versionRepo;
            }
            if (entity === CatalogPosition) {
              return positionRepo;
            }
            if (entity === TradeConfig) {
              return {
                findOne: jest.fn().mockResolvedValue({
                  trade: 'HVAC',
                  metadata: options.tradeMetadata ?? { pricingSchema: { fields: [] } },
                } as unknown as TradeConfig),
              };
            }
            return {};
          }),
        } as unknown as DataSource),
      );
    },
  };
}

describe('PricingCatalogsService', () => {
  let service: PricingCatalogsService;
  let versions: jest.Mocked<
    Pick<Repository<PricingCatalogVersion>, 'find' | 'findOne' | 'save' | 'create' | 'createQueryBuilder'>
  >;
  let craftsmen: jest.Mocked<Pick<Repository<Craftsman>, 'findOne'>>;
  let trades: jest.Mocked<Pick<Repository<TradeConfig>, 'findOne'>>;
  let dataSourceMock: { transaction: jest.Mock };

  beforeEach(async () => {
    versions = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((x: PricingCatalogVersion) => x),
      createQueryBuilder: jest.fn(),
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

  describe('quoteActiveForCraftsmanTrade', () => {
    let activeVersionQb: {
      where: jest.Mock;
      andWhere: jest.Mock;
      orderBy: jest.Mock;
      getOne: jest.Mock;
    };

    beforeEach(() => {
      activeVersionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      versions.createQueryBuilder.mockReturnValue(activeVersionQb as never);
    });

    it('quotes against active published version for admin', async () => {
      activeVersionQb.getOne.mockResolvedValue({ id: VERSION_ID });
      versions.findOne.mockResolvedValue(
        buildVersion({
          status: CatalogVersionStatus.PUBLISHED,
          effectiveFrom: EFFECTIVE_FROM,
        }),
      );

      const result = await service.quoteActiveForCraftsmanTrade(
        CRAFTSMAN_ID,
        'HVAC',
        { lines: [{ positionKey: 'boiler-install', quantity: 2 }] },
        adminUser,
      );

      expect(result.totals.net).toBe(20000);
      expect(versions.createQueryBuilder).toHaveBeenCalledWith('version');
    });

    it('rejects when no active published version exists', async () => {
      activeVersionQb.getOne.mockResolvedValue(null);

      await expect(
        service.quoteActiveForCraftsmanTrade(
          CRAFTSMAN_ID,
          'HVAC',
          { lines: [{ positionKey: 'boiler-install', quantity: 1 }] },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects catalog access for another craftsman', async () => {
      await expect(
        service.quoteActiveForCraftsmanTrade(
          CRAFTSMAN_ID,
          'HVAC',
          { lines: [{ positionKey: 'boiler-install', quantity: 1 }] },
          otherCraftsmanUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(activeVersionQb.getOne).not.toHaveBeenCalled();
    });

    it('rejects quote when craftsman is inactive', async () => {
      activeVersionQb.getOne.mockResolvedValue({ id: VERSION_ID });
      versions.findOne.mockResolvedValue(
        buildVersion({
          status: CatalogVersionStatus.PUBLISHED,
          effectiveFrom: EFFECTIVE_FROM,
        }),
      );
      craftsmen.findOne.mockResolvedValue({ id: CRAFTSMAN_ID, isActive: false } as Craftsman);

      await expect(
        service.quoteActiveForCraftsmanTrade(
          CRAFTSMAN_ID,
          'HVAC',
          { lines: [{ positionKey: 'boiler-install', quantity: 1 }] },
          adminUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
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

  describe('publish', () => {
    it('publishes a draft with effectiveFrom and records the publishing user', async () => {
      const draft = buildVersion({ effectiveFrom: EFFECTIVE_FROM });
      const publishMock = buildPublishTransactionMock(draft);
      publishMock.install(dataSourceMock);

      versions.findOne
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce(
          buildVersion({
            status: CatalogVersionStatus.PUBLISHED,
            effectiveFrom: EFFECTIVE_FROM,
            publishedByUserId: adminUser.sub,
          }),
        );

      const result = await service.publish(VERSION_ID, adminUser);

      expect(result.status).toBe(CatalogVersionStatus.PUBLISHED);
      expect(result.publishedByUserId).toBe(adminUser.sub);
      expect(publishMock.getDraftState().status).toBe(CatalogVersionStatus.PUBLISHED);
      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
    });

    it('closes the previously active published version at the new effectiveFrom', async () => {
      const draft = buildVersion({ effectiveFrom: EFFECTIVE_FROM });
      const activePublished = buildVersion({
        id: PREVIOUS_VERSION_ID,
        status: CatalogVersionStatus.PUBLISHED,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveUntil: null,
      });
      const publishMock = buildPublishTransactionMock(draft, { activePublished });
      publishMock.install(dataSourceMock);

      versions.findOne
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce(
          buildVersion({
            status: CatalogVersionStatus.PUBLISHED,
            effectiveFrom: EFFECTIVE_FROM,
            publishedByUserId: adminUser.sub,
          }),
        );

      await service.publish(VERSION_ID, adminUser);

      expect(publishMock.versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: PREVIOUS_VERSION_ID,
          effectiveUntil: EFFECTIVE_FROM,
        }),
      );
      expect(publishMock.versionRepo.save).toHaveBeenCalledTimes(2);
    });

    it('rejects publish when effectiveFrom is not set', async () => {
      const draft = buildVersion({ effectiveFrom: null });
      const publishMock = buildPublishTransactionMock(draft);
      publishMock.install(dataSourceMock);
      versions.findOne.mockResolvedValue(draft);

      await expect(service.publish(VERSION_ID, adminUser)).rejects.toMatchObject({
        response: { message: 'effectiveFrom must be set before publishing' },
      });
    });

    it('rejects publishing an already published version', async () => {
      const published = buildVersion({
        status: CatalogVersionStatus.PUBLISHED,
        effectiveFrom: EFFECTIVE_FROM,
        publishedByUserId: adminUser.sub,
      });
      const publishMock = buildPublishTransactionMock(published);
      publishMock.install(dataSourceMock);
      versions.findOne.mockResolvedValue(published);

      await expect(service.publish(VERSION_ID, adminUser)).rejects.toMatchObject({
        response: { message: 'Published catalog versions cannot be modified' },
      });
    });

    it('rejects updating a published version', async () => {
      versions.findOne.mockResolvedValue(
        buildVersion({
          status: CatalogVersionStatus.PUBLISHED,
          effectiveFrom: EFFECTIVE_FROM,
        }),
      );

      await expect(
        service.update(VERSION_ID, { effectiveFrom: '2026-07-01T00:00:00.000Z' }, adminUser),
      ).rejects.toMatchObject({
        response: { message: 'Published catalog versions cannot be modified' },
      });
    });

    it('rejects publish when the craftsman has no trade assignment', async () => {
      const draft = buildVersion({ effectiveFrom: EFFECTIVE_FROM });
      const publishMock = buildPublishTransactionMock(draft, { assignment: null });
      publishMock.install(dataSourceMock);
      versions.findOne.mockResolvedValue(draft);

      await expect(service.publish(VERSION_ID, adminUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('allows only one concurrent publish attempt to succeed', async () => {
      const draft = buildVersion({ effectiveFrom: EFFECTIVE_FROM });
      const publishMock = buildPublishTransactionMock(draft);
      publishMock.install(dataSourceMock);

      let inTransaction = false;
      const originalTransaction = dataSourceMock.transaction.getMockImplementation();
      dataSourceMock.transaction.mockImplementation(async (cb: (tx: DataSource) => Promise<unknown>) => {
        while (inTransaction) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        }
        inTransaction = true;
        try {
          return await originalTransaction?.(cb);
        } finally {
          inTransaction = false;
        }
      });

      versions.findOne.mockImplementation(async () => {
        const state = publishMock.getDraftState();
        return buildVersion({
          status: state.status,
          effectiveFrom: EFFECTIVE_FROM,
          publishedByUserId: state.publishedByUserId,
        });
      });

      const results = await Promise.allSettled([
        service.publish(VERSION_ID, adminUser),
        service.publish(VERSION_ID, adminUser),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    });
  });
});
