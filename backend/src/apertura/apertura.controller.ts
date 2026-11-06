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
import { AperturaService } from './apertura.service';
import { CreateAperturaDto, UpdateAperturaDto, CorregirAperturaDto } from './dto/create-apertura.dto';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { CurrentUser, AuthenticatedUser, Roles } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@ApiTags('Apertura de Caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('apertura')
export class AperturaController {
  constructor(private readonly aperturaService: AperturaService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nueva apertura de caja chica en estado borrador' })
  @ApiResponse({ status: 201, description: 'Apertura registrada en borrador con éxito.' })
  create(
    @Body() createDto: CreateAperturaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.create(createDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener apertura de caja por unidad y gestión' })
  findByUnidadAndGestion(
    @Query('unidadId') unidadId: string,
    @Query('gestion') gestion: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (!unidadId || !gestion) {
      throw new BadRequestException('Los parámetros unidadId y gestion son obligatorios.');
    }
    return this.aperturaService.findByUnidadAndGestion(
      unidadId,
      parseInt(gestion, 10),
      currentUser,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalle de una apertura por ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar datos de una apertura en estado borrador' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAperturaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.update(id, updateDto, currentUser);
  }

  @Patch(':id/corregir')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({
    summary: 'Corregir datos formales de una apertura (responsable, comprobante, etc.) con justificación obligatoria',
  })
  corregir(
    @Param('id') id: string,
    @Body() dto: CorregirAperturaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.corregirApertura(id, dto, currentUser);
  }

  @Post(':id/confirmar')
  @ApiOperation({ summary: 'Confirmar apertura de caja chica (Transacción atómica y entrada única de efectivo)' })
  @ApiResponse({ status: 200, description: 'Apertura confirmada y caja en estado ABIERTA.' })
  confirmarApertura(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.confirmarApertura(id, currentUser);
  }

  @Post(':id/cerrar')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.FINANCIERO)
  @ApiOperation({ summary: 'Cerrar caja chica y liquidar gestión fiscal con depósito bancario de saldo remanente' })
  @ApiResponse({ status: 200, description: 'Caja chica cerrada exitosamente.' })
  cerrarCaja(
    @Param('id') id: string,
    @Body() dto: { compDeposito: string; observaciones?: string },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aperturaService.cerrarCaja(id, dto, currentUser);
  }
}
