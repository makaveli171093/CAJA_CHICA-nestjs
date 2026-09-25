import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';

@ApiTags('Panel de Inicio (Dashboard)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Obtener datos consolidados de inicio para la unidad y gestión seleccionadas (Saldos, Límites y Presupuesto)',
  })
  @ApiResponse({ status: 200, description: 'Datos reales de la caja chica seleccionada.' })
  getDashboardData(
    @Query('unidadId') unidadId: string,
    @Query('gestion') gestion: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!unidadId) {
      throw new BadRequestException('El parámetro unidadId es obligatorio.');
    }
    const currentYear = new Date().getFullYear();
    const targetGestion = gestion ? parseInt(gestion, 10) : currentYear;

    return this.dashboardService.getDashboardData(unidadId, targetGestion, currentUser);
  }
}
