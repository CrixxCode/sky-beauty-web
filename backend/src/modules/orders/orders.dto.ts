import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OrderStatus,
  PaymentStatus,
  ShippingMethod,
  ShippingStatus,
} from '../../generated/prisma/client';

export class CartItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class QuoteCartDto {
  @ApiProperty({ type: () => CartItemInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => CartItemInputDto)
  items!: CartItemInputDto[];

  @ApiPropertyOptional({
    description: 'Codigo DIVIPOLA del municipio para filtrar metodos de pago.',
  })
  @IsOptional()
  @Matches(/^\d{5}$/)
  municipalityCode?: string;
}

export class CreateOrderDto extends QuoteCartDto {
  @ApiProperty({ description: 'Codigo DIVIPOLA del municipio de entrega.' })
  @Matches(/^\d{5}$/)
  declare municipalityCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @ApiProperty({ description: 'Telefono del cliente. Se normaliza como WhatsApp.' })
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  customerPhone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(220)
  addressLine!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryNotes?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(120)
  idempotencyKey!: string;

  @ApiProperty()
  @IsBoolean()
  termsAccepted!: boolean;

  @ApiProperty()
  @IsBoolean()
  dataProcessingAccepted!: boolean;
}

export class AvailablePaymentMethodDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) instructions!: string | null;
  @ApiProperty() requiresVerification!: boolean;
}

export class CartQuoteItemDto {
  @ApiProperty() variantId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() productSlug!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() imageUrl!: string | null;
  @ApiProperty() quantity!: number;
  @ApiProperty({
    description: 'Máximo que se puede pedir ahora (existencias y límite por pedido).',
  })
  maxQuantity!: number;
  @ApiProperty({ nullable: true, type: Number }) maxPerOrder!: number | null;
  @ApiProperty({
    nullable: true,
    enum: ['INSUFFICIENT_STOCK', 'OVER_MAX_PER_ORDER'],
    description: 'Problema de la línea que impide crear el pedido. null = sin problema.',
  })
  issue!: 'INSUFFICIENT_STOCK' | 'OVER_MAX_PER_ORDER' | null;
  @ApiProperty() unitListPrice!: number;
  @ApiProperty() unitDiscount!: number;
  @ApiProperty() unitFinalPrice!: number;
  @ApiProperty() lineSubtotal!: number;
  @ApiProperty() lineDiscount!: number;
  @ApiProperty() lineTotal!: number;
  @ApiProperty({ nullable: true, type: String }) promotionId!: string | null;
  @ApiProperty({ nullable: true, type: String }) promotionName!: string | null;
}

export class CartQuoteDto {
  @ApiProperty({ type: () => CartQuoteItemDto, isArray: true }) items!: CartQuoteItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() discountTotal!: number;
  @ApiProperty({ nullable: true, type: Number }) shippingCost!: number | null;
  @ApiProperty() total!: number;
  @ApiProperty({ nullable: true, type: Number }) freeShippingThreshold!: number | null;
  @ApiProperty() shippingLabel!: string;
  @ApiProperty({ type: () => AvailablePaymentMethodDto, isArray: true })
  availablePaymentMethods!: AvailablePaymentMethodDto[];
  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Variantes del carrito que ya no están a la venta.',
  })
  unavailableVariantIds!: string[];
  @ApiProperty({ description: 'true si el carrito no tiene problemas y se puede crear el pedido.' })
  canCheckout!: boolean;
}

export class CreatedOrderItemDto {
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitFinalPrice!: number;
  @ApiProperty() lineTotal!: number;
}

/** Resumen del pedido tal como quedó registrado. */
export class CreatedOrderSummaryDto {
  @ApiProperty({ type: () => CreatedOrderItemDto, isArray: true }) items!: CreatedOrderItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() discountTotal!: number;
  @ApiProperty({ nullable: true, type: Number }) shippingCost!: number | null;
  @ApiProperty() total!: number;
  @ApiProperty() shippingLabel!: string;
  @ApiProperty() paymentMethodName!: string;
}

export class CreatedOrderDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() publicToken!: string;
  @ApiProperty() trackingPath!: string;
  @ApiProperty({ description: 'Enlace privado de seguimiento completo, para compartir.' })
  trackingUrl!: string;
  @ApiProperty() whatsappMessage!: string;
  @ApiProperty({ nullable: true, type: String }) whatsappUrl!: string | null;
  @ApiProperty({ type: () => CreatedOrderSummaryDto }) summary!: CreatedOrderSummaryDto;
}

export class PublicTrackingShippingDto {
  @ApiProperty({ enum: ShippingMethod }) method!: ShippingMethod;
  @ApiProperty({ enum: ShippingStatus }) status!: ShippingStatus;
  @ApiProperty({ nullable: true, type: String }) carrierName!: string | null;
  @ApiProperty({ nullable: true, type: String }) trackingNumber!: string | null;
  @ApiProperty({ nullable: true, type: String }) trackingUrl!: string | null;
  @ApiProperty({ nullable: true, type: Date }) dispatchedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) deliveredAt!: Date | null;
}

/** Producto del pedido tal como quedó registrado (sin costos internos). */
export class LookupOrderDto {
  @ApiProperty({ description: 'Código del pedido, por ejemplo SB-261013-A1B2C3.' })
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ description: 'Teléfono usado en la compra. Se normaliza como en el checkout.' })
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string;
}

export class LookupOrderResultDto {
  @ApiProperty({ description: 'Ruta del seguimiento privado del pedido.' })
  trackingPath!: string;
}

export class PublicTrackingItemDto {
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitFinalPrice!: number;
  @ApiProperty() lineTotal!: number;
}

