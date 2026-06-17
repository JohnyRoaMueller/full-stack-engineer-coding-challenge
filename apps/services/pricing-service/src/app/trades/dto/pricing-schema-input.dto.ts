import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { SchemaFieldType } from '../pricing-schema-validator';

export class PricingSchemaFieldDependsOnDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  field: string;

  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] })
  equals: string | number | boolean;
}

export class PricingSchemaFieldInputDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  name: string;

  @ApiProperty({ enum: ['string', 'number', 'boolean', 'enum'] })
  @IsIn(['string', 'number', 'boolean', 'enum'])
  type: SchemaFieldType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  @ApiProperty({ required: false, type: PricingSchemaFieldDependsOnDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PricingSchemaFieldDependsOnDto)
  dependsOn?: PricingSchemaFieldDependsOnDto;
}

export class PricingSchemaInputDto {
  @ApiProperty({ type: [PricingSchemaFieldInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingSchemaFieldInputDto)
  fields: PricingSchemaFieldInputDto[];
}
