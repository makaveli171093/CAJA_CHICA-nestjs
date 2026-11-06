import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  EstadoPedido,
  EstadoAnticipo,
  EstadoCajaApertura,
  TipoMovimientoEfectivo,
  RolUsuario,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { CancelarPedidoDto } from './dto/cancelar-pedido.dto';
import { CorregirPedidoDto } from './dto/corregir-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { EntregarPedidoDto } from './dto/entregar-pedido.dto';
import { ValePdfService, DatosVale001 } from './services/vale-pdf.service';
import { montoEnBolivianosLiteral } from '../common/utils/numero-a-letras';
import { calcularDisponibilidadPresupuesto } from '../common/utils/presupuesto-calculo';
import {
  getFechaHoyBolivia,
  formatDateOnly,
  parseDateOnlyToUtc,
  formatearFechaLegibleBolivia,
} from '../common/utils/date-utils';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private valePdfService: ValePdfService,
  ) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ADMINISTRADOR ||
      currentUser.rol === RolUsuario.FINANCIERO ||
      currentUser.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!currentUser.unidades || !currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException(
        'Acceso denegado: No cuenta con autorización para operar en esta unidad institucional.',
      );
    }
  }

  private formatearFechaLegible(fecha: Date): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();
    return `${dia} de ${mes} de ${anio}`;
  }

  async create(dto: CreatePedidoDto, currentUser: AuthenticatedUser) {
    this.checkUnitPermission(dto.unidadId, currentUser);

    const [unit, caja, partida] = await Promise.all([
      this.prisma.unit.findUnique({ where: { id: dto.unidadId } }),
      this.prisma.cajaApertura.findUnique({
        where: { id: dto.cajaAperturaId },
        include: { responsable: true },
      }),
      this.prisma.partida.findUnique({ where: { id: dto.partidaId } }),
    ]);

    if (!unit || !unit.activo) {
      throw new NotFoundException('Unidad institucional no encontrada o inactiva.');
    }
    if (!caja) {
      throw new NotFoundException('Caja de apertura no encontrada.');
    }
    if (caja.unidadId !== dto.unidadId || caja.gestion !== dto.gestion) {
      throw new BadRequestException('La caja de apertura no corresponde a la unidad y gestión indicadas.');
    }
    if (caja.estado !== EstadoCajaApertura.ABIERTA) {
      throw new BadRequestException(
        `La caja chica no se encuentra ABIERTA (estado actual: ${caja.estado}). No se pueden registrar pedidos.`,
      );
    }
    if (!partida || !partida.activo) {
      throw new BadRequestException('La partida presupuestaria no existe o se encuentra inactiva.');
    }

    // Validar partida habilitada para la unidad
    const partidaHabilitada = await this.prisma.unidadPartida.findUnique({
      where: {
        unidadId_partidaId: {
          unidadId: dto.unidadId,
          partidaId: dto.partidaId,
        },
      },
    });

    if (!partidaHabilitada || !partidaHabilitada.activo) {
      throw new BadRequestException(
        `La partida ${partida.codigo} no está habilitada para esta unidad. Habilítela antes de registrar pedidos.`,
      );
    }

    // Validar existencia de presupuesto en la gestión
    const presupuesto = await this.prisma.presupuestoPartida.findUnique({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: dto.unidadId,
          gestion: dto.gestion,
          partidaId: dto.partidaId,
        },
      },
    });

    if (!presupuesto || !presupuesto.activo) {
      throw new BadRequestException(
        `No existe presupuesto asignado para la partida ${partida.codigo} en la gestión ${dto.gestion}.`,
      );
    }

    // Validar coherencia de fechas
    const fechaSolStr = formatDateOnly(dto.fechaSolicitud);
    const anioSol = parseInt(fechaSolStr.split('-')[0], 10);
    if (anioSol !== dto.gestion) {
      throw new BadRequestException('El año de la fecha de solicitud no coincide con la gestión fiscal.');
    }
    const fechaAperturaStr = formatDateOnly(caja.fechaApertura);
    if (fechaSolStr < fechaAperturaStr) {
      throw new BadRequestException('La fecha de solicitud no puede ser anterior a la fecha de apertura de caja.');
    }
    const fechaSol = parseDateOnlyToUtc(fechaSolStr);

    const montoDec = new Decimal(dto.monto);
    if (!montoDec.isPositive() || montoDec.isZero()) {
      throw new BadRequestException('El monto debe ser un valor positivo mayor a cero.');
    }

    const pedido = await this.prisma.pedido.create({
      data: {
        unidadId: dto.unidadId,
        gestion: dto.gestion,
        cajaAperturaId: dto.cajaAperturaId,
        partidaId: dto.partidaId,
        numeroPedido: dto.numeroPedido.trim(),
        fechaSolicitud: fechaSol,
        lugar: (dto.lugar && dto.lugar.trim()) || 'La Paz',
        solicitanteNombres: dto.solicitanteNombres.trim(),
        solicitanteApellidos: dto.solicitanteApellidos.trim(),
        solicitanteCi: dto.solicitanteCi.trim(),
        solicitanteArea: dto.solicitanteArea.trim(),
        descripcion: dto.descripcion.trim(),
        motivo: dto.motivo.trim(),
        receptorNombres: dto.receptorNombres.trim(),
        receptorApellidos: dto.receptorApellidos.trim(),
        receptorCi: dto.receptorCi.trim(),
        monto: new Prisma.Decimal(montoDec.toFixed(2)),
        referenciaRepMat: dto.referenciaRepMat?.trim() || null,
        observaciones: dto.observaciones?.trim() || null,
        estado: EstadoPedido.BORRADOR,
        registradoPorId: currentUser.id,
      },
      include: {
        unidad: true,
        partida: true,
        cajaApertura: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_PEDIDO_BORRADOR',
      entidad: 'Pedido',
      entidadId: pedido.id,
      detalle: {
        numeroPedido: pedido.numeroPedido,
        unidadId: pedido.unidadId,
        gestion: pedido.gestion,
        partidaCodigo: partida.codigo,
        monto: montoDec.toFixed(2),
        solicitante: `${pedido.solicitanteNombres} ${pedido.solicitanteApellidos}`,
      },
    });

    return {
      ...pedido,
      monto: pedido.monto.toFixed(2),
    };
  }

  async findAll(query: QueryPedidosDto, currentUser: AuthenticatedUser) {
    if (query.unidadId) {
      this.checkUnitPermission(query.unidadId, currentUser);
    }

    const where: Prisma.PedidoWhereInput = {};

    const isGlobalRole =
      currentUser.rol === RolUsuario.ADMINISTRADOR ||
      currentUser.rol === RolUsuario.FINANCIERO ||
      currentUser.rol === RolUsuario.GERENCIA;

    if (query.unidadId) {
      where.unidadId = query.unidadId;
    } else if (!isGlobalRole) {
      where.unidadId = { in: currentUser.unidades };
    }

    if (query.gestion) {
      where.gestion = Number(query.gestion);
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.fechaDesde || query.fechaHasta) {
      where.fechaSolicitud = {};
      if (query.fechaDesde) {
        where.fechaSolicitud.gte = new Date(`${query.fechaDesde}T00:00:00Z`);
      }
      if (query.fechaHasta) {
        where.fechaSolicitud.lte = new Date(`${query.fechaHasta}T23:59:59Z`);
      }
    }

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: {
        unidad: {
          select: { id: true, codigo: true, nombre: true },
        },
        partida: {
          select: { id: true, codigo: true, descripcion: true },
        },
        registradoPor: {
          select: { id: true, username: true, nombreCompleto: true },
        },
        anticipo: {
          include: {
            entregadoPor: {
              select: { id: true, username: true, nombreCompleto: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return pedidos.map((p) => {
      let tiempoRendicion: {
        horasTranscurridas: number;
        minutosTranscurridos: number;
        plazoReferencialHoras: number;
      } | null = null;

      if (p.anticipo?.fechaEntrega) {
        const entrega = new Date(p.anticipo.fechaEntrega);
        const diffMs = Math.max(0, now.getTime() - entrega.getTime());
        const totalMinutos = Math.floor(diffMs / (1000 * 60));
        tiempoRendicion = {
          horasTranscurridas: Math.floor(totalMinutos / 60),
          minutosTranscurridos: totalMinutos % 60,
          plazoReferencialHoras: 48,
        };
      }

      return {
        ...p,
        monto: p.monto.toFixed(2),
        anticipo: p.anticipo
          ? {
              ...p.anticipo,
              monto: p.anticipo.monto.toFixed(2),
            }
          : null,
        tiempoRendicion,
      };
    });
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        unidad: true,
        partida: true,
        cajaApertura: {
          include: { responsable: true },
        },
        registradoPor: {
          select: { id: true, username: true, nombreCompleto: true },
        },
        anticipo: {
          include: {
            entregadoPor: {
              select: { id: true, username: true, nombreCompleto: true },
            },
          },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido de caja chica no encontrado.');
    }

    this.checkUnitPermission(pedido.unidadId, currentUser);

    const now = new Date();
    let tiempoRendicion: {
      horasTranscurridas: number;
      minutosTranscurridos: number;
      plazoReferencialHoras: number;
    } | null = null;

    if (pedido.anticipo?.fechaEntrega) {
      const entrega = new Date(pedido.anticipo.fechaEntrega);
      const diffMs = Math.max(0, now.getTime() - entrega.getTime());
      const totalMinutos = Math.floor(diffMs / (1000 * 60));
      tiempoRendicion = {
        horasTranscurridas: Math.floor(totalMinutos / 60),
        minutosTranscurridos: totalMinutos % 60,
        plazoReferencialHoras: 48,
      };
    }

    return {
      ...pedido,
      monto: pedido.monto.toFixed(2),
      anticipo: pedido.anticipo
        ? {
            ...pedido.anticipo,
            monto: pedido.anticipo.monto.toFixed(2),
          }
        : null,
      tiempoRendicion,
    };
  }

  async update(id: string, dto: UpdatePedidoDto, currentUser: AuthenticatedUser) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { cajaApertura: true },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    this.checkUnitPermission(pedido.unidadId, currentUser);

    if (pedido.estado !== EstadoPedido.BORRADOR) {
      throw new BadRequestException(
        `Solo se pueden editar pedidos en estado BORRADOR (estado actual: ${pedido.estado}).`,
      );
    }

    const data: Prisma.PedidoUpdateInput = {};

    if (dto.partidaId && dto.partidaId !== pedido.partidaId) {
      const partida = await this.prisma.partida.findUnique({ where: { id: dto.partidaId } });
      if (!partida || !partida.activo) {
        throw new BadRequestException('La partida presupuestaria no existe o está inactiva.');
      }
      const habilitada = await this.prisma.unidadPartida.findUnique({
        where: {
          unidadId_partidaId: {
            unidadId: pedido.unidadId,
            partidaId: dto.partidaId,
          },
        },
      });
      if (!habilitada || !habilitada.activo) {
        throw new BadRequestException(`La partida ${partida.codigo} no está habilitada para esta unidad.`);
      }
      const presupuesto = await this.prisma.presupuestoPartida.findUnique({
        where: {
          unidadId_gestion_partidaId: {
            unidadId: pedido.unidadId,
            gestion: pedido.gestion,
            partidaId: dto.partidaId,
          },
        },
      });
      if (!presupuesto || !presupuesto.activo) {
        throw new BadRequestException(`No hay presupuesto asignado para la partida ${partida.codigo}.`);
      }
      data.partida = { connect: { id: dto.partidaId } };
    }

    if (dto.numeroPedido !== undefined) data.numeroPedido = dto.numeroPedido.trim();
    if (dto.fechaSolicitud !== undefined) {
      const fechaSolStr = formatDateOnly(dto.fechaSolicitud);
      const anioSol = parseInt(fechaSolStr.split('-')[0], 10);
      if (anioSol !== pedido.gestion) {
        throw new BadRequestException('El año de la fecha de solicitud no coincide con la gestión fiscal.');
      }
      if (pedido.cajaApertura) {
        const fechaAperturaStr = formatDateOnly(pedido.cajaApertura.fechaApertura);
        if (fechaSolStr < fechaAperturaStr) {
          throw new BadRequestException('La fecha de solicitud no puede ser anterior a la fecha de apertura de caja.');
        }
      }
      data.fechaSolicitud = parseDateOnlyToUtc(fechaSolStr);
    }
    if (dto.lugar !== undefined) data.lugar = dto.lugar.trim();
    if (dto.solicitanteNombres !== undefined) data.solicitanteNombres = dto.solicitanteNombres.trim();
    if (dto.solicitanteApellidos !== undefined) data.solicitanteApellidos = dto.solicitanteApellidos.trim();
    if (dto.solicitanteCi !== undefined) data.solicitanteCi = dto.solicitanteCi.trim();
    if (dto.solicitanteArea !== undefined) data.solicitanteArea = dto.solicitanteArea.trim();
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion.trim();
    if (dto.motivo !== undefined) data.motivo = dto.motivo.trim();
    if (dto.receptorNombres !== undefined) data.receptorNombres = dto.receptorNombres.trim();
    if (dto.receptorApellidos !== undefined) data.receptorApellidos = dto.receptorApellidos.trim();
    if (dto.receptorCi !== undefined) data.receptorCi = dto.receptorCi.trim();
    if (dto.referenciaRepMat !== undefined) data.referenciaRepMat = dto.referenciaRepMat.trim() || null;
    if (dto.observaciones !== undefined) data.observaciones = dto.observaciones.trim() || null;

    if (dto.monto !== undefined) {
      const montoDec = new Decimal(dto.monto);
      if (!montoDec.isPositive() || montoDec.isZero()) {
        throw new BadRequestException('El monto debe ser positivo y mayor a cero.');
      }
      data.monto = new Prisma.Decimal(montoDec.toFixed(2));
    }

    const updated = await this.prisma.pedido.update({
      where: { id },
      data,
      include: {
        unidad: true,
        partida: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'EDITAR_PEDIDO_BORRADOR',
      entidad: 'Pedido',
      entidadId: id,
      detalle: dto,
    });

    return {
      ...updated,
      monto: updated.monto.toFixed(2),
    };
  }

  async cancelar(id: string, dto: CancelarPedidoDto, currentUser: AuthenticatedUser) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    this.checkUnitPermission(pedido.unidadId, currentUser);

    if (pedido.estado === EstadoPedido.CANCELADO) {
      throw new ConflictException('El pedido ya se encuentra cancelado.');
    }

    if (pedido.estado !== EstadoPedido.BORRADOR) {
      throw new BadRequestException(
        `Los pedidos en estado ${pedido.estado} con anticipo entregado no se pueden cancelar ni anular ficticiamente.`,
      );
    }

    const updated = await this.prisma.pedido.update({
      where: { id },
      data: {
        estado: EstadoPedido.CANCELADO,
        motivoCancelacion: dto.motivoCancelacion.trim(),
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CANCELAR_PEDIDO_BORRADOR',
      entidad: 'Pedido',
      entidadId: id,
      detalle: {
        motivoCancelacion: dto.motivoCancelacion,
      },
    });

    return {
      message: 'Pedido cancelado correctamente.',
      pedido: {
        ...updated,
        monto: updated.monto.toFixed(2),
      },
    };
  }

  async corregirDatos(id: string, dto: CorregirPedidoDto, currentUser: AuthenticatedUser) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        anticipo: true,
        unidad: true,
        partida: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    this.checkUnitPermission(pedido.unidadId, currentUser);

    if (pedido.estado === EstadoPedido.CANCELADO) {
      throw new BadRequestException('No se pueden corregir datos de un pedido cancelado.');
    }

    const data: Prisma.PedidoUpdateInput = {};
    const cambios: Record<string, { anterior: any; nuevo: any }> = {};

    const checkAndSet = (campo: string, nuevoValor: string | undefined | null, valorActual: string | null) => {
      if (nuevoValor !== undefined && nuevoValor !== null) {
        const trimmed = nuevoValor.trim();
        if (trimmed !== (valorActual || '')) {
          (data as any)[campo] = trimmed;
          cambios[campo] = { anterior: valorActual, nuevo: trimmed };
        }
      }
    };

    checkAndSet('solicitanteNombres', dto.solicitanteNombres, pedido.solicitanteNombres);
    checkAndSet('solicitanteApellidos', dto.solicitanteApellidos, pedido.solicitanteApellidos);
    checkAndSet('solicitanteCi', dto.solicitanteCi, pedido.solicitanteCi);
    checkAndSet('solicitanteArea', dto.solicitanteArea, pedido.solicitanteArea);
    checkAndSet('receptorNombres', dto.receptorNombres, pedido.receptorNombres);
    checkAndSet('receptorApellidos', dto.receptorApellidos, pedido.receptorApellidos);
    checkAndSet('receptorCi', dto.receptorCi, pedido.receptorCi);
    checkAndSet('lugar', dto.lugar, pedido.lugar);
    checkAndSet('descripcion', dto.descripcion, pedido.descripcion);
    checkAndSet('motivo', dto.motivo, pedido.motivo);
    checkAndSet('referenciaRepMat', dto.referenciaRepMat, pedido.referenciaRepMat);
    checkAndSet('observaciones', dto.observaciones, pedido.observaciones);

    // 0. Modificación de Partida Presupuestaria (Fase de Pruebas: habilitado para Admin y Encargado)
    let nuevaPartida: any = null;
    if (dto.partidaId && dto.partidaId.trim() !== '' && dto.partidaId !== pedido.partidaId) {
      nuevaPartida = await this.prisma.partida.findUnique({
        where: { id: dto.partidaId },
      });
      if (!nuevaPartida) {
        throw new NotFoundException('La partida presupuestaria seleccionada no existe.');
      }
      const habilitada = await this.prisma.unidadPartida.findUnique({
        where: {
          unidadId_partidaId: {
            unidadId: pedido.unidadId,
            partidaId: dto.partidaId,
          },
        },
      });
      if (!habilitada || !habilitada.activo) {
        throw new BadRequestException(
          `La partida presupuestaria ${nuevaPartida.codigo} no está habilitada para esta unidad.`,
        );
      }
      data.partida = { connect: { id: dto.partidaId } };
      cambios['partidaId'] = {
        anterior: `${pedido.partida.codigo} - ${pedido.partida.descripcion}`,
        nuevo: `${nuevaPartida.codigo} - ${nuevaPartida.descripcion}`,
      };
    }

    // 1. Modificación de Monto (Fase de Pruebas: habilitado para Admin y Encargado)
    let nuevoMontoDec: Decimal | null = null;
    if (dto.monto !== undefined && dto.monto !== null && dto.monto.toString().trim() !== '') {
      const parsedMonto = new Decimal(dto.monto.toString().trim());
      if (!parsedMonto.isPositive() || parsedMonto.isZero()) {
        throw new BadRequestException('El monto debe ser un valor positivo mayor a cero.');
      }
      const montoActual = new Decimal(pedido.monto.toString());
      if (!parsedMonto.equals(montoActual)) {
        nuevoMontoDec = parsedMonto;
        data.monto = new Prisma.Decimal(parsedMonto.toFixed(2));
        cambios['monto'] = { anterior: montoActual.toFixed(2), nuevo: parsedMonto.toFixed(2) };
      }
    }

    // 2. Modificación de Fecha de Solicitud (Fase de Pruebas)
    if (dto.fechaSolicitud !== undefined && dto.fechaSolicitud !== null && dto.fechaSolicitud.trim()) {
      const fechaSolStr = formatDateOnly(dto.fechaSolicitud);
      const fechaActualStr = formatDateOnly(pedido.fechaSolicitud);
      if (fechaSolStr !== fechaActualStr) {
        data.fechaSolicitud = parseDateOnlyToUtc(fechaSolStr);
        cambios['fechaSolicitud'] = { anterior: fechaActualStr, nuevo: fechaSolStr };
      }
    }

    // 3. Modificación de Fecha de Entrega de Anticipo (Fase de Pruebas)
    let nuevaFechaEntregaDate: Date | null = null;
    if (pedido.anticipo && dto.fechaEntrega !== undefined && dto.fechaEntrega !== null && dto.fechaEntrega.trim()) {
      const entregaStr = dto.fechaEntrega.trim();
      const parsedEntrega = new Date(entregaStr.includes('T') ? entregaStr : `${entregaStr}T12:00:00-04:00`);
      const entregaActualIso = pedido.anticipo.fechaEntrega.toISOString();
      if (parsedEntrega.toISOString() !== entregaActualIso) {
        nuevaFechaEntregaDate = parsedEntrega;
        cambios['fechaEntrega'] = { anterior: entregaActualIso, nuevo: parsedEntrega.toISOString() };
      }
    }

    if (Object.keys(cambios).length === 0) {
      return {
        message: 'No se detectaron modificaciones en los datos del pedido.',
        pedido: {
          ...pedido,
          monto: pedido.monto.toFixed(2),
        },
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const pedActualizado = await tx.pedido.update({
        where: { id },
        data,
        include: {
          unidad: true,
          partida: true,
          anticipo: true,
        },
      });

      // Sincronizar anticipo, movimiento de efectivo y snapshot datosValeJson
      if (pedido.anticipo) {
        if (nuevoMontoDec || nuevaFechaEntregaDate) {
          await tx.anticipo.update({
            where: { id: pedido.anticipo.id },
            data: {
              ...(nuevoMontoDec ? { monto: new Prisma.Decimal(nuevoMontoDec.toFixed(2)) } : {}),
              ...(nuevaFechaEntregaDate ? { fechaEntrega: nuevaFechaEntregaDate } : {}),
            },
          });
        }

        if (nuevoMontoDec || nuevaFechaEntregaDate || nuevaPartida) {
          // Actualizar MovimientoEfectivo vinculado de egreso
          await tx.movimientoEfectivo.updateMany({
            where: { anticipoId: pedido.anticipo.id },
            data: {
              ...(nuevoMontoDec ? { monto: new Prisma.Decimal(nuevoMontoDec.negated().toFixed(2)) } : {}),
              ...(nuevaFechaEntregaDate ? { fecha: nuevaFechaEntregaDate } : {}),
              ...(nuevaPartida ? {
                descripcion: `Entrega de anticipo ${pedido.anticipo.numeroVale} a ${pedActualizado.receptorNombres} ${pedActualizado.receptorApellidos} (CI: ${pedActualizado.receptorCi}) para partida ${nuevaPartida.codigo}. Solicitud: ${pedActualizado.numeroPedido}`,
              } : {}),
            },
          });
        }

        // Actualizar snapshot para que reimpresiones o descargas reflejen datos y montos corregidos
        if (pedido.anticipo.datosValeJson) {
          try {
            const datosVale: DatosVale001 = JSON.parse(pedido.anticipo.datosValeJson);
            if (nuevaPartida) {
              datosVale.partidaCodigo = nuevaPartida.codigo;
              datosVale.partidaDescripcion = nuevaPartida.descripcion;
            }
            if (nuevoMontoDec) {
              datosVale.monto = nuevoMontoDec.toFixed(2);
              datosVale.montoLiteral = montoEnBolivianosLiteral(nuevoMontoDec);
            }
            if (nuevaFechaEntregaDate) {
              const fStr = formatDateOnly(nuevaFechaEntregaDate);
              datosVale.fechaEmision = formatearFechaLegibleBolivia(fStr);
              datosVale.fechaEntrega = nuevaFechaEntregaDate.toISOString();
            }
            if (data.solicitanteNombres || data.solicitanteApellidos) {
              datosVale.solicitante.nombres = pedActualizado.solicitanteNombres;
              datosVale.solicitante.apellidos = pedActualizado.solicitanteApellidos;
            }
            if (data.solicitanteCi) datosVale.solicitante.ci = pedActualizado.solicitanteCi;
            if (data.solicitanteArea) datosVale.solicitante.area = pedActualizado.solicitanteArea;
            if (data.receptorNombres || data.receptorApellidos) {
              datosVale.receptor.nombres = pedActualizado.receptorNombres;
              datosVale.receptor.apellidos = pedActualizado.receptorApellidos;
            }
            if (data.receptorCi) datosVale.receptor.ci = pedActualizado.receptorCi;
            if (data.lugar) datosVale.lugar = pedActualizado.lugar;
            if (data.descripcion) datosVale.descripcion = pedActualizado.descripcion;
            if (data.motivo) datosVale.motivo = pedActualizado.motivo;
            if (data.referenciaRepMat !== undefined) datosVale.referenciaRepMat = pedActualizado.referenciaRepMat;
            if (data.observaciones !== undefined) datosVale.observaciones = pedActualizado.observaciones;

            await tx.anticipo.update({
              where: { id: pedido.anticipo.id },
              data: { datosValeJson: JSON.stringify(datosVale) },
            });
          } catch (e) {
            this.logger.warn(`No se pudo sincronizar datosValeJson al corregir pedido ${id}: ${e}`);
          }
        }
      }

      await tx.auditoria.create({
        data: {
          actorId: currentUser.id,
          actorUsername: currentUser.username,
          accion: 'CORREGIR_DATOS_PEDIDO',
          entidad: 'Pedido',
          entidadId: id,
          detalleJson: JSON.stringify({
            numeroPedido: pedido.numeroPedido,
            estado: pedido.estado,
            justificacion: dto.justificacion.trim(),
            cambios,
          }),
        },
      });

      return pedActualizado;
    });

    return {
      message: 'Datos del pedido corregidos exitosamente y registrados en auditoría.',
      pedido: {
        ...updated,
        monto: updated.monto.toFixed(2),
      },
    };
  }

  /**
   * Acción principal: "Registrar entrega y generar vale 001"
   * Registra atómicamente la entrega del efectivo, genera el anticipo y habilita el Formulario 001
   */
  async entregar(
    id: string,
    dtoOrUser: EntregarPedidoDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ) {
    let dto: EntregarPedidoDto | undefined;
    let currentUser: AuthenticatedUser;

    if (maybeUser) {
      dto = dtoOrUser as EntregarPedidoDto;
      currentUser = maybeUser;
    } else {
      dto = undefined;
      currentUser = dtoOrUser as AuthenticatedUser;
    }
    const userDb = await this.prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!userDb || !userDb.activo) {
      throw new ForbiddenException('Usuario inactivo o no autorizado.');
    }

    const pedidoPre = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        cajaApertura: { include: { responsable: true } },
        partida: true,
        unidad: true,
      },
    });

    if (!pedidoPre) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    this.checkUnitPermission(pedidoPre.unidadId, currentUser);

    if (pedidoPre.estado !== EstadoPedido.BORRADOR) {
      throw new ConflictException(
        `El pedido ya no se encuentra en estado BORRADOR (estado actual: "${pedidoPre.estado}").`,
      );
    }

    // Transacción ACID integral con bloqueo estricto de concurrencia
    let resultado: any;
    try {
      resultado = await this.prisma.$transaction(
        async (tx) => {
          // 1. Bloqueo de fila para evitar entregas o sobregiros concurrentes
          await tx.$queryRaw`
            SELECT id FROM "cajas_apertura" WHERE id = ${pedidoPre.cajaAperturaId} FOR UPDATE
          `;
          await tx.$queryRaw`
            SELECT id FROM "presupuestos_partidas"
            WHERE "unidadId" = ${pedidoPre.unidadId}
              AND "gestion" = ${pedidoPre.gestion}
              AND "partidaId" = ${pedidoPre.partidaId}
            FOR UPDATE
          `;

          // 2. Control de estado con updateMany atómico
          const updateResult = await tx.pedido.updateMany({
            where: {
              id,
              estado: EstadoPedido.BORRADOR,
            },
            data: {
              estado: EstadoPedido.ENTREGADO,
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictException(
              'Conflicto de concurrencia: El pedido ya fue procesado por otra operación simultánea.',
            );
          }

          // 3. Re-validación del estado de la caja de apertura
          const caja = await tx.cajaApertura.findUnique({
            where: { id: pedidoPre.cajaAperturaId },
            include: { responsable: true, unidad: true },
          });

          if (!caja || caja.estado !== EstadoCajaApertura.ABIERTA) {
            throw new BadRequestException('La caja chica debe estar ABIERTA para registrar la entrega de fondos.');
          }

          if (!caja.responsable || !caja.responsable.activo) {
            throw new BadRequestException('El encargado custodio de la caja chica no cuenta con designación activa.');
          }

          // 4. Validar que la partida siga habilitada para la unidad
          const habilitada = await tx.unidadPartida.findUnique({
            where: {
              unidadId_partidaId: {
                unidadId: pedidoPre.unidadId,
                partidaId: pedidoPre.partidaId,
              },
            },
          });

          if (!habilitada || !habilitada.activo) {
            throw new BadRequestException('La partida presupuestaria se encuentra deshabilitada para esta unidad.');
          }

          const montoPedido = new Decimal(pedidoPre.monto.toString());

          // 5. Validar límite ordinario CPS del 10% del presupuesto total asignado por partidas (POA)
          const totalPresupuestoRes = await tx.presupuestoPartida.aggregate({
            where: {
              unidadId: pedidoPre.unidadId,
              gestion: pedidoPre.gestion,
              activo: true,
            },
            _sum: { montoAsignado: true },
          });

          const totalPresupuesto = totalPresupuestoRes._sum.montoAsignado
            ? new Decimal(totalPresupuestoRes._sum.montoAsignado.toString())
            : new Decimal('0.00');

          const baseLimite = totalPresupuesto.greaterThan(0)
            ? totalPresupuesto
            : new Decimal(caja.montoAutorizado.toString());

          const limite10Pct = baseLimite.times(0.10);

          if (montoPedido.greaterThan(limite10Pct)) {
            throw new BadRequestException(
              `El monto de Bs ${montoPedido.toFixed(2)} supera el límite normativo por comprobante del 10% del presupuesto asignado POA (Límite: Bs ${limite10Pct.toFixed(2)}).`,
            );
          }

          // 6. Validar disponibilidad presupuestaria
          // Disponible = Asignado - Comprometido pendiente - Ejecutado
          const presupuesto = await tx.presupuestoPartida.findUnique({
            where: {
              unidadId_gestion_partidaId: {
                unidadId: pedidoPre.unidadId,
                gestion: pedidoPre.gestion,
                partidaId: pedidoPre.partidaId,
              },
            },
          });

          if (!presupuesto || !presupuesto.activo) {
            throw new BadRequestException('No existe asignación presupuestaria activa para esta partida.');
          }

          const anticiposPendientes = await tx.anticipo.findMany({
            where: {
              cajaAperturaId: pedidoPre.cajaAperturaId,
              pedido: { partidaId: pedidoPre.partidaId },
              estado: EstadoAnticipo.PENDIENTE,
            },
            select: { monto: true },
          });

          let comprometidoPendiente = new Decimal('0.00');
          for (const ant of anticiposPendientes) {
            comprometidoPendiente = comprometidoPendiente.plus(new Decimal(ant.monto.toString()));
          }

          // REGLA INSTITUCIONAL CPS: disponible = asignado - comprometidoPendiente - ejecutado
          const calculoPresupuesto = calcularDisponibilidadPresupuesto(
            presupuesto.montoAsignado.toString(),
            comprometidoPendiente,
            0, // En Fase 2A los anticipos no constituyen gasto ejecutado; se incorporará en Fase 2B con Formulario 002
          );

          if (montoPedido.greaterThan(calculoPresupuesto.disponible)) {
            throw new BadRequestException(
              `Presupuesto insuficiente en la partida ${pedidoPre.partida.codigo}. Disponible: Bs ${calculoPresupuesto.disponible.toFixed(2)}, Requerido: Bs ${montoPedido.toFixed(2)}.`,
            );
          }

          // 7. Validar disponibilidad de efectivo
          const movimientos = await tx.movimientoEfectivo.findMany({
            where: { cajaAperturaId: pedidoPre.cajaAperturaId },
            select: { monto: true },
          });

          let efectivoDisponible = new Decimal('0.00');
          for (const mov of movimientos) {
            efectivoDisponible = efectivoDisponible.plus(new Decimal(mov.monto.toString()));
          }

          if (montoPedido.greaterThan(efectivoDisponible)) {
            throw new BadRequestException(
              `Efectivo insuficiente en caja chica. Efectivo disponible: Bs ${efectivoDisponible.toFixed(2)}, Requerido: Bs ${montoPedido.toFixed(2)}.`,
            );
          }

          // 8. Validación de fecha de entrega respecto a apertura, gestión y fecha de solicitud
          const hoyBolivia = getFechaHoyBolivia();
          const fechaEntregaStr = dto?.fechaEntrega ? dto.fechaEntrega.trim() : hoyBolivia;

          if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntregaStr)) {
            throw new BadRequestException('La fecha de entrega debe tener el formato YYYY-MM-DD.');
          }

          const anioEntrega = parseInt(fechaEntregaStr.split('-')[0], 10);
          if (anioEntrega !== pedidoPre.gestion) {
            throw new BadRequestException('La entrega de fondos debe efectuarse dentro de la gestión fiscal correspondiente.');
          }

          const fechaAperturaStr = formatDateOnly(caja.fechaApertura);
          if (fechaEntregaStr < fechaAperturaStr) {
            throw new BadRequestException('La fecha de entrega no puede ser anterior a la apertura de la caja chica.');
          }

          const fechaSolicitudStr = formatDateOnly(pedidoPre.fechaSolicitud);
          if (fechaEntregaStr < fechaSolicitudStr) {
            throw new BadRequestException('La fecha de entrega no puede ser anterior a la fecha de solicitud del pedido.');
          }

          const now = new Date();
          const fechaEntregaDate = fechaEntregaStr === hoyBolivia
            ? now
            : new Date(`${fechaEntregaStr}T12:00:00-04:00`);

          // 9. Numeración correlativa segura por unidad, gestión y caja
          const maxResult = await tx.$queryRaw<{ siguiente: number }[]>`
            SELECT COALESCE(MAX("correlativoVale"), 0) + 1 AS siguiente
            FROM "anticipos"
            WHERE "cajaAperturaId" = ${pedidoPre.cajaAperturaId}
          `;
          const correlativo = Number(maxResult[0]?.siguiente || 1);
          const numeroVale = `VALE-001-${caja.unidad.codigo}-${pedidoPre.gestion}-${String(correlativo).padStart(4, '0')}`;

          // 9. Preparar snapshot inmutable para el Formulario 001
          const datosVale: DatosVale001 = {
            numeroVale,
            gestion: pedidoPre.gestion,
            unidadCodigo: caja.unidad.codigo,
            unidadNombre: caja.unidad.nombre,
            lugar: pedidoPre.lugar,
            fechaEmision: formatearFechaLegibleBolivia(fechaEntregaStr),
            fechaEntrega: fechaEntregaDate.toISOString(),
            numeroPedido: pedidoPre.numeroPedido,
            solicitante: {
              nombres: pedidoPre.solicitanteNombres,
              apellidos: pedidoPre.solicitanteApellidos,
              ci: pedidoPre.solicitanteCi,
              area: pedidoPre.solicitanteArea,
            },
            receptor: {
              nombres: pedidoPre.receptorNombres,
              apellidos: pedidoPre.receptorApellidos,
              ci: pedidoPre.receptorCi,
            },
            descripcion: pedidoPre.descripcion,
            motivo: pedidoPre.motivo,
            partidaCodigo: pedidoPre.partida.codigo,
            partidaDescripcion: pedidoPre.partida.descripcion,
            monto: montoPedido.toFixed(2),
            montoLiteral: montoEnBolivianosLiteral(montoPedido),
            referenciaRepMat: pedidoPre.referenciaRepMat,
            observaciones: pedidoPre.observaciones,
            custodio: {
              nombres: caja.responsable.nombres,
              apellidos: caja.responsable.apellidos,
              ci: caja.responsable.carnetIdentidad,
              cargo: caja.responsable.cargo,
              documentoDesignacion: caja.responsable.documentoDesignacion,
            },
            entregadoPor: {
              nombreCompleto: currentUser.nombreCompleto || currentUser.username,
              username: currentUser.username,
            },
          };

          // 10. Crear Anticipo con número de control y snapshot
          const anticipo = await tx.anticipo.create({
            data: {
              pedidoId: id,
              cajaAperturaId: pedidoPre.cajaAperturaId,
              monto: new Prisma.Decimal(montoPedido.toFixed(2)),
              fechaEntrega: fechaEntregaDate,
              entregadoPorId: currentUser.id,
              estado: EstadoAnticipo.PENDIENTE,
              numeroVale,
              correlativoVale: correlativo,
              datosValeJson: JSON.stringify(datosVale),
            },
          });

          // 11. Registrar egreso único de efectivo (monto negativo para reducir saldo)
          const egresoMonto = montoPedido.negated();
          const movEfectivo = await tx.movimientoEfectivo.create({
            data: {
              cajaAperturaId: pedidoPre.cajaAperturaId,
              tipo: TipoMovimientoEfectivo.ENTREGA_ANTICIPO,
              monto: new Prisma.Decimal(egresoMonto.toFixed(2)),
              fecha: fechaEntregaDate,
              descripcion: `Entrega de anticipo ${numeroVale} a ${pedidoPre.receptorNombres} ${pedidoPre.receptorApellidos} (CI: ${pedidoPre.receptorCi}) para partida ${pedidoPre.partida.codigo}. Solicitud: ${pedidoPre.numeroPedido}`,
              comprobanteReferencia: numeroVale,
              actorId: currentUser.id,
              anticipoId: anticipo.id,
            },
          });

          return {
            anticipo,
            numeroVale,
            movEfectivo,
            datosVale,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002' || error.code === 'P2025')
      ) {
        throw new ConflictException(
          'Conflicto de concurrencia: El pedido ya fue procesado o se detectó una operación simultánea.',
        );
      }
      throw error;
    }

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ENTREGAR_ANTICIPO_VALE001',
      entidad: 'Anticipo',
      entidadId: resultado.anticipo.id,
      detalle: {
        pedidoId: id,
        numeroVale: resultado.numeroVale,
        monto: resultado.anticipo.monto.toFixed(2),
        solicitante: `${pedidoPre.solicitanteNombres} ${pedidoPre.solicitanteApellidos}`,
        receptor: `${pedidoPre.receptorNombres} ${pedidoPre.receptorApellidos}`,
      },
    });

    const pedidoActualizado = await this.findOne(id, currentUser);

    return {
      message: 'Entrega de anticipo registrada exitosamente y Formulario 001 habilitado.',
      pedido: pedidoActualizado,
      anticipo: {
        ...resultado.anticipo,
        monto: resultado.anticipo.monto.toFixed(2),
      },
      numeroVale: resultado.numeroVale,
    };
  }

  async getValePdfBuffer(pedidoId: string, currentUser: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        anticipo: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    this.checkUnitPermission(pedido.unidadId, currentUser);

    if (!pedido.anticipo) {
      throw new BadRequestException('El pedido aún no tiene un anticipo entregado ni vale 001 generado.');
    }

    const datosVale: DatosVale001 = JSON.parse(pedido.anticipo.datosValeJson);
    const pdfBuffer = await this.valePdfService.generatePdf(datosVale);

    const safeFilename = `${datosVale.numeroVale}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return {
      buffer: pdfBuffer,
      filename: safeFilename,
    };
  }
}
