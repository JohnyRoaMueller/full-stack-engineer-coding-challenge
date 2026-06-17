import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogPosition } from '../pricing-catalogs/entities/catalog-position.entity';
import { TradeConfig } from './entities/trade-config.entity';
import { TradesService } from './trades.service';

describe('TradesService', () => {
  let service: TradesService;
  let repo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let positions: { find: jest.Mock };

  const existingTrade: TradeConfig = {
    id: 'trade-1',
    trade: 'WINDOWS',
    displayName: 'Windows',
    isActive: true,
    metadata: {
      pricingSchema: {
        fields: [{ name: 'uValue', type: 'number', required: true }],
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
    positions = { find: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TradesService,
        {
          provide: getRepositoryToken(TradeConfig),
          useValue: repo as Partial<Repository<TradeConfig>>,
        },
        {
          provide: getRepositoryToken(CatalogPosition),
          useValue: positions as Partial<Repository<CatalogPosition>>,
        },
      ],
    }).compile();
    service = moduleRef.get(TradesService);
  });

  it('list() returns mapped trade configs ordered by trade', async () => {
    repo.find.mockResolvedValue([
      { id: '1', trade: 'HVAC', displayName: 'Heating', isActive: true, metadata: {} },
    ]);
    const result = await service.list();
    expect(repo.find).toHaveBeenCalledWith({ order: { trade: 'ASC' } });
    expect(result[0].trade).toBe('HVAC');
  });

  it('findByCode() returns one config', async () => {
    repo.findOne.mockResolvedValue({
      id: '1',
      trade: 'HVAC',
      displayName: 'Heating',
      isActive: true,
      metadata: {},
    });
    const result = await service.findByCode('HVAC');
    expect(result.trade).toBe('HVAC');
  });

  it('findByCode() throws NotFoundException when trade is unknown', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findByCode('UNKNOWN')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('update()', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({ ...existingTrade });
      repo.save.mockImplementation(async (entity: TradeConfig) => entity);
    });

    it('updates displayName only without checking catalog positions', async () => {
      const result = await service.update('WINDOWS', { displayName: 'Window Systems' });

      expect(positions.find).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Window Systems' }),
      );
      expect(result.displayName).toBe('Window Systems');
    });

    it('updates pricingSchema only when no positions conflict', async () => {
      const newSchema = {
        fields: [{ name: 'widthMm', type: 'number' as const, required: true }],
      };

      const result = await service.update('WINDOWS', { pricingSchema: newSchema });

      expect(positions.find).toHaveBeenCalledWith({
        where: { version: { trade: 'WINDOWS' } },
        select: ['key', 'attributes', 'versionId'],
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ pricingSchema: newSchema }),
        }),
      );
      expect(result.metadata.pricingSchema).toEqual(newSchema);
    });

    it('updates displayName and pricingSchema together', async () => {
      const newSchema = {
        fields: [{ name: 'widthMm', type: 'number' as const }],
      };

      const result = await service.update('WINDOWS', {
        displayName: 'Glazing',
        pricingSchema: newSchema,
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Glazing',
          metadata: expect.objectContaining({ pricingSchema: newSchema }),
        }),
      );
      expect(result.displayName).toBe('Glazing');
      expect(result.metadata.pricingSchema).toEqual(newSchema);
    });

    it('throws NotFoundException for an unknown trade', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('UNKNOWN', { displayName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException for an empty patch body', async () => {
      await expect(service.update('WINDOWS', {})).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when pricingSchema would invalidate existing positions', async () => {
      positions.find.mockResolvedValue([
        {
          versionId: 'version-1',
          key: 'standard-window',
          attributes: { uValue: 0.9 },
        },
      ]);

      await expect(
        service.update('WINDOWS', {
          pricingSchema: { fields: [{ name: 'widthMm', type: 'number', required: true }] },
        }),
      ).rejects.toMatchObject({
        response: {
          message: 'New pricingSchema would invalidate existing catalog positions',
          conflicts: [
            expect.objectContaining({
              versionId: 'version-1',
              positionKey: 'standard-window',
              errors: expect.arrayContaining([
                expect.objectContaining({ field: 'uValue', code: 'UNKNOWN_FIELD' }),
              ]),
            }),
          ],
        },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects with ConflictException (not a generic Error)', async () => {
      positions.find.mockResolvedValue([
        {
          versionId: 'version-1',
          key: 'standard-window',
          attributes: { uValue: 0.9 },
        },
      ]);

      await expect(
        service.update('WINDOWS', {
          pricingSchema: { fields: [] },
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
