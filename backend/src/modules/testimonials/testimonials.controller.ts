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
import { Public, Roles } from '../auth/auth.decorators';
import { SESSION_COOKIE } from '../auth/auth.types';
import {
  CreateTestimonialDto,
  PublicTestimonialDto,
  TestimonialDto,
  UpdateTestimonialDto,
} from './testimonials.dto';
import { TestimonialsService } from './testimonials.service';

/**
 * Testimonios: como el resto del contenido de la tienda, el personal los consulta y solo la
 * propietaria los crea, edita, publica o elimina.
 */
@ApiTags('Panel: contenido')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('admin/testimonials')
export class AdminTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOkResponse({ type: TestimonialDto, isArray: true })
  list(): Promise<TestimonialDto[]> {
    return this.testimonials.list();
  }

  @Post()
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: TestimonialDto })
  create(@Body() dto: CreateTestimonialDto): Promise<TestimonialDto> {
    return this.testimonials.create(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.ADMIN)
  @ApiOkResponse({ type: TestimonialDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestimonialDto,
  ): Promise<TestimonialDto> {
    return this.testimonials.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.testimonials.remove(id);
  }
}

@ApiTags('Tienda')
@Public()
@Controller('store/testimonials')
export class StoreTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOkResponse({ type: PublicTestimonialDto, isArray: true })
  list(): Promise<PublicTestimonialDto[]> {
    return this.testimonials.listPublic();
  }
}
