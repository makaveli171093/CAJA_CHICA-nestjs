import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, EstadoCajaApertura, TipoMovimientoEfectivo, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAperturaDto, UpdateAperturaDto, CorregirAperturaDto } from './dto/create-apertura.dto';
import { AuthenticatedUser } from '../common/decorators';

@Injectable()
export class AperturaService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ADMINISTRADOR ||
      currentUser.rol === RolUsuario.FINANCIERO ||
      currentUser.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para operar en esta unidad.');
    }
  }

  async create(createDto: CreateAperturaDto, currentUser: AuthenticatedUser) {
    this.checkUnitPermission(createDto.unidadId, currentUser);

    // Verificar si ya existe apertura para esta unidad y gestión
    const existing = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId: createDto.unidadId,
          gestion: createDto.gestion,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un registro de apertura para la unidad seleccionada en la gestión ${createDto.gestion} (Estado: ${existing.estado}).`,
      );
    }

    // Verificar que el responsable exista, pertenezca a la unidad y tenga cuenta activa si está vinculada
    const responsable = await this.prisma.responsable.findUnique({
      where: { id: createDto.responsableId },
      include: { user: true },
    });

    if (!responsable || !responsable.activo || responsable.unidadId !== createDto.unidadId) {
      throw new BadRequestException(
        'El responsable seleccionado no pertenece a la unidad institucional o se encuentra inactivo.',
      );
    }

    if (responsable.user && !responsable.user.activo) {
      throw new BadRequestException(
        'La cuenta de usuario asociada a este responsable se encuentra desactivada.',
      );
    }

    const montoAutorizado = new Prisma.Decimal(createDto.montoAutorizado);
    const importeRecibido = new Prisma.Decimal(createDto.importeRecibido);

    const apertura = await this.prisma.cajaApertura.create({
      data: {
        unidadId: createDto.unidadId,
        gestion: createDto.gestion,
        responsableId: createDto.responsableId,
        montoAutorizado,
        importeRecibido,
        fechaApertura: new Date(createDto.fechaApertura),
        docAutorizacion: createDto.docAutorizacion.trim(),
        compIngreso: createDto.compIngreso.trim(),
        estado: EstadoCajaApertura.BORRADOR,
      },
      include: {
        unidad: true,
        responsable: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'REGISTRAR_APERTURA_BORRADOR',
      entidad: 'CajaApertura',
      entidadId: apertura.id,
      detalle: {
        unidadId: createDto.unidadId,
        gestion: createDto.gestion,
        montoAutorizado: createDto.montoAutorizado,
        importeRecibido: createDto.importeRecibido,
      },
    });

    return {
      ...apertura,
      montoAutorizado: apertura.montoAutorizado.toFixed(2),
      importeRecibido: apertura.importeRecibido.toFixed(2),
    };
  }

  async findByUnidadAndGestion(
    unidadId: string,
    gestion: number,
    currentUser: AuthenticatedUser,
  ) {
    this.checkUnitPermission(unidadId, currentUser);

    const apertura = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId,
          gestion: Number(gestion),
        },
      },
      include: {
        unidad: true,
        responsable: true,
        movimientos: {
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!apertura) {
      return null;
    }

    return {
      ...apertura,
      montoAutorizado: apertura.montoAutorizado.toFixed(2),
      importeRecibido: apertura.importeRecibido.toFixed(2),
      movimientos: apertura.movimientos.map((m) => ({
        ...m,
        monto: m.monto.toFixed(2),
      })),
    };
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const apertura = await this.prisma.cajaApertura.findUnique({
      where: { id },
      include: {
        unidad: true,
        responsable: true,
        movimientos: {
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!apertura) {
      throw new NotFoundException('Registro de apertura no encontrado.');
    }

    this.checkUnitPermission(apertura.unidadId, currentUser);

    return {
      ...apertura,
      montoAutorizado: apertura.montoAutorizado.toFixed(2),
      importeRecibido: apertura.importeRecibido.toFixed(2),
      movimientos: apertura.movimientos.map((m) => ({
        ...m,
        monto: m.monto.toFixed(2),
      })),
    };
  }

  async update(
    id: string,
    updateDto: UpdateAperturaDto,
    currentUser: AuthenticatedUser,
  ) {
    const apertura = await this.prisma.cajaApertura.findUnique({ where: { id } });
    if (!apertura) {
      throw new NotFoundException('Apertura no encontrada.');
    }

    this.checkUnitPermission(apertura.unidadId, currentUser);

    if (apertura.estado !== EstadoCajaApertura.BORRADOR) {
      throw new BadRequestException(
        'No se pueden modificar los datos de una apertura que ya ha sido confirmada y abierta.',
      );
    }

    const responsable = await this.prisma.responsable.findUnique({
      where: { id: updateDto.responsableId },
      include: { user: true },
    });
    if (!responsable || !responsable.activo || responsable.unidadId !== apertura.unidadId) {
      throw new BadRequestException('El responsable no pertenece a la unidad o está inactivo.');
    }
    if (responsable.user && !responsable.user.activo) {
      throw new BadRequestException('La cuenta de usuario asociada a este responsable se encuentra desactivada.');
    }

    const updated = await this.prisma.cajaApertura.update({
      where: { id },
      data: {
        responsableId: updateDto.responsableId,
        montoAutorizado: new Prisma.Decimal(updateDto.montoAutorizado),
        importeRecibido: new Prisma.Decimal(updateDto.importeRecibido),
        fechaApertura: new Date(updateDto.fechaApertura),
        docAutorizacion: updateDto.docAutorizacion.trim(),
        compIngreso: updateDto.compIngreso.trim(),
      },
      include: {
        unidad: true,
        responsable: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_APERTURA_BORRADOR',
      entidad: 'CajaApertura',
      entidadId: id,
      detalle: {
        montoAutorizado: updateDto.montoAutorizado,
        importeRecibido: updateDto.importeRecibido,
      },
    });

    return {
      ...updated,
      montoAutorizado: updated.montoAutorizado.toFixed(2),
      importeRecibido: updated.importeRecibido.toFixed(2),
    };
  }

  async corregirApertura(
    id: string,
    dto: CorregirAperturaDto,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR && currentUser.rol !== RolUsuario.FINANCIERO) {
      throw new ForbiddenException('Solo el rol ADMINISTRADOR o FINANCIERO puede corregir datos de una apertura.');
    }

    const apertura = await this.prisma.cajaApertura.findUnique({
      where: { id },
      include: {
        unidad: true,
        responsable: true,
      },
    });

    if (!apertura) {
      throw new NotFoundException('Registro de apertura no encontrado.');
    }

    this.checkUnitPermission(apertura.unidadId, currentUser);

    if (apertura.estado === EstadoCajaApertura.CERRADA) {
      throw new BadRequestException('No se pueden modificar datos de una gestión fiscal ya cerrada.');
    }

    const data: Prisma.CajaAperturaUpdateInput = {};
    const cambios: Record<string, { anterior: any; nuevo: any }> = {};

    if (dto.responsableId && dto.responsableId !== apertura.responsableId) {
      const responsable = await this.prisma.responsable.findUnique({
        where: { id: dto.responsableId },
        include: { user: true },
      });
      if (!responsable || !responsable.activo || responsable.unidadId !== apertura.unidadId) {
        throw new BadRequestException('El nuevo responsable seleccionado no pertenece a la unidad o está inactivo.');
      }
      if (responsable.user && !responsable.user.activo) {
        throw new BadRequestException('La cuenta de usuario del nuevo responsable está desactivada.');
      }
      data.responsable = { connect: { id: dto.responsableId } };
      cambios['responsable'] = {
        anterior: `${apertura.responsable.nombres} ${apertura.responsable.apellidos}`,
        nuevo: `${responsable.nombres} ${responsable.apellidos}`,
      };
    }

    if (dto.fechaApertura) {
      const nuevaFecha = new Date(dto.fechaApertura);
      if (nuevaFecha.toISOString().slice(0, 10) !== apertura.fechaApertura.toISOString().slice(0, 10)) {
        data.fechaApertura = nuevaFecha;
        cambios['fechaApertura'] = {
          anterior: apertura.fechaApertura.toISOString().slice(0, 10),
          nuevo: dto.fechaApertura,
        };
      }
    }

    if (dto.docAutorizacion && dto.docAutorizacion.trim() !== apertura.docAutorizacion) {
      const trimmed = dto.docAutorizacion.trim();
      data.docAutorizacion = trimmed;
      cambios['docAutorizacion'] = {
        anterior: apertura.docAutorizacion,
        nuevo: trimmed,
      };
    }

    if (dto.compIngreso && dto.compIngreso.trim() !== apertura.compIngreso) {
      const trimmed = dto.compIngreso.trim();
      data.compIngreso = trimmed;
      cambios['compIngreso'] = {
        anterior: apertura.compIngreso,
        nuevo: trimmed,
      };
    }

    if (Object.keys(cambios).length === 0) {
      return {
        message: 'No se detectaron modificaciones en los datos de apertura.',
        caja: {
          ...apertura,
          montoAutorizado: apertura.montoAutorizado.toFixed(2),
          importeRecibido: apertura.importeRecibido.toFixed(2),
        },
      };
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const cajaActualizada = await tx.cajaApertura.update({
        where: { id },
        data,
        include: {
          unidad: true,
          responsable: true,
          movimientos: true,
        },
      });

      // Si cambió el comprobante de ingreso o docAutorizacion, actualizar la descripción del movimiento inicial de apertura
      if (data.compIngreso || data.docAutorizacion) {
        await tx.movimientoEfectivo.updateMany({
          where: {
            cajaAperturaId: id,
            tipo: TipoMovimientoEfectivo.APERTURA,
          },
          data: {
            comprobanteReferencia: cajaActualizada.compIngreso,
            descripcion: `Fondo inicial recibido por apertura de caja chica (Gestión ${cajaActualizada.gestion}). Comprobante: ${cajaActualizada.compIngreso}. Autorización: ${cajaActualizada.docAutorizacion}`,
          },
        });
      }

      await tx.auditoria.create({
        data: {
          actorId: currentUser.id,
          actorUsername: currentUser.username,
          accion: 'CORREGIR_APERTURA_CONFIRMADA',
          entidad: 'CajaApertura',
          entidadId: id,
          detalleJson: JSON.stringify({
            unidad: cajaActualizada.unidad.codigo,
            gestion: cajaActualizada.gestion,
            justificacion: dto.justificacion.trim(),
            cambios,
          }),
        },
      });

      return cajaActualizada;
    });

    return {
      message: 'Datos de la apertura corregidos exitosamente y registrados en auditoría.',
      caja: {
        ...resultado,
        montoAutorizado: resultado.montoAutorizado.toFixed(2),
        importeRecibido: resultado.importeRecibido.toFixed(2),
      },
    };
  }

  async confirmarApertura(id: string, currentUser: AuthenticatedUser) {
    const aperturaPrevia = await this.prisma.cajaApertura.findUnique({
      where: { id },
      include: { unidad: true, responsable: true },
    });

    if (!aperturaPrevia) {
      throw new NotFoundException('Registro de apertura no encontrado.');
    }

    this.checkUnitPermission(aperturaPrevia.unidadId, currentUser);

    if (aperturaPrevia.estado !== EstadoCajaApertura.BORRADOR) {
      throw new ConflictException(
        `La apertura ya se encuentra en estado "${aperturaPrevia.estado}". No se permite confirmar nuevamente.`,
      );
    }

    // Ejecución en transacción atómica con control de concurrencia estricto
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Condición atómica: sólo actualiza si el estado actual en BD sigue siendo BORRADOR
      const updateResult = await tx.cajaApertura.updateMany({
        where: {
          id,
          estado: EstadoCajaApertura.BORRADOR,
        },
        data: {
          estado: EstadoCajaApertura.ABIERTA,
          fechaConfirmacion: new Date(),
          confirmadoPorId: currentUser.id,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Conflicto de concurrencia: La apertura fue confirmada por otra operación simultánea.',
        );
      }

      // 2. Crear una sola entrada de efectivo inicial asociada
      const movimiento = await tx.movimientoEfectivo.create({
        data: {
          cajaAperturaId: id,
          tipo: TipoMovimientoEfectivo.APERTURA,
          monto: aperturaPrevia.importeRecibido,
          descripcion: `Fondo inicial recibido por apertura de caja chica (Gestión ${aperturaPrevia.gestion}). Comprobante: ${aperturaPrevia.compIngreso}. Autorización: ${aperturaPrevia.docAutorizacion}`,
          comprobanteReferencia: aperturaPrevia.compIngreso,
          actorId: currentUser.id,
        },
      });

      // 3. Consultar estado final actualizado
      const cajaConfirmada = await tx.cajaApertura.findUnique({
        where: { id },
        include: {
          unidad: true,
          responsable: true,
          movimientos: true,
        },
      });

      return { cajaConfirmada, movimiento };
    });

    // Auditoría detallada de la confirmación
    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CONFIRMAR_APERTURA_CAJA',
      entidad: 'CajaApertura',
      entidadId: id,
      detalle: {
        unidadCodigo: aperturaPrevia.unidad.codigo,
        gestion: aperturaPrevia.gestion,
        montoAutorizado: aperturaPrevia.montoAutorizado.toFixed(2),
        importeRecibido: aperturaPrevia.importeRecibido.toFixed(2),
        movimientoEfectivoId: resultado.movimiento.id,
      },
    });

    return {
      message: 'Apertura de caja chica confirmada exitosamente. Se ha registrado la entrada única de efectivo.',
      caja: {
        ...resultado.cajaConfirmada,
        montoAutorizado: resultado.cajaConfirmada.montoAutorizado.toFixed(2),
        importeRecibido: resultado.cajaConfirmada.importeRecibido.toFixed(2),
        movimientos: resultado.cajaConfirmada.movimientos.map((m) => ({
          ...m,
          monto: m.monto.toFixed(2),
        })),
      },
    };
  }

  async cerrarCaja(
    id: string,
    dto: { compDeposito: string; observaciones?: string },
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR && currentUser.rol !== RolUsuario.FINANCIERO) {
      throw new ForbiddenException('Solo el administrador o financiero pueden cerrar la caja chica de una gestión.');
    }

    const caja = await this.prisma.cajaApertura.findUnique({
      where: { id },
      include: {
        unidad: true,
        anticipos: {
          where: { estado: 'PENDIENTE' },
        },
        movimientos: true,
      },
    });

    if (!caja) {
      throw new NotFoundException('Apertura no encontrada.');
    }

    if (caja.estado !== EstadoCajaApertura.ABIERTA) {
      throw new BadRequestException(`No se puede cerrar una caja que no esté ABIERTA (estado actual: ${caja.estado}).`);
    }

    if (caja.anticipos.length > 0) {
      throw new BadRequestException(
        `Existen ${caja.anticipos.length} anticipo(s) pendiente(s) de rendición. No se puede cerrar la caja hasta que todos los vales estén rendidos.`,
      );
    }

    // Calcular saldo remanente de efectivo
    let saldoEfectivo = new Prisma.Decimal(0);
    caja.movimientos.forEach((m) => {
      if (
        m.tipo === TipoMovimientoEfectivo.APERTURA ||
        m.tipo === TipoMovimientoEfectivo.REPOSICION ||
        m.tipo === TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE
      ) {
        saldoEfectivo = saldoEfectivo.plus(m.monto);
      } else {
        saldoEfectivo = saldoEfectivo.minus(m.monto);
      }
    });

    return this.prisma.$transaction(async (tx) => {
      if (saldoEfectivo.gt(0)) {
        await tx.movimientoEfectivo.create({
          data: {
            cajaAperturaId: caja.id,
            tipo: TipoMovimientoEfectivo.AJUSTE,
            monto: saldoEfectivo,
            descripcion: `Devolución y depósito de saldo final por Cierre de Gestión - Comp: ${dto.compDeposito.trim()}`,
            comprobanteReferencia: dto.compDeposito.trim(),
            actorId: currentUser.id,
          },
        });
      }

      const cajaCerrada = await tx.cajaApertura.update({
        where: { id },
        data: {
          estado: EstadoCajaApertura.CERRADA,
        },
        include: { unidad: true, responsable: true },
      });

      await this.auditService.log({
        actorId: currentUser.id,
        actorUsername: currentUser.username,
        accion: 'CIERRE_GESTION_CAJA',
        entidad: 'CajaApertura',
        entidadId: id,
        detalle: {
          unidad: caja.unidad.codigo,
          gestion: caja.gestion,
          saldoDevuelto: saldoEfectivo.toFixed(2),
          compDeposito: dto.compDeposito.trim(),
        },
      });

      return {
        message: 'Caja chica cerrada exitosamente. Gestión concluida.',
        caja: {
          ...cajaCerrada,
          montoAutorizado: cajaCerrada.montoAutorizado.toFixed(2),
          importeRecibido: cajaCerrada.importeRecibido.toFixed(2),
        },
      };
    });
  }
}
