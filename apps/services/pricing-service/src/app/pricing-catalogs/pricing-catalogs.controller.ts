import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@sandbox/auth';
import { JwtPayload, UserRole } from '@sandbox/types';

import { CreatePricingCatalogDto } from './dto/create-pricing-catalog.dto';
import { QueryPricingCatalogsDto } from './dto/query-pricing-catalogs.dto';
import {
  PricingCatalogVersionListItemDto,
  PricingCatalogVersionResponseDto,
} from './dto/pricing-catalog-version-response.dto';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { UpdatePricingCatalogDto } from './dto/update-pricing-catalog.dto';
import { PricingCatalogsService } from './pricing-catalogs.service';

@ApiTags('Pricing Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing-catalogs')
export class PricingCatalogsController {
  constructor(private readonly service: PricingCatalogsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'List catalog versions for a craftsman and trade (newest first)' })
  @ApiResponse({ status: 200, type: [PricingCatalogVersionListItemDto] })
  list(
    @Query() query: QueryPricingCatalogsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PricingCatalogVersionListItemDto[]> {
    return this.service.list(query, user);
  }

  @Get(':versionId')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Get one catalog version with positions, surcharges, and discounts' })
  @ApiResponse({ status: 200, type: PricingCatalogVersionResponseDto })
  @ApiResponse({ status: 403, description: 'Caller may not access this catalog' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  findOne(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    return this.service.findOne(versionId, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Create a new DRAFT catalog version' })
  @ApiResponse({ status: 201, type: PricingCatalogVersionResponseDto })
  @ApiResponse({ status: 409, description: 'A DRAFT already exists for this craftsman and trade' })
  create(
    @Body() dto: CreatePricingCatalogDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    return this.service.create(dto, user);
  }

  @Patch(':versionId')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Update a DRAFT catalog version (positions, effectiveFrom)' })
  @ApiResponse({ status: 200, type: PricingCatalogVersionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed or version is not a DRAFT' })
  update(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdatePricingCatalogDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    return this.service.update(versionId, dto, user);
  }

  @Post(':versionId/publish')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Publish a DRAFT catalog version' })
  @ApiResponse({ status: 200, type: PricingCatalogVersionResponseDto })
  @ApiResponse({ status: 400, description: 'Version is not a DRAFT or effectiveFrom is missing' })
  @ApiResponse({ status: 404, description: 'Version or trade assignment not found' })
  publish(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PricingCatalogVersionResponseDto> {
    return this.service.publish(versionId, user);
  }

  @Post(':versionId/quote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Quote against this catalog version' })
  @ApiResponse({ status: 200, type: QuoteResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid quote input or inactive craftsman' })
  quote(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: QuoteRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    return this.service.quote(versionId, dto, user);
  }
}
