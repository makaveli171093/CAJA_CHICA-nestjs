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
import { ResponsablesService } from './responsables.service';
import { CreateResponsableDto, UpdateResponsableDto } from './dto/create-responsable.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Responsables de Caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('responsables')
export class ResponsablesController {
  constructor(private readonly responsablesService: ResponsablesService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar nuevo responsable de caja institucional (Solo Administrador)' })
  @ApiResponse({ status: 201, description: 'Responsable registrado exitosamente.' })
  create(
    @Body() createDto: CreateResponsableDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.create(createDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar responsables de caja con filtros y paginación' })
  findAll(
    @Query('unidadId') unidadId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activo') activo?: string,
    @Query('desvinculados') desvinculados?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const isActivo = activo === undefined ? undefined : activo === 'true';
    return this.responsablesService.findAll({
      unidadId,
      page,
      limit,
      search,
      activo: isActivo,
      desvinculados: desvinculados === 'true',
      currentUser,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de un responsable' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar información del responsable (Solo Administrador)' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateResponsableDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Desactivar responsable de caja (Soft Delete - Solo Administrador)' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.deactivate(id, currentUser);
  }
}
