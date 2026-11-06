import { Module } from '@nestjs/common';
import { ArqueosController } from './arqueos.controller';
import { ArqueosService } from './arqueos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ArqueosController],
  providers: [ArqueosService],
  exports: [ArqueosService],
})
export class ArqueosModule {}
