import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin, Public, Roles } from '../auth/auth.decorators';
import { AdminRole } from '../../generated/prisma/client';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import {
  AdminOrderDto,
  CancelOrderDto,
  CartQuoteDto,
  ChangeOrderStatusDto,
  ConfirmOrderDto,
  CreatedOrderDto,
  CreateOrderDto,
  ListOrdersQueryDto,
  PaginatedAdminOrdersDto,
  PublicOrderTrackingDto,
  QuoteCartDto,
  QuoteShippingDto,
  RefundPaymentDto,
  RegisterPaymentReceivedDto,
  RejectPaymentDto,
  UpsertOrderShippingDto,
  UpdateOrderItemsDto,
  VerifyPaymentDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Tienda')
@Public()
@Controller('store/orders')
export class StoreOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quote')
  @ApiOkResponse({ type: CartQuoteDto })
  quote(@Body() dto: QuoteCartDto): Promise<CartQuoteDto> {
    return this.orders.quoteCart(dto);
  }

  @Post()
  @ApiOkResponse({ type: CreatedOrderDto })
  create(@Body() dto: CreateOrderDto): Promise<CreatedOrderDto> {
    return this.orders.createOrder(dto);
  }

  @Get('tracking/:token')
  @ApiOkResponse({ type: PublicOrderTrackingDto })
  track(@Param('token') token: string): Promise<PublicOrderTrackingDto> {
    return this.orders.trackPublic(token);
  }
}

@ApiTags('Panel: pedidos')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedAdminOrdersDto })
  list(@Query() query: ListOrdersQueryDto): Promise<PaginatedAdminOrdersDto> {
    return this.orders.listAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminOrderDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.findAdmin(id, admin.role);
  }

  @Patch(':id/confirm')
  @ApiOkResponse({ type: AdminOrderDto })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOrderDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.confirm(id, dto, admin.id, admin.role);
  }

  @Patch(':id/shipping-cost')
  @ApiOkResponse({ type: AdminOrderDto })
  quoteShipping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuoteShippingDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.quoteShipping(id, dto, admin.id, admin.role);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: AdminOrderDto })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderStatusDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.changeStatus(id, dto, admin.id, admin.role);
  }

  @Patch(':id/shipping')
  @ApiOkResponse({ type: AdminOrderDto })
  upsertShipping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertOrderShippingDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.upsertShipping(id, dto, admin.id, admin.role);
  }

  @Patch(':id/items')
  @ApiOkResponse({ type: AdminOrderDto })
  updateItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderItemsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.updateItems(id, dto, admin.id, admin.role);
  }

  @Patch(':id/cancel')
  @ApiOkResponse({ type: AdminOrderDto })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.cancel(id, dto, admin.id, admin.role);
  }

  @Patch(':id/payment-received')
  @ApiOkResponse({ type: AdminOrderDto })
  registerPaymentReceived(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPaymentReceivedDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.registerPaymentReceived(id, dto, admin.id, admin.role);
  }

  @Patch(':id/payment/verify')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: AdminOrderDto })
  verifyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.verifyPayment(id, dto, admin.id);
  }

  @Patch(':id/payment/reject')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: AdminOrderDto })
  rejectPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.rejectPayment(id, dto, admin.id);
  }

  @Patch(':id/payment/refund')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: AdminOrderDto })
  refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<AdminOrderDto> {
    return this.orders.refundPayment(id, dto, admin.id);
  }
}
