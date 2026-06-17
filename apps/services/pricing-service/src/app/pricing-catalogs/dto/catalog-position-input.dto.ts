import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PositionUnit } from '../entities/catalog-position.entity';
import { PositionSurchargeInputDto } from './position-surcharge-input.dto';

export class CatalogPositionInputDto {
  @ApiProperty({ example: 'boiler-install' })
  @IsString()
  @Length(1, 64)
  key: string;

  @ApiProperty({ example: 'Boiler installation' })
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ enum: PositionUnit, example: PositionUnit.PIECE })
  @IsEnum(PositionUnit)
  unit: PositionUnit;

  @ApiProperty({ description: 'Net unit price in integer cents', example: 19999 })
  @IsInt()
  @Min(0)
  netPrice: number;

  @ApiProperty({ description: 'VAT rate as decimal fraction', example: '0.190000' })
  @IsString()
  @Length(1, 16)
  @Matches(/^(0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/, {
    message: 'vatRate must be a decimal fraction between 0 and 1 with up to 6 decimals',
  })
  vatRate: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxQuantity?: number | null;

  @ApiProperty({ required: false, type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiProperty({ required: false, type: [PositionSurchargeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionSurchargeInputDto)
  surcharges?: PositionSurchargeInputDto[];
}
