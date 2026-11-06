import { Module } from '@nestjs/common';
import { ReposicionesController } from './reposiciones.controller';
import { ReposicionesService } from './reposiciones.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReposicionesController],
  providers: [ReposicionesService],
  exports: [ReposicionesService],
})
export class ReposicionesModule {}
