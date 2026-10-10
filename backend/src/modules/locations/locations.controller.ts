import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../../shared/prisma/prisma.service';

export class LocationDto {
  @ApiProperty({ example: '05' }) code!: string;
  @ApiProperty({ example: 'Antioquia' }) name!: string;
}

/** Departamentos y municipios oficiales (DIVIPOLA del DANE). Públicos: los usa el checkout y el panel. */
@ApiTags('Tienda')
@Public()
@Controller('store/locations')
export class LocationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('departments')
  @ApiOkResponse({ type: [LocationDto] })
  departments(): Promise<LocationDto[]> {
    return this.prisma.department.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('departments/:code/municipalities')
  @ApiOkResponse({ type: [LocationDto] })
  async municipalities(@Param('code') code: string): Promise<LocationDto[]> {
    const department = await this.prisma.department.findUnique({ where: { code } });
    if (!department) throw new NotFoundException('No existe ese departamento.');
    return this.prisma.municipality.findMany({
      where: { departmentCode: code },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
