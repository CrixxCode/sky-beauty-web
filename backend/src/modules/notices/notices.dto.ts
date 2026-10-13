import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  AdminNotificationType,
  CancellationNoticeCase,
  CancellationNoticeStage,
  CancellationNoticeStatus,
} from '../../generated/prisma/client';

export class ListNoticesQueryDto {
  @ApiPropertyOptional({ enum: CancellationNoticeStatus, default: 'PENDING' })
  @IsOptional()
  @IsEnum(CancellationNoticeStatus)
  status?: CancellationNoticeStatus;
}

export class CancellationNoticeDto {
  @ApiProperty() id!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty() orderCode!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerPhone!: string;
  @ApiProperty({ enum: CancellationNoticeCase }) case!: CancellationNoticeCase;
  @ApiProperty() caseName!: string;
  @ApiProperty({ enum: CancellationNoticeStage }) stage!: CancellationNoticeStage;
  @ApiProperty({ enum: CancellationNoticeStatus }) status!: CancellationNoticeStatus;
  @ApiProperty() deadlineAt!: Date;
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
  @ApiProperty({ nullable: true, type: String }) orderId!: string | null;
  @ApiProperty({ nullable: true, type: String }) noticeId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() read!: boolean;
}

export class NotificationsDto {
  @ApiProperty() unread!: number;
  @ApiProperty({ type: () => AdminNotificationDto, isArray: true }) items!: AdminNotificationDto[];
}
