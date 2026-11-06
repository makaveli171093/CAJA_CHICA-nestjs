import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReposicionesService } from './reposiciones.service';
import { CreateReposicionDto } from './dto/create-reposicion.dto';
import {
  AprobarReposicionDto,
  RechazarReposicionDto,
  EfectuarReposicionDto,
} from './dto/gestionar-reposicion.dto';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Reposiciones de Fondos (Reembolsos)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('reposiciones')
export class ReposicionesController {
  constructor(private readonly reposicionesService: ReposicionesService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Solicitar reposición de fondos agrupando rendiciones aprobadas' })
  @ApiResponse({ status: 201, description: 'Reposición solicitada con éxito.' })
  create(
    @Body() dto: CreateReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.create(dto, user);
  }

  @Get('pendientes')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.ENCARGADO, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Listar rendiciones aprobadas pendientes de reposición' })
  getPendientes(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.getRendicionesPendientes(unidadId, gestion, user);
  }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Listar reposiciones de fondos de una unidad y gestión' })
  findAll(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.findAll(unidadId, gestion, user);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Consultar detalle completo de una reposición' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.findOne(id, user);
  }

  @Post(':id/aprobar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Aprobar solicitud de reposición de fondos (Financiero / Administrador)' })
  aprobar(
    @Param('id') id: string,
    @Body() dto: AprobarReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.aprobar(id, dto, user);
  }

  @Post(':id/rechazar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Rechazar solicitud de reposición y liberar rendiciones' })
  rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.rechazar(id, dto, user);
  }

  @Post(':id/efectuar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Registrar cobro y efectivización de reposición en caja física' })
  efectuar(
    @Param('id') id: string,
    @Body() dto: EfectuarReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reposicionesService.efectuar(id, dto, user);
  }
}
