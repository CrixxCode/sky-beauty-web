import { Module } from '@nestjs/common';
import {
  AdminTestimonialsController,
  StoreTestimonialsController,
} from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  controllers: [AdminTestimonialsController, StoreTestimonialsController],
  providers: [TestimonialsService],
})
export class TestimonialsModule {}
