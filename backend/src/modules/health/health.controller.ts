import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../../shared/prisma/prisma.service';

@ApiTags('Salud')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'La API y la base de datos responden.' })
  @ApiServiceUnavailableResponse({ description: 'La base de datos no responde.' })
  async check(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde.');
    }
    return { status: 'ok', database: 'ok' };
  }
}
