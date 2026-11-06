import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { RendicionesService } from './rendiciones.service';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { CorregirRendicionDto } from './dto/corregir-rendicion.dto';
import {
  AprobarRendicionDto,
  RechazarRendicionDto,
  DevolverRendicionBorradorDto,
} from './dto/aprobar-rechazar.dto';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';

@ApiTags('Rendiciones de Cuentas (Fase 2B)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('rendiciones')
export class RendicionesController {
  constructor(private readonly rendicionesService: RendicionesService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Registrar nueva rendición de cuentas con facturas (Formulario 002 / 5308)' })
  create(
    @Body() createDto: CreateRendicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.create(createDto, user);
  }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Listar rendiciones de cuentas por unidad y gestión con cómputo de 48 horas hábiles' })
  @ApiQuery({ name: 'unidadId', required: true })
  @ApiQuery({ name: 'gestion', required: true, example: 2026 })
  findAll(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.findAll(unidadId, gestion, user);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Obtener detalle completo de una rendición de cuentas' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.findOne(id, user);
  }

  @Patch(':id/enviar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Enviar rendición de cuentas a revisión del rol FINANCIERO' })
  enviar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.enviar(id, user);
  }

  @Patch(':id/aprobar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Aprobar rendición de cuentas (exclusivo para FINANCIERO o ADMINISTRADOR)' })
  aprobar(
    @Param('id') id: string,
    @Body() dto: AprobarRendicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.aprobar(id, dto, user);
  }

  @Patch(':id/rechazar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Rechazar rendición de cuentas con motivo para subsanación' })
  rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarRendicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.rechazar(id, dto, user);
  }

  @Patch(':id/devolver-borrador')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Devolver rendición de cuentas a estado BORRADOR con motivo formal' })
  devolverABorrador(
    @Param('id') id: string,
    @Body() dto: DevolverRendicionBorradorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.devolverABorrador(id, dto, user);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Eliminar rendición de cuentas en estado BORRADOR o RECHAZADA' })
  eliminarBorrador(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.eliminarBorrador(id, user);
  }

  @Patch(':id/corregir')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.ENCARGADO, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Corregir o rectificar datos y facturas de la rendición de cuentas (Fase de Pruebas / Auditable)' })
  corregir(
    @Param('id') id: string,
    @Body() dto: CorregirRendicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.corregir(id, dto, user);
  }

  @Get(':id/reporte-datos')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Obtener datos formateados y coordenadas milimétricas para impresión dual (preimpreso / hoja blanca)' })
  getDatosReporteImpresion(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendicionesService.getDatosReporteImpresion(id, user);
  }
}
