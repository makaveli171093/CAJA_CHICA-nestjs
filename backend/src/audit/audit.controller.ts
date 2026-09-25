import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Auditoría del Sistema')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('auditoria')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar registros de auditoría (Solo Administrador)' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entidad') entidad?: string,
    @Query('accion') accion?: string,
  ) {
    return this.auditService.findAll({ page, limit, entidad, accion });
  }
}
