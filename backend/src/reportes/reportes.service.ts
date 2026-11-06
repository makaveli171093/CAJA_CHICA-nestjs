import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RolUsuario,
  EstadoAnticipo,
  EstadoRendicion,
  TipoMovimientoEfectivo,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { AuthenticatedUser } from '../common/decorators';
import { calcularEstadoPlazo48Horas } from '../common/utils/date-utils';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  private checkUnitPermission(unidadId: string | undefined, user: AuthenticatedUser) {
    if (
      user.rol === RolUsuario.ADMINISTRADOR ||
      user.rol === RolUsuario.FINANCIERO ||
      user.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!unidadId || !user.unidades || !user.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para consultar reportes de esta unidad.');
    }
  }

  /**
   * Reporte 1: Ejecución Presupuestaria Consolidada
   * Puede ser multiunidad o filtrado por una unidad específica.
   */
  async getEjecucionPresupuestaria(params: {
    gestion: number;
    unidadId?: string;
    currentUser: AuthenticatedUser;
  }) {
    this.checkUnitPermission(params.unidadId, params.currentUser);

    const whereUnit: any = { activo: true };
    if (params.unidadId) {
      whereUnit.id = params.unidadId;
    } else if (params.currentUser.rol === RolUsuario.ENCARGADO) {
      whereUnit.id = { in: params.currentUser.unidades };
    }

    const unidades = await this.prisma.unit.findMany({
      where: whereUnit,
      include: {
        presupuestos: {
          where: { gestion: params.gestion, activo: true },
          include: { partida: true },
          orderBy: { partida: { codigo: 'asc' } },
        },
        cajasApertura: {
          where: { gestion: params.gestion },
        },
      },
      orderBy: { codigo: 'asc' },
    });

    const resultadoPorUnidad = [];
    let granTotalAsignado = new Decimal(0);
    let granTotalComprometido = new Decimal(0);
    let granTotalEjecutado = new Decimal(0);

    for (const u of unidades) {
      const caja = u.cajasApertura[0];
      const partidasReporte = [];
      let totalUnidadAsignado = new Decimal(0);
      let totalUnidadComprometido = new Decimal(0);
      let totalUnidadEjecutado = new Decimal(0);

      for (const p of u.presupuestos) {
        const asignado = new Decimal(p.montoAsignado.toString());

        // Comprometido: Vales pendientes en esta partida
        const valesPartida = caja
          ? await this.prisma.anticipo.findMany({
              where: {
                cajaAperturaId: caja.id,
                estado: EstadoAnticipo.PENDIENTE,
                pedido: { partidaId: p.partidaId },
              },
            })
          : [];
        let comprometido = new Decimal(0);
        valesPartida.forEach((v) => {
          comprometido = comprometido.plus(new Decimal(v.monto.toString()));
        });

        // Ejecutado: Total descargado en facturas de rendiciones aprobadas para esta partida
        const docsPartida = caja
          ? await this.prisma.documentoDescargo.findMany({
              where: {
                partidaId: p.partidaId,
                rendicion: {
                  cajaAperturaId: caja.id,
                  estado: EstadoRendicion.APROBADA,
                },
              },
            })
          : [];
        let ejecutado = new Decimal(0);
        docsPartida.forEach((d) => {
          ejecutado = ejecutado.plus(new Decimal(d.importe.toString()));
        });

        const disponible = asignado.minus(comprometido).minus(ejecutado);
        const porcentaje = asignado.gt(0)
          ? ejecutado.times(100).dividedBy(asignado).toFixed(1)
          : '0.0';

        totalUnidadAsignado = totalUnidadAsignado.plus(asignado);
        totalUnidadComprometido = totalUnidadComprometido.plus(comprometido);
        totalUnidadEjecutado = totalUnidadEjecutado.plus(ejecutado);

        partidasReporte.push({
          partidaId: p.partidaId,
          codigo: p.partida.codigo,
          descripcion: p.partida.descripcion,
          asignado: asignado.toFixed(2),
          comprometido: comprometido.toFixed(2),
          ejecutado: ejecutado.toFixed(2),
          disponible: disponible.gte(0) ? disponible.toFixed(2) : '0.00',
          porcentajeEjecucion: `${porcentaje}%`,
        });
      }

      granTotalAsignado = granTotalAsignado.plus(totalUnidadAsignado);
      granTotalComprometido = granTotalComprometido.plus(totalUnidadComprometido);
      granTotalEjecutado = granTotalEjecutado.plus(totalUnidadEjecutado);

      resultadoPorUnidad.push({
        unidadId: u.id,
        codigo: u.codigo,
        nombre: u.nombre,
        dependencia: u.dependencia,
        estadoCaja: caja ? caja.estado : 'SIN_APERTURA',
        fondoAutorizado: caja ? Number(caja.montoAutorizado).toFixed(2) : '0.00',
        totalAsignado: totalUnidadAsignado.toFixed(2),
        totalComprometido: totalUnidadComprometido.toFixed(2),
        totalEjecutado: totalUnidadEjecutado.toFixed(2),
        totalDisponible: totalUnidadAsignado.minus(totalUnidadComprometido).minus(totalUnidadEjecutado).toFixed(2),
        porcentajeEjecucion: totalUnidadAsignado.gt(0)
          ? `${totalUnidadEjecutado.times(100).dividedBy(totalUnidadAsignado).toFixed(1)}%`
          : '0.0%',
        partidas: partidasReporte,
      });
    }

    const granTotalDisponible = granTotalAsignado.minus(granTotalComprometido).minus(granTotalEjecutado);
    const granPorcentaje = granTotalAsignado.gt(0)
      ? `${granTotalEjecutado.times(100).dividedBy(granTotalAsignado).toFixed(1)}%`
      : '0.0%';

    const esSolaUnidad = resultadoPorUnidad.length === 1;

    if (esSolaUnidad) {
      const u = resultadoPorUnidad[0];
      return {
        gestion: params.gestion,
        totales: {
          asignado: parseFloat(u.totalAsignado),
          comprometido: parseFloat(u.totalComprometido),
          ejecutado: parseFloat(u.totalEjecutado),
          disponible: parseFloat(u.totalDisponible),
          porcentajeEjecucion: parseFloat(u.porcentajeEjecucion),
        },
        partidas: u.partidas.map((p: any) => ({
          partidaId: p.partidaId,
          codigo: p.codigo,
          descripcion: p.descripcion,
          asignado: parseFloat(p.asignado),
          comprometido: parseFloat(p.comprometido),
          ejecutado: parseFloat(p.ejecutado),
          disponible: parseFloat(p.disponible),
          porcentajeEjecucion: parseFloat(p.porcentajeEjecucion),
        })),
      };
    }

    // Consolidado: múltiples unidades
    return {
      gestion: params.gestion,
      totales: {
        asignado: parseFloat(granTotalAsignado.toFixed(2)),
        comprometido: parseFloat(granTotalComprometido.toFixed(2)),
        ejecutado: parseFloat(granTotalEjecutado.toFixed(2)),
        disponible: parseFloat(granTotalDisponible.gte(0) ? granTotalDisponible.toFixed(2) : '0.00'),
        porcentajeEjecucion: parseFloat(granTotalAsignado.gt(0)
          ? granTotalEjecutado.times(100).dividedBy(granTotalAsignado).toFixed(1)
          : '0.0'),
      },
      partidas: [],
      unidades: resultadoPorUnidad.map((u: any) => ({
        unidadId: u.unidadId,
        codigo: u.codigo,
        nombre: u.nombre,
        asignado: parseFloat(u.totalAsignado),
        comprometido: parseFloat(u.totalComprometido),
        ejecutado: parseFloat(u.totalEjecutado),
        disponible: parseFloat(u.totalDisponible),
        porcentajeEjecucion: parseFloat(u.porcentajeEjecucion),
      })),
    };
  }

  /**
   * Reporte 2: Kardex / Libro Diario de Movimientos de Caja Chica
   * Muestra la trazabilidad cronológica con saldo acumulado exacto.
   */
  async getKardexCaja(unidadId: string, gestion: number, user: AuthenticatedUser) {
    this.checkUnitPermission(unidadId, user);

    const caja = await this.prisma.cajaApertura.findUnique({
      where: { unidadId_gestion: { unidadId, gestion } },
      include: { unidad: true, responsable: true },
    });

    if (!caja) {
      throw new NotFoundException(`No existe caja aperturada para la unidad en la gestión ${gestion}.`);
    }

    const movimientos = await this.prisma.movimientoEfectivo.findMany({
      where: { cajaAperturaId: caja.id },
      include: {
        anticipo: {
          include: { pedido: true },
        },
        rendicion: true,
      },
      orderBy: { fecha: 'asc' },
    });

    let saldo = new Decimal(0);
    const libro = movimientos.map((m) => {
      const monto = new Decimal(m.monto.toString());
      let esIngreso = false;

      switch (m.tipo) {
        case TipoMovimientoEfectivo.APERTURA:
        case TipoMovimientoEfectivo.REPOSICION:
        case TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE:
          saldo = saldo.plus(monto);
          esIngreso = true;
          break;
        case TipoMovimientoEfectivo.ENTREGA_ANTICIPO:
        case TipoMovimientoEfectivo.DESCARGO:
          saldo = saldo.minus(monto);
          esIngreso = false;
          break;
        default:
          saldo = saldo.plus(monto);
          esIngreso = true;
          break;
      }

      return {
        fecha: m.fecha,
        tipo: m.tipo,
        documentoRef: m.comprobanteReferencia || '-',
        descripcion: m.descripcion,
        ingreso: esIngreso ? parseFloat(monto.toFixed(2)) : 0,
        egreso: !esIngreso ? parseFloat(monto.toFixed(2)) : 0,
        saldo: parseFloat(saldo.toFixed(2)),
      };
    });

    const totalIngresos = libro.reduce((sum, m) => sum + m.ingreso, 0);
    const totalEgresos = libro.reduce((sum, m) => sum + m.egreso, 0);

    return {
      cajaApertura: {
        id: caja.id,
        gestion,
        montoAsignado: Number(caja.montoAutorizado).toFixed(2),
        saldoActualEfectivo: saldo.toFixed(2),
        estado: caja.estado,
        unidad: {
          id: caja.unidad.id,
          codigo: caja.unidad.codigo,
          nombre: caja.unidad.nombre,
        },
        responsable: {
          nombreCompleto: `${caja.responsable.nombres} ${caja.responsable.apellidos}`,
          cargo: caja.responsable.cargo,
        },
      },
      movimientos: libro,
      resumen: {
        totalIngresos,
        totalEgresos,
        saldoFinal: parseFloat(saldo.toFixed(2)),
      },
    };
  }

  /**
   * Reporte 3: Auditoría y Cumplimiento Normativo de 48 Horas Hábiles Administrativas
   */
  async getCumplimientoPlazos(gestion: number, unidadId?: string, user?: AuthenticatedUser) {
    if (user) {
      this.checkUnitPermission(unidadId, user);
    }

    const where: any = {
      cajaApertura: {
        gestion,
      },
    };
    if (unidadId) {
      where.cajaApertura.unidadId = unidadId;
    } else if (user && user.rol === RolUsuario.ENCARGADO) {
      where.cajaApertura.unidadId = { in: user.unidades };
    }

    const anticipos = await this.prisma.anticipo.findMany({
      where,
      include: {
        pedido: { include: { unidad: true, partida: true } },
        rendicion: true,
      },
      orderBy: { fechaEntrega: 'desc' },
    });

    let dentroPlazo = 0;
    let fueraPlazo = 0;
    let pendientesEnPlazo = 0;
    let pendientesVencidos = 0;

    const items = anticipos.map((a) => {
      const calculo = calcularEstadoPlazo48Horas(
        a.fechaEntrega,
        a.rendicion ? a.rendicion.fechaRendicion : null,
      );

      let estadoPlazo: string = 'A_TIEMPO';

      if (a.estado === EstadoAnticipo.RENDIDO) {
        if (!calculo.vencido) {
          dentroPlazo++;
          estadoPlazo = 'RENDIDO_A_TIEMPO';
        } else {
          fueraPlazo++;
          estadoPlazo = 'RENDIDO_FUERA_DE_PLAZO';
        }
      } else {
        if (!calculo.vencido) {
          pendientesEnPlazo++;
          estadoPlazo = 'A_TIEMPO';
        } else {
          pendientesVencidos++;
          estadoPlazo = 'VENCIDO';
        }
      }

      // Calcular fechaLimite48h como string ISO
      const fechaLimite48h = calculo.fechaLimite.toISOString().slice(0, 10);

      return {
        anticipoId: a.id,
        numeroVale: a.numeroVale,
        solicitante: `${a.pedido.solicitanteNombres} ${a.pedido.solicitanteApellidos}`,
        cargo: '',
        area: a.pedido.solicitanteArea || a.pedido.unidad.nombre || '',
        monto: parseFloat(Number(a.monto).toFixed(2)),
        fechaEntrega: a.fechaEntrega,
        fechaLimite48h,
        horasHabilesTranscurridas: calculo.horasHabilesTranscurridas,
        horasHabilesRestantes: calculo.horasHabilesRestantes,
        estadoPlazo,
      };
    });

    const totalRendidos = dentroPlazo + fueraPlazo;
    const porcentajeCumplimientoNum = totalRendidos > 0
      ? parseFloat(new Decimal(dentroPlazo).times(100).dividedBy(totalRendidos).toFixed(1))
      : 100.0;

    return {
      gestion,
      totalAnticipos: anticipos.length,
      totalRendidos,
      totalPendientes: pendientesEnPlazo,
      totalVencidos: pendientesVencidos,
      porcentajeCumplimiento: porcentajeCumplimientoNum,
      items,
    };
  }
}
