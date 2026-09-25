import { Module } from '@nestjs/common';
import { AperturaService } from './apertura.service';
import { AperturaController } from './apertura.controller';

@Module({
  controllers: [AperturaController],
  providers: [AperturaService],
  exports: [AperturaService],
})
export class AperturaModule {}
