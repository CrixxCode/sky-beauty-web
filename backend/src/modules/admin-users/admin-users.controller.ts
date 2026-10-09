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
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import { AdminUserDto, CreateStaffDto, ResetPasswordDto, UpdateStaffDto } from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Panel: cuentas')
@ApiCookieAuth(SESSION_COOKIE)
@Roles(AdminRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ type: [AdminUserDto] })
  list(): Promise<AdminUserDto[]> {
    return this.users.list();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminUserDto })
  create(@Body() dto: CreateStaffDto): Promise<AdminUserDto> {
    return this.users.createStaff(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AdminUserDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<AdminUserDto> {
    return this.users.updateStaff(id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Contraseña restablecida; se cierran sus sesiones.' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.users.resetStaffPassword(id, dto.newPassword);
  }
}
