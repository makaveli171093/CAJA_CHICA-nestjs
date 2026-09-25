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
import { UnitsService } from './units.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Unidades Institucionales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('unidades')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear una nueva unidad institucional (Solo Administrador)' })
  @ApiResponse({ status: 201, description: 'Unidad creada satisfactoriamente.' })
  create(
    @Body() createUnitDto: CreateUnitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.unitsService.create(createUnitDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar unidades institucionales autorizadas' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activo') activo?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const isActivo = activo === undefined ? undefined : activo === 'true';
    return this.unitsService.findAll({
      page,
      limit,
      search,
      activo: isActivo,
      currentUser,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una unidad' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.unitsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar unidad institucional (Solo Administrador)' })
  update(
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.unitsService.update(id, updateUnitDto, currentUser);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Desactivar unidad institucional (Soft Delete)' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.unitsService.deactivate(id, currentUser);
  }
}
