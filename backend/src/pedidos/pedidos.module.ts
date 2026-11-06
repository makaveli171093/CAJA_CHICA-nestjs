import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { ValePdfService } from './services/vale-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PedidosController],
  providers: [PedidosService, ValePdfService],
  exports: [PedidosService, ValePdfService],
})
export class PedidosModule {}
