import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import {
  MarginsReportDto,
  ReportRangeQueryDto,
  SalesReportDto,
  SalesReportQueryDto,
  TopProductDto,
  TopProductsQueryDto,
} from './reports.dto';
import { ReportsService } from './reports.service';

/** Reportes: solo la propietaria (incluyen costos y márgenes). */
@ApiTags('Panel: reportes')
@ApiCookieAuth(SESSION_COOKIE)
@Roles(AdminRole.ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  @ApiOkResponse({ type: SalesReportDto })
  sales(@Query() query: SalesReportQueryDto): Promise<SalesReportDto> {
    return this.reports.sales(query, query.groupBy);
  }

  @Get('top-products')
  @ApiOkResponse({ type: TopProductDto, isArray: true })
  topProducts(@Query() query: TopProductsQueryDto): Promise<TopProductDto[]> {
    return this.reports.topProducts(query, query.limit);
  }

  @Get('margins')
  @ApiOkResponse({ type: MarginsReportDto })
  margins(@Query() query: ReportRangeQueryDto): Promise<MarginsReportDto> {
    return this.reports.margins(query);
  }
}
