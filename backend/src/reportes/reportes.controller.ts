import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Reportes Ejecutivos y Métricas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ejecucion-presupuestaria')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Reporte consolidado de ejecución presupuestaria' })
  getEjecucion(
    @Query('gestion', ParseIntPipe) gestion: number,
    @Query('unidadId') unidadId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.reportesService.getEjecucionPresupuestaria({
      gestion,
      unidadId,
      currentUser: user!,
    });
  }

  @Get('kardex-caja')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Libro diario / Kardex de movimientos de efectivo de caja' })
  getKardex(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportesService.getKardexCaja(unidadId, gestion, user);
  }

  @Get('cumplimiento-plazos')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Auditoría de cumplimiento de las 48 horas hábiles administrativas' })
  getCumplimiento(
    @Query('gestion', ParseIntPipe) gestion: number,
    @Query('unidadId') unidadId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.reportesService.getCumplimientoPlazos(gestion, unidadId, user);
  }
}
