import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard } from '@sandbox/auth';
import { UserRole } from '@sandbox/types';
import { TradesService } from './trades.service';
import { TradeConfigResponseDto } from './dto/trade-config-response.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';

@ApiTags('Trades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trades')
export class TradesController {
  constructor(private readonly service: TradesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'List trade configurations' })
  @ApiResponse({ status: 200, type: [TradeConfigResponseDto] })
  list(): Promise<TradeConfigResponseDto[]> {
    return this.service.list();
  }

  @Get(':trade')
  @Roles(UserRole.ADMIN, UserRole.CRAFTSMAN)
  @ApiOperation({ summary: 'Get one trade configuration by trade code' })
  @ApiResponse({ status: 200, type: TradeConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  findOne(@Param('trade') trade: string): Promise<TradeConfigResponseDto> {
    return this.service.findByCode(trade);
  }

  @Patch(':trade')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update trade displayName and/or pricingSchema (ADMIN only)' })
  @ApiResponse({ status: 200, type: TradeConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Empty patch body or invalid input' })
  @ApiResponse({ status: 404, description: 'Trade not found' })
  @ApiResponse({
    status: 409,
    description: 'New pricingSchema would invalidate existing catalog positions',
  })
  update(
    @Param('trade') trade: string,
    @Body() dto: UpdateTradeDto,
  ): Promise<TradeConfigResponseDto> {
    return this.service.update(trade, dto);
  }
}
