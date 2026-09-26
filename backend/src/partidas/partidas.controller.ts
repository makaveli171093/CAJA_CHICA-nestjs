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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PartidasService } from './partidas.service';
import { CreatePartidaDto, UpdatePartidaDto } from './dto/create-partida.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Clasificador de Partidas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar nueva partida presupuestaria (Solo Administrador)' })
  @ApiResponse({ status: 201, description: 'Partida registrada con éxito.' })
  create(
    @Body() createDto: CreatePartidaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.partidasService.create(createDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar partidas presupuestarias con búsqueda y paginación' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activo') activo?: string,
    @Query('unidadId') unidadId?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const isActivo = activo === undefined ? undefined : activo === 'true';
    return this.partidasService.findAll({ page, limit, search, activo: isActivo, unidadId, currentUser });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una partida' })
  findOne(@Param('id') id: string) {
    return this.partidasService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar descripción o estado de la partida' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePartidaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.partidasService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Desactivar partida presupuestaria (Soft Delete)' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.partidasService.deactivate(id, currentUser);
  }
}