export class PublicOrderTrackingDto {
  @ApiProperty() code!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus!: PaymentStatus;
  @ApiProperty() paymentMethodName!: string;
  @ApiProperty({ type: () => PublicTrackingItemDto, isArray: true })
  items!: PublicTrackingItemDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() discountTotal!: number;
  @ApiProperty({ nullable: true, type: Number }) shippingCost!: number | null;
  @ApiProperty() total!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true, type: Date }) confirmedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) cancelledAt!: Date | null;
  @ApiProperty({ nullable: true, type: () => PublicTrackingShippingDto })
  shipping!: PublicTrackingShippingDto | null;
}

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsString()
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Busqueda por codigo, cliente o telefono.' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class AdminOrderItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) variantId!: string | null;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() productSlug!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() unitListPrice!: number;
  @ApiProperty() unitDiscount!: number;
  @ApiProperty() unitFinalPrice!: number;
  @ApiProperty({ nullable: true, type: Number }) unitCost!: number | null;
  @ApiProperty() quantity!: number;
  @ApiProperty() lineTotal!: number;
  @ApiProperty({ nullable: true, type: String }) promotionId!: string | null;
  @ApiProperty({ nullable: true, type: String }) promotionName!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class AdminOrderEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ nullable: true, type: String }) fromStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) toStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ nullable: true, type: String }) changedById!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class AdminPaymentRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty() amount!: number;
  @ApiProperty({ nullable: true, type: String }) reference!: string | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ nullable: true, type: String }) recordedById!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class AdminShippingDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ShippingMethod }) method!: ShippingMethod;
  @ApiProperty({ nullable: true, type: String }) carrierId!: string | null;
  @ApiProperty({ nullable: true, type: String }) carrierName!: string | null;
  @ApiProperty({ nullable: true, type: String }) carrierTrackingUrlTemplate!: string | null;
  @ApiProperty({ nullable: true, type: String }) trackingNumber!: string | null;
  @ApiProperty({ nullable: true, type: String }) trackingUrl!: string | null;
  @ApiProperty({ nullable: true, type: Number }) carrierCost!: number | null;
  @ApiProperty({ enum: ShippingStatus }) status!: ShippingStatus;
  @ApiProperty({ nullable: true, type: Date }) dispatchedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) deliveredAt!: Date | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class AdminOrderListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus!: PaymentStatus;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerPhone!: string;
  @ApiProperty() city!: string;
  @ApiProperty() department!: string;
  @ApiProperty() paymentMethodName!: string;
  @ApiProperty() subtotal!: number;
  @ApiProperty() discountTotal!: number;
  @ApiProperty({ nullable: true, type: Number }) shippingCost!: number | null;
  @ApiProperty() total!: number;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class AdminOrderDto extends AdminOrderListItemDto {
  @ApiProperty() municipalityCode!: string;
  @ApiProperty() addressLine!: string;
  @ApiProperty({ nullable: true, type: String }) deliveryNotes!: string | null;
  @ApiProperty() paymentMethodCode!: string;
  @ApiProperty({ nullable: true, type: Date }) confirmedAt!: Date | null;
  @ApiProperty({
    description: 'Enlace privado de seguimiento del cliente, para reenviárselo si lo pide.',
  })
  trackingUrl!: string;
  @ApiProperty({ nullable: true, type: Date }) paymentRejectedAt!: Date | null;
  @ApiProperty({
    nullable: true,
    type: Date,
    description: 'Fin del plazo de aclaración de un pago rechazado. null = sin pago rechazado.',
  })
  paymentClarificationDeadline!: Date | null;
  @ApiProperty({
    description: 'true si el personal ya puede cancelar el pedido por pago no demostrado.',
  })
  staffCanCancel!: boolean;
  @ApiProperty({ nullable: true, type: Date }) cancelledAt!: Date | null;
  @ApiProperty({ nullable: true, type: String }) cancelReason!: string | null;
  @ApiProperty({ type: () => AdminOrderItemDto, isArray: true }) items!: AdminOrderItemDto[];
  @ApiProperty({ type: () => AdminOrderEventDto, isArray: true }) events!: AdminOrderEventDto[];
  @ApiProperty({ type: () => AdminPaymentRecordDto, isArray: true })
  paymentRecords!: AdminPaymentRecordDto[];
  @ApiProperty({ nullable: true, type: () => AdminShippingDto })
  shipping!: AdminShippingDto | null;
}

export class PaginatedAdminOrdersDto {
  @ApiProperty({ type: () => AdminOrderListItemDto, isArray: true })
  items!: AdminOrderListItemDto[];
  @ApiProperty() total!: number;
}

export class QuoteShippingDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost!: number;
}

export class ConfirmOrderDto {
  @ApiPropertyOptional({ minimum: 0, description: 'Obligatorio si el envio seguia por confirmar.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost?: number;
}

export class ChangeOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpsertOrderShippingDto {
  @ApiPropertyOptional({
    enum: ShippingMethod,
    description: 'Por transportadora o entrega local. Si se omite, se conserva el registrado.',
  })
  @IsOptional()
  @IsEnum(ShippingMethod)
  method?: ShippingMethod;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  carrierId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  carrierCost?: number | null;

  @ApiProperty({ enum: ShippingStatus })
  @IsEnum(ShippingStatus)
  status!: ShippingStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  deliveredAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateOrderItemsDto {
  @ApiProperty({ type: () => CartItemInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => CartItemInputDto)
  items!: CartItemInputDto[];
}

export class CancelOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(400)
  reason!: string;
}

export class RegisterPaymentReceivedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VerifyPaymentDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectPaymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RefundPaymentDto {
  @ApiProperty({ minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note!: string;
}
