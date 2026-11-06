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
import { ArqueosService } from './arqueos.service';
import { CreateArqueoDto } from './dto/create-arqueo.dto';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Arqueos Físicos de Caja Chica')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('arqueos')
export class ArqueosController {
  constructor(private readonly arqueosService: ArqueosService) {}

  @Get('resumen-previo')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Obtener datos preliminares del arqueo (vales, rendiciones y fondo)' })
  getResumenPrevio(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arqueosService.getResumenPrevio(unidadId, gestion, user);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Registrar un nuevo Arqueo Físico de Caja con billeteo formal' })
  @ApiResponse({ status: 201, description: 'Arqueo registrado satisfactoriamente.' })
  create(
    @Body() dto: CreateArqueoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arqueosService.create(dto, user);
  }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Listar actas de arqueo de una unidad y gestión' })
  findAll(
    @Query('unidadId') unidadId: string,
    @Query('gestion', ParseIntPipe) gestion: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arqueosService.findAll(unidadId, gestion, user);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO, RolUsuario.GERENCIA, RolUsuario.ENCARGADO)
  @ApiOperation({ summary: 'Consultar detalle completo de un acta de arqueo' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arqueosService.findOne(id, user);
  }
}
