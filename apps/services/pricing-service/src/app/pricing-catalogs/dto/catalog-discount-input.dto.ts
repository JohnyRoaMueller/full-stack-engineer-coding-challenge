import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

class DiscountAppliesToPositionsDto {
  @ApiProperty({ example: 'positions' })
  @IsString()
  @IsIn(['positions'])
  type: 'positions';

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  keys: string[];
}

class DiscountAppliesToSubtotalDto {
  @ApiProperty({ example: 'subtotal' })
  @IsString()
  @IsIn(['subtotal'])
  type: 'subtotal';
}

export class CatalogDiscountInputDto {
  @ApiProperty({ example: 'welcome-discount' })
  @IsString()
  @Length(1, 64)
  key: string;

  @ApiProperty({ example: 'Welcome discount' })
  @IsString()
  @Length(1, 255)
  label: string;

  @ApiProperty({ required: false, description: 'Flat amount in cents', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmount?: number | null;

  @ApiProperty({ required: false, description: 'Decimal fraction e.g. 0.05', nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  @Matches(/^(0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/, {
    message: 'percentageRate must be a decimal fraction between 0 and 1 with up to 6 decimals',
  })
  percentageRate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  cap?: number | null;

  @ApiProperty({
    oneOf: [{ $ref: '#/components/schemas/DiscountAppliesToSubtotalDto' }, { $ref: '#/components/schemas/DiscountAppliesToPositionsDto' }],
  })
  @IsObject()
  appliesTo: DiscountAppliesToSubtotalDto | DiscountAppliesToPositionsDto;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
