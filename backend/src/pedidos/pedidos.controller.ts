import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { CorregirPedidoDto } from './dto/corregir-pedido.dto';
import { CancelarPedidoDto } from './dto/cancelar-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { EntregarPedidoDto } from './dto/entregar-pedido.dto';
import { JwtAuthGuard, RolesGuard, UnitAccessGuard } from '../common/guards';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';

@ApiTags('pedidos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, UnitAccessGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar nuevo pedido en estado BORRADOR',
    description:
      'Registra un pedido autorizado externamente. No afecta efectivo ni presupuesto mientras se mantenga en borrador.',
  })
  @ApiResponse({ status: 201, description: 'Pedido en borrador creado exitosamente.' })
  async create(
    @Body() createDto: CreatePedidoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.create(createDto, currentUser);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pedidos de caja chica con filtros por unidad, gestión y estado',
  })
  async findAll(
    @Query() query: QueryPedidosDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle completo de un pedido de caja chica' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modificar datos de un pedido en estado BORRADOR',
    description: 'Solo se pueden editar pedidos que no hayan sido entregados ni cancelados.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePedidoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.update(id, updateDto, currentUser);
  }

  @Patch(':id/corregir-datos')
  @ApiOperation({
    summary: 'Corregir datos informativos de un pedido con justificación formal obligatoria',
    description:
      'Permite corregir datos de solicitante, receptor, descripción, etc., tanto en borrador como entregado. Exige justificación registrada en auditoría.',
  })
  async corregirDatos(
    @Param('id') id: string,
    @Body() dto: CorregirPedidoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.corregirDatos(id, dto, currentUser);
  }

  @Post(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar un pedido en estado BORRADOR',
    description:
      'Cancela un pedido en borrador indicando motivo fundado. Los pedidos entregados con anticipo no se pueden cancelar.',
  })
  async cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarPedidoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.cancelar(id, dto, currentUser);
  }

  @Post(':id/entregar')
  @ApiOperation({
    summary: 'Registrar entrega de efectivo y generar Formulario 001 (Vale Provisional)',
    description:
      'Acción principal: Valida disponibilidad de efectivo y presupuesto, límite del 10%, registra egreso atómico, genera anticipo y vale 001 numerado.',
  })
  async entregar(
    @Param('id') id: string,
    @Body() dto: EntregarPedidoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.pedidosService.entregar(id, dto, currentUser);
  }

  @Get(':id/vale-pdf')
  @ApiOperation({
    summary: 'Descargar o visualizar el Formulario 001 oficial en formato PDF',
    description:
      'Genera el PDF del Vale Provisional de Caja Chica a partir de los datos inmutables archivados en la entrega. Reimprimir nunca duplica movimientos ni altera numeración.',
  })
  async getValePdf(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.pedidosService.getValePdfBuffer(id, currentUser);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).end(buffer);
  }
}
