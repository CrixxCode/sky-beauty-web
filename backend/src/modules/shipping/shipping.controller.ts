import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import {
  CarrierDto,
  CarrierRateDto,
  CreateCarrierDto,
  UpdateCarrierDto,
  UpsertCarrierRateDto,
} from './shipping.dto';
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

  // Las tarifas fijan lo que se le cobra al cliente: como las del municipio, solo la propietaria
  // las edita y el personal las consulta.
  @Get(':id/rates')
  @ApiOkResponse({ type: [CarrierRateDto] })
  listRates(@Param('id', ParseUUIDPipe) id: string): Promise<CarrierRateDto[]> {
    return this.shipping.listRates(id);
  }

  @Post(':id/rates')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: CarrierRateDto })
  upsertRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCarrierRateDto,
  ): Promise<CarrierRateDto> {
    return this.shipping.upsertRate(id, dto);
  }

  @Delete(':id/rates/:rateId')
  @Roles(AdminRole.ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rateId', ParseUUIDPipe) rateId: string,
  ): Promise<void> {
    return this.shipping.deleteRate(id, rateId);
  }
}
