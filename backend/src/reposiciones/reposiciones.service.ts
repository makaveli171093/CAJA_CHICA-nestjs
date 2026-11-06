import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoReposicion,
  EstadoRendicion,
  EstadoCajaApertura,
  TipoMovimientoEfectivo,
  RolUsuario,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { AuthenticatedUser } from '../common/decorators';
import { CreateReposicionDto } from './dto/create-reposicion.dto';
import {
  AprobarReposicionDto,
  RechazarReposicionDto,
  EfectuarReposicionDto,
} from './dto/gestionar-reposicion.dto';

@Injectable()
export class ReposicionesService {
  constructor(private prisma: PrismaService) {}

  private checkUnitPermission(unidadId: string, user: AuthenticatedUser) {
    if (
      user.rol === RolUsuario.ADMINISTRADOR ||
      user.rol === RolUsuario.FINANCIERO ||
      user.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!user.unidades || !user.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para operar en esta unidad institucional.');
    }
  }

  /**
   * Crea y solicita una nueva Reposición de Fondos agrupando rendiciones aprobadas.
   */
  async create(dto: CreateReposicionDto, user: AuthenticatedUser) {
    this.checkUnitPermission(dto.unidadId, user);

    // 1. Obtener la caja aperturada activa
    const caja = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId: dto.unidadId,
          gestion: dto.gestion,
        },
      },
      include: { unidad: true },
    });

    if (!caja) {
      throw new NotFoundException(
        `No existe caja chica aperturada para esta unidad en la gestión ${dto.gestion}.`,
      );
    }

    if (caja.estado !== EstadoCajaApertura.ABIERTA) {
      throw new BadRequestException('Solo se pueden solicitar reposiciones para cajas chicas en estado ABIERTA.');
    }

    // 2. Validar rendiciones enviadas
    const rendiciones = await this.prisma.rendicion.findMany({
      where: {
        id: { in: dto.rendicionIds },
        unidadId: dto.unidadId,
        gestion: dto.gestion,
      },
    });

    if (rendiciones.length !== dto.rendicionIds.length) {
      throw new BadRequestException(
        'Una o más rendiciones especificadas no existen o no corresponden a esta unidad y gestión.',
      );
    }

    let sumaMonto = new Decimal(0);
    for (const r of rendiciones) {
      if (r.estado !== EstadoRendicion.APROBADA) {
        throw new BadRequestException(
          `La rendición ${r.numeroRendicion} no se encuentra en estado APROBADA (estado actual: ${r.estado}). Solo rendiciones formalmente aprobadas pueden reponerse.`,
        );
      }
      if (r.reposicionId) {
        throw new ConflictException(
          `La rendición ${r.numeroRendicion} ya se encuentra incluida en otra solicitud de reposición de fondos.`,
        );
      }
      sumaMonto = sumaMonto.plus(new Decimal(r.totalDescargado.toString()));
    }

    if (sumaMonto.lte(0)) {
      throw new BadRequestException('El monto total descargado a reponer debe ser mayor a 0.00 Bs.');
    }

    // 3. Generar correlativo institucional y número oficial de reposición
    const maxCorrelativo = await this.prisma.reposicion.aggregate({
      where: { cajaAperturaId: caja.id },
      _max: { correlativo: true },
    });
    const nextCorrelativo = (maxCorrelativo._max.correlativo || 0) + 1;
    const padCorrelativo = String(nextCorrelativo).padStart(4, '0');
    const numeroReposicion = `REP-${caja.unidad.codigo}-${dto.gestion}-${padCorrelativo}`;

    // 4. Transacción atómica: crear reposición y enlazar las rendiciones
    return this.prisma.$transaction(async (tx) => {
      const reposicion = await tx.reposicion.create({
        data: {
          numeroReposicion,
          correlativo: nextCorrelativo,
          unidadId: dto.unidadId,
          gestion: dto.gestion,
          cajaAperturaId: caja.id,
          montoTotal: sumaMonto.toFixed(2),
          estado: EstadoReposicion.SOLICITADA,
          observaciones: dto.observaciones?.trim() || null,
          solicitadoPorId: user.id,
        },
      });

      await tx.rendicion.updateMany({
        where: { id: { in: dto.rendicionIds } },
        data: { reposicionId: reposicion.id },
      });

      return reposicion;
    });
  }

  /**
   * Obtiene rendiciones aprobadas que aún no han sido incluidas en ninguna reposición.
   */
  async getRendicionesPendientes(unidadId: string, gestion: number, user: AuthenticatedUser) {
    this.checkUnitPermission(unidadId, user);

    return this.prisma.rendicion.findMany({
      where: {
        unidadId,
        gestion,
        estado: EstadoRendicion.APROBADA,
        reposicionId: null,
      },
      include: {
        anticipo: {
          include: { pedido: true },
        },
        documentos: {
          include: { partida: true },
        },
        creadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
      },
      orderBy: { correlativoRendicion: 'asc' },
    });
  }

  /**
   * Listar reposiciones de una unidad y gestión.
   */
  async findAll(unidadId: string, gestion: number, user: AuthenticatedUser) {
    this.checkUnitPermission(unidadId, user);

    const items = await this.prisma.reposicion.findMany({
      where: {
        unidadId,
        gestion,
      },
      include: {
        solicitadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
        aprobadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
        _count: {
          select: { rendiciones: true },
        },
      },
      orderBy: { correlativo: 'desc' },
    });

    return items.map((r) => ({
      ...r,
      montoTotal: Number(r.montoTotal).toFixed(2),
      cantidadRendiciones: r._count.rendiciones,
    }));
  }

  /**
   * Obtiene el detalle completo de una reposición incluyendo el desglose de rendiciones y facturas.
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const reposicion = await this.prisma.reposicion.findUnique({
      where: { id },
      include: {
        unidad: true,
        cajaApertura: true,
        solicitadoPor: {
          select: { id: true, nombreCompleto: true, username: true, cargo: true },
        },
        aprobadoPor: {
          select: { id: true, nombreCompleto: true, username: true, cargo: true },
        },
        rendiciones: {
          include: {
            anticipo: {
              include: { pedido: true },
            },
            documentos: {
              include: { partida: true },
            },
          },
          orderBy: { correlativoRendicion: 'asc' },
        },
      },
    });

    if (!reposicion) {
      throw new NotFoundException('La reposición de fondos especificada no existe.');
    }

    this.checkUnitPermission(reposicion.unidadId, user);

    return {
      ...reposicion,
      montoTotal: Number(reposicion.montoTotal).toFixed(2),
    };
  }

  /**
   * Aprobación de la Solicitud de Reposición (Solo Financiero / Administrador).
   */
  async aprobar(id: string, dto: AprobarReposicionDto, user: AuthenticatedUser) {
    if (user.rol !== RolUsuario.FINANCIERO && user.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el personal de la Dirección Administrativa Financiera o el Administrador pueden aprobar reposiciones.');
    }

    const reposicion = await this.prisma.reposicion.findUnique({ where: { id } });
    if (!reposicion) {
      throw new NotFoundException('La reposición no existe.');
    }

    if (reposicion.estado !== EstadoReposicion.SOLICITADA) {
      throw new BadRequestException(`No se puede aprobar una reposición con estado ${reposicion.estado}. Solo SOLICITADA.`);
    }

    return this.prisma.reposicion.update({
      where: { id },
      data: {
        estado: EstadoReposicion.APROBADA,
        aprobadoPorId: user.id,
        fechaAprobacion: new Date(),
        observaciones: dto.observaciones?.trim() || reposicion.observaciones,
      },
    });
  }

  /**
   * Rechazo de la Solicitud de Reposición (desvincula rendiciones para que puedan corregirse o reagruparse).
   */
  async rechazar(id: string, dto: RechazarReposicionDto, user: AuthenticatedUser) {
    if (user.rol !== RolUsuario.FINANCIERO && user.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el personal Financiero o Administrador pueden rechazar reposiciones.');
    }

    const reposicion = await this.prisma.reposicion.findUnique({ where: { id } });
    if (!reposicion) {
      throw new NotFoundException('La reposición no existe.');
    }

    if (reposicion.estado === EstadoReposicion.EFECTUADA) {
      throw new BadRequestException('No se puede rechazar una reposición que ya fue cobrada y efectuada en caja.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Liberar rendiciones
      await tx.rendicion.updateMany({
        where: { reposicionId: id },
        data: { reposicionId: null },
      });

      // 2. Marcar reposición como rechazada
      return tx.reposicion.update({
        where: { id },
        data: {
          estado: EstadoReposicion.RECHAZADA,
          motivoRechazo: dto.motivo.trim(),
          aprobadoPorId: user.id,
        },
      });
    });
  }

  /**
   * Efectuar reposición: ingresa el efectivo del cheque/transferencia institucional en la Caja Chica.
   */
  async efectuar(id: string, dto: EfectuarReposicionDto, user: AuthenticatedUser) {
    if (user.rol !== RolUsuario.FINANCIERO && user.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el personal Financiero o Administrador pueden confirmar el desembolso y efectivización de la reposición.');
    }

    const reposicion = await this.prisma.reposicion.findUnique({
      where: { id },
      include: { cajaApertura: true },
    });

    if (!reposicion) {
      throw new NotFoundException('La reposición no existe.');
    }

    if (reposicion.estado !== EstadoReposicion.APROBADA) {
      throw new BadRequestException('Solo reposiciones formalmente APROBADAS pueden ser registradas como EFECTUADAS.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar reposición como EFECTUADA
      const updatedReposicion = await tx.reposicion.update({
        where: { id },
        data: {
          estado: EstadoReposicion.EFECTUADA,
          fechaEfectuada: new Date(),
          comprobantePago: dto.comprobantePago.trim(),
          bancoOrigen: dto.bancoOrigen?.trim() || null,
          observaciones: dto.observaciones?.trim() || reposicion.observaciones,
        },
      });

      // 2. Registrar movimiento de entrada de efectivo por reposición de fondo
      await tx.movimientoEfectivo.create({
        data: {
          cajaAperturaId: reposicion.cajaAperturaId,
          tipo: TipoMovimientoEfectivo.REPOSICION,
          monto: reposicion.montoTotal,
          descripcion: `Reposición de fondos institucional CPS - ${reposicion.numeroReposicion} (${dto.comprobantePago.trim()})`,
          comprobanteReferencia: dto.comprobantePago.trim(),
          actorId: user.id,
          reposicionId: reposicion.id,
        },
      });

      return updatedReposicion;
    });
  }
}
