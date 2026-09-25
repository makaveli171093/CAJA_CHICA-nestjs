import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PresupuestosService } from './presupuestos.service';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Presupuesto por Partida')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Asignar presupuesto inicial a una partida para una unidad y gestión' })
  @ApiResponse({ status: 201, description: 'Presupuesto asignado con éxito.' })
  create(
    @Body() createDto: CreatePresupuestoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.presupuestosService.create(createDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar asignaciones presupuestarias por unidad y gestión' })
  findAll(
    @Query('unidadId') unidadId: string,
    @Query('gestion') gestion: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!unidadId || !gestion) {
      throw new BadRequestException('Los parámetros unidadId y gestion son obligatorios.');
    }
    return this.presupuestosService.findAll({
      unidadId,
      gestion: parseInt(gestion, 10),
      currentUser,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle e historial de una partida presupuestaria' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.presupuestosService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Ajustar monto presupuestado con motivo obligatorio e historial' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePresupuestoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.presupuestosService.update(id, updateDto, currentUser);
  }
}
