import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUnitsDto } from './dto/assign-units.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Usuarios del Sistema')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario institucional (Solo Administrador)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios del sistema con paginación y búsqueda' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('rol') rol?: RolUsuario,
    @Query('activo') activo?: string,
  ) {
    const isActivo = activo === undefined ? undefined : activo === 'true';
    return this.usersService.findAll({ page, limit, search, rol, activo: isActivo });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener información de un usuario' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos o estado de un usuario' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Post(':id/unidades')
  @ApiOperation({ summary: 'Asignar unidades institucionales a un usuario' })
  assignUnits(
    @Param('id') id: string,
    @Body() assignUnitsDto: AssignUnitsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.assignUnits(id, assignUnitsDto, currentUser);
  }
}
