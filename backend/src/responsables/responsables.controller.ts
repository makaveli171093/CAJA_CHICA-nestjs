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
import { CurrentUser, AuthenticatedUser } from '../common/decorators';

@ApiTags('Responsables de Caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('responsables')
export class ResponsablesController {
  constructor(private readonly responsablesService: ResponsablesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo responsable de caja institucional' })
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
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const isActivo = activo === undefined ? undefined : activo === 'true';
    return this.responsablesService.findAll({
      unidadId,
      page,
      limit,
      search,
      activo: isActivo,
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
  @ApiOperation({ summary: 'Actualizar información del responsable' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateResponsableDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar responsable de caja (Soft Delete)' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.responsablesService.deactivate(id, currentUser);
  }
}
