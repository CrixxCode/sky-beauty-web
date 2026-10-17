import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  AdminNotificationType,
  CancellationNoticeCase,
  CancellationNoticeStage,
  CancellationNoticeStatus,
  OrderUpdateNoticeType,
} from '../../generated/prisma/client';

export class ListNoticesQueryDto {
  @ApiPropertyOptional({ enum: CancellationNoticeStatus, default: 'PENDING' })
  @IsOptional()
  @IsEnum(CancellationNoticeStatus)
  status?: CancellationNoticeStatus;
}

export class CancellationNoticeDto {
  @ApiProperty({ enum: ['CANCELLATION', 'ORDER_UPDATE'] }) kind!: 'CANCELLATION' | 'ORDER_UPDATE';
  @ApiProperty() id!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty() orderCode!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerPhone!: string;
  @ApiProperty({ enum: CancellationNoticeCase, nullable: true })
  case!: CancellationNoticeCase | null;
  @ApiProperty({ enum: OrderUpdateNoticeType, nullable: true }) type!: OrderUpdateNoticeType | null;
  @ApiProperty() caseName!: string;
  @ApiProperty({ enum: CancellationNoticeStage, nullable: true })
  stage!: CancellationNoticeStage | null;
  @ApiProperty({ enum: CancellationNoticeStatus }) status!: CancellationNoticeStatus;
  @ApiProperty({ nullable: true, type: Date }) deadlineAt!: Date | null;
  @ApiProperty({ description: 'Mensaje aprobado listo para WhatsApp.' }) message!: string;
  @ApiProperty({ description: 'Abre WhatsApp con el cliente y el mensaje escrito.' })
  whatsappUrl!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true, type: Date }) sentAt!: Date | null;
  @ApiProperty({ nullable: true, type: String }) sentByName!: string | null;
}

export class PendingNoticesCountDto {
  @ApiProperty() pending!: number;
}

export class AdminNotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AdminNotificationType }) type!: AdminNotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ description: 'Ruta del panel que permite atender la notificación.' })
  href!: string;
  @ApiProperty({ nullable: true, type: String }) orderId!: string | null;
  @ApiProperty({ nullable: true, type: String }) noticeId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() read!: boolean;
}

export class NotificationsDto {
  @ApiProperty() unread!: number;
  @ApiProperty({ type: () => AdminNotificationDto, isArray: true }) items!: AdminNotificationDto[];
}
