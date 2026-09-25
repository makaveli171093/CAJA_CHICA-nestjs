import { Module } from '@nestjs/common';
import { PartidasService } from './partidas.service';
import { PartidasController } from './partidas.controller';

@Module({
  controllers: [PartidasController],
  providers: [PartidasService],
  exports: [PartidasService],
})
export class PartidasModule {}
