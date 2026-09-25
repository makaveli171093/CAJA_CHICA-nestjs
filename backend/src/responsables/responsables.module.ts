import { Module } from '@nestjs/common';
import { ResponsablesService } from './responsables.service';
import { ResponsablesController } from './responsables.controller';

@Module({
  controllers: [ResponsablesController],
  providers: [ResponsablesService],
  exports: [ResponsablesService],
})
export class ResponsablesModule {}
