import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/auth.types';
import { CarrierDto, CreateCarrierDto, UpdateCarrierDto } from './shipping.dto';
import { ShippingService } from './shipping.service';

@ApiTags('Panel: envios')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/carriers')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  @ApiOkResponse({ type: [CarrierDto] })
  listCarriers(): Promise<CarrierDto[]> {
    return this.shipping.listCarriers();
  }

  @Post()
  @ApiOkResponse({ type: CarrierDto })
  createCarrier(@Body() dto: CreateCarrierDto): Promise<CarrierDto> {
    return this.shipping.createCarrier(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CarrierDto })
  updateCarrier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarrierDto,
  ): Promise<CarrierDto> {
    return this.shipping.updateCarrier(id, dto);
  }
}
