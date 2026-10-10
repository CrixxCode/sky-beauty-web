import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import {
  PaymentMethodDto,
  SetPaymentMethodCitiesDto,
  UpdatePaymentMethodDto,
} from './payment-methods.dto';
import { PaymentMethodsService } from './payment-methods.service';

/** El personal consulta los métodos de pago; solo la propietaria los modifica. */
@ApiTags('Panel: configuración')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  @Get()
  @ApiOkResponse({ type: [PaymentMethodDto] })
  list(): Promise<PaymentMethodDto[]> {
    return this.methods.list();
  }

  @Patch(':id')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: PaymentMethodDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    return this.methods.update(id, dto);
  }

  @Put(':id/cities')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: PaymentMethodDto })
  setCities(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPaymentMethodCitiesDto,
  ): Promise<PaymentMethodDto> {
    return this.methods.setCities(id, dto.municipalityCodes);
  }
}
