import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TipoArqueo,
  EstadoArqueo,
  EstadoAnticipo,
  RolUsuario,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { AuthenticatedUser } from '../common/decorators';
import { CreateArqueoDto, BilleteoDto } from './dto/create-arqueo.dto';

@Injectable()
export class ArqueosService {
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
   * Obtiene resumen previo al arqueo (documentos pendientes, vales y fondo autorizado)
   * para facilitar la conciliación en tiempo real durante el conteo físico.
   */
  async getResumenPrevio(unidadId: string, gestion: number, user: AuthenticatedUser) {
    this.checkUnitPermission(unidadId, user);

    const caja = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId,
          gestion,
        },
      },
      include: {
        responsable: true,
        unidad: true,
      },
    });

    if (!caja) {
      throw new NotFoundException(`No existe caja aperturada para la unidad en la gestión ${gestion}.`);
    }

    // 1. Vales provisionales pendientes de rendición
    const valesPendientes = await this.prisma.anticipo.findMany({
      where: {
        cajaAperturaId: caja.id,
        estado: EstadoAnticipo.PENDIENTE,
      },
      include: {
        pedido: true,
      },
      orderBy: { correlativoVale: 'asc' },
    });

    let sumaVales = new Decimal(0);
    valesPendientes.forEach((v) => {
      sumaVales = sumaVales.plus(new Decimal(v.monto.toString()));
    });

    // 2. Rendiciones no reembolsadas (en trámite o pendientes de reposición)
    const rendicionesEnTramite = await this.prisma.rendicion.findMany({
      where: {
        cajaAperturaId: caja.id,
        OR: [
          { reposicionId: null },
          { reposicion: { estado: { not: 'EFECTUADA' } } },
        ],
      },
      include: {
        anticipo: { include: { pedido: true } },
      },
      orderBy: { correlativoRendicion: 'asc' },
    });

    let sumaRendiciones = new Decimal(0);
    rendicionesEnTramite.forEach((r) => {
      sumaRendiciones = sumaRendiciones.plus(new Decimal(r.totalDescargado.toString()));
    });

    const fondoAutorizado = new Decimal(caja.montoAutorizado.toString());
    const efectivoEsperado = fondoAutorizado.minus(sumaVales).minus(sumaRendiciones);

    return {
      cajaId: caja.id,
      unidad: caja.unidad,
      responsable: caja.responsable,
      fondoAutorizado: fondoAutorizado.toFixed(2),
      valesPendientes: {
        cantidad: valesPendientes.length,
        total: sumaVales.toFixed(2),
        items: valesPendientes.map((v) => ({
          id: v.id,
          numeroVale: v.numeroVale,
          solicitante: `${v.pedido.solicitanteNombres} ${v.pedido.solicitanteApellidos}`,
          concepto: v.pedido.descripcion,
          monto: Number(v.monto).toFixed(2),
          fechaEntrega: v.fechaEntrega,
        })),
      },
      rendicionesEnTramite: {
        cantidad: rendicionesEnTramite.length,
        total: sumaRendiciones.toFixed(2),
        items: rendicionesEnTramite.map((r) => ({
          id: r.id,
          numeroRendicion: r.numeroRendicion,
          estado: r.estado,
          totalDescargado: Number(r.totalDescargado).toFixed(2),
          fechaRendicion: r.fechaRendicion,
        })),
      },
      efectivoTeoricoEsperado: efectivoEsperado.gte(0) ? efectivoEsperado.toFixed(2) : '0.00',
    };
  }

  /**
   * Registra un Arqueo Físico Formal de Caja Chica con Billeteo y Acta Institucional.
   */
  async create(dto: CreateArqueoDto, user: AuthenticatedUser) {
    this.checkUnitPermission(dto.unidadId, user);

    const caja = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId: dto.unidadId,
          gestion: dto.gestion,
        },
      },
      include: {
        responsable: true,
        unidad: true,
      },
    });

    if (!caja) {
      throw new NotFoundException(`No existe caja aperturada para esta unidad en la gestión ${dto.gestion}.`);
    }

    // 1. Calcular desglose de billetes
    const b = dto.billeteo;
    const totalBilletes = new Decimal(b.b200 || 0).times(200)
      .plus(new Decimal(b.b100 || 0).times(100))
      .plus(new Decimal(b.b50 || 0).times(50))
      .plus(new Decimal(b.b20 || 0).times(20))
      .plus(new Decimal(b.b10 || 0).times(10));

    // 2. Calcular desglose de monedas
    const totalMonedas = new Decimal(b.m5 || 0).times(5)
      .plus(new Decimal(b.m2 || 0).times(2))
      .plus(new Decimal(b.m1 || 0).times(1))
      .plus(new Decimal(b.m050 || 0).times(0.50))
      .plus(new Decimal(b.m020 || 0).times(0.20))
      .plus(new Decimal(b.m010 || 0).times(0.10));

    const totalEfectivo = totalBilletes.plus(totalMonedas);

    // 3. Vales provisionales pendientes
    const vales = await this.prisma.anticipo.findMany({
      where: {
        cajaAperturaId: caja.id,
        estado: EstadoAnticipo.PENDIENTE,
      },
    });
    let totalVales = new Decimal(0);
    vales.forEach((v) => {
      totalVales = totalVales.plus(new Decimal(v.monto.toString()));
    });

    // 4. Rendiciones no reembolsadas
    const rendiciones = await this.prisma.rendicion.findMany({
      where: {
        cajaAperturaId: caja.id,
        OR: [
          { reposicionId: null },
          { reposicion: { estado: { not: 'EFECTUADA' } } },
        ],
      },
    });
    let totalRendiciones = new Decimal(0);
    rendiciones.forEach((r) => {
      totalRendiciones = totalRendiciones.plus(new Decimal(r.totalDescargado.toString()));
    });

    // 5. Conciliación
    const totalGeneral = totalEfectivo.plus(totalVales).plus(totalRendiciones);
    const fondoAutorizado = new Decimal(caja.montoAutorizado.toString());
    const diferencia = totalGeneral.minus(fondoAutorizado);

    let resultado: EstadoArqueo = EstadoArqueo.CONFORME;
    if (diferencia.lt(0)) {
      resultado = EstadoArqueo.FALTANTE;
    } else if (diferencia.gt(0)) {
      resultado = EstadoArqueo.SOBRANTE;
    }

    // 6. Correlativo institucional
    const maxCorrelativo = await this.prisma.arqueoCaja.aggregate({
      where: { cajaAperturaId: caja.id },
      _max: { correlativo: true },
    });
    const nextCorrelativo = (maxCorrelativo._max.correlativo || 0) + 1;
    const padCorrelativo = String(nextCorrelativo).padStart(4, '0');
    const numeroActa = `ARQ-${caja.unidad.codigo}-${dto.gestion}-${padCorrelativo}`;

    const horaArqueo =
      dto.horaArqueo?.trim() ||
      new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

    const custodioNombre = `${caja.responsable.nombres} ${caja.responsable.apellidos}`;
    const auditorNombre = user.nombreCompleto || user.username;

    return this.prisma.arqueoCaja.create({
      data: {
        numeroActa,
        correlativo: nextCorrelativo,
        unidadId: dto.unidadId,
        gestion: dto.gestion,
        cajaAperturaId: caja.id,
        tipoArqueo: dto.tipoArqueo || TipoArqueo.PERIODICO,
        horaArqueo,
        billeteoJson: JSON.stringify(dto.billeteo),
        totalBilletes: totalBilletes.toFixed(2),
        totalMonedas: totalMonedas.toFixed(2),
        totalEfectivo: totalEfectivo.toFixed(2),
        totalValesPendientes: totalVales.toFixed(2),
        totalRendiciones: totalRendiciones.toFixed(2),
        totalGeneral: totalGeneral.toFixed(2),
        fondoAutorizado: fondoAutorizado.toFixed(2),
        diferencia: diferencia.toFixed(2),
        resultado,
        custodioNombre,
        auditorNombre,
        testigoNombre: dto.testigoNombre?.trim() || null,
        observaciones: dto.observaciones?.trim() || null,
        realizadoPorId: user.id,
      },
      include: {
        unidad: true,
      },
    });
  }

  /**
   * Listar arqueos de una unidad y gestión.
   */
  async findAll(unidadId: string, gestion: number, user: AuthenticatedUser) {
    this.checkUnitPermission(unidadId, user);

    const items = await this.prisma.arqueoCaja.findMany({
      where: {
        unidadId,
        gestion,
      },
      include: {
        realizadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
      },
      orderBy: { correlativo: 'desc' },
    });

    return items.map((a) => ({
      ...a,
      totalEfectivo: Number(a.totalEfectivo).toFixed(2),
      totalValesPendientes: Number(a.totalValesPendientes).toFixed(2),
      totalRendiciones: Number(a.totalRendiciones).toFixed(2),
      totalGeneral: Number(a.totalGeneral).toFixed(2),
      fondoAutorizado: Number(a.fondoAutorizado).toFixed(2),
      diferencia: Number(a.diferencia).toFixed(2),
    }));
  }

  /**
   * Detalle completo del arqueo para visualización y acta de impresión.
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const arqueo = await this.prisma.arqueoCaja.findUnique({
      where: { id },
      include: {
        unidad: true,
        cajaApertura: {
          include: { responsable: true },
        },
        realizadoPor: {
          select: { id: true, nombreCompleto: true, username: true, cargo: true },
        },
      },
    });

    if (!arqueo) {
      throw new NotFoundException('El arqueo de caja especificado no existe.');
    }

    this.checkUnitPermission(arqueo.unidadId, user);

    let billeteo: BilleteoDto;
    try {
      billeteo = JSON.parse(arqueo.billeteoJson);
    } catch {
      billeteo = {} as BilleteoDto;
    }

    return {
      ...arqueo,
      billeteo,
      totalBilletes: Number(arqueo.totalBilletes).toFixed(2),
      totalMonedas: Number(arqueo.totalMonedas).toFixed(2),
      totalEfectivo: Number(arqueo.totalEfectivo).toFixed(2),
      totalValesPendientes: Number(arqueo.totalValesPendientes).toFixed(2),
      totalRendiciones: Number(arqueo.totalRendiciones).toFixed(2),
      totalGeneral: Number(arqueo.totalGeneral).toFixed(2),
      fondoAutorizado: Number(arqueo.fondoAutorizado).toFixed(2),
      diferencia: Number(arqueo.diferencia).toFixed(2),
    };
  }
}
