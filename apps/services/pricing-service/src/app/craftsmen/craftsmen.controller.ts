import {
  Body,
  Controller,
  Delete,
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
import { JwtPayload, PaginatedResponse, UserRole } from '@sandbox/types';

import { CraftsmenService } from './craftsmen.service';
import { CreateCraftsmanDto } from './dto/create-craftsman.dto';
import { UpdateCraftsmanDto } from './dto/update-craftsman.dto';
import { QueryCraftsmenDto } from './dto/query-craftsmen.dto';
import { CraftsmanResponseDto } from './dto/craftsman-response.dto';
import { QuoteRequestDto } from '../pricing-catalogs/dto/quote-request.dto';
import { QuoteResponseDto } from '../pricing-catalogs/dto/quote-response.dto';

@ApiTags('Craftsmen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('craftsmen')
export class CraftsmenController {
  constructor(private readonly service: CraftsmenService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'List craftsmen (scoped to the calling user)' })
  @ApiResponse({ status: 200, description: 'Paginated craftsman list' })
  list(
    @Query() query: QueryCraftsmenDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResponse<CraftsmanResponseDto>> {
    return this.service.list(query, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Get one craftsman by id' })
  @ApiResponse({ status: 200, type: CraftsmanResponseDto })
  @ApiResponse({ status: 403, description: 'Caller may not access this craftsman' })
  @ApiResponse({ status: 404, description: 'Craftsman not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CraftsmanResponseDto> {
    return this.service.findOne(id, user);
  }

  @Post(':id/trades/:trade/quote')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Quote against the active published catalog for a craftsman and trade' })
  @ApiResponse({ status: 200, type: QuoteResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid quote input or inactive craftsman' })
  @ApiResponse({ status: 403, description: 'Caller may not access this craftsman' })
  @ApiResponse({ status: 404, description: 'No active published catalog or trade not found' })
  quoteActiveCatalog(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trade') trade: string,
    @Body() dto: QuoteRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuoteResponseDto> {
    return this.service.quoteActiveCatalog(id, trade, dto, user);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a craftsman' })
  @ApiResponse({ status: 201, type: CraftsmanResponseDto })
  create(
    @Body() dto: CreateCraftsmanDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CraftsmanResponseDto> {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Update a craftsman (partial)' })
  @ApiResponse({ status: 200, type: CraftsmanResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCraftsmanDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CraftsmanResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a craftsman' })
  @ApiResponse({ status: 204 })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user);
  }
}
