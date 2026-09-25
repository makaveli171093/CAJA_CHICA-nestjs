import { Module } from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestosController } from './presupuestos.controller';

@Module({
  controllers: [PresupuestosController],
  providers: [PresupuestosService],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
