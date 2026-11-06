import { Module } from '@nestjs/common';
import { RendicionesController } from './rendiciones.controller';
import { RendicionesService } from './rendiciones.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RendicionesController],
  providers: [RendicionesService],
  exports: [RendicionesService],
})
export class RendicionesModule {}
