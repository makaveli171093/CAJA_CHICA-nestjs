import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario, EstadoCajaApertura } from '@prisma/client';
import { calcularDisponibilidadPresupuesto } from '../common/utils/presupuesto-calculo';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ADMINISTRADOR ||
      currentUser.rol === RolUsuario.FINANCIERO ||
      currentUser.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene acceso a la información de esta unidad.');
    }
  }

  async getDashboardData(
    unidadId: string,
    gestion: number,
    currentUser: AuthenticatedUser,
  ) {
    this.checkUnitPermission(unidadId, currentUser);

    const unit = await this.prisma.unit.findUnique({
      where: { id: unidadId },
    });

    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    // 1. Obtener registro de apertura para la gestión
    const caja = await this.prisma.cajaApertura.findUnique({
      where: {
        unidadId_gestion: {
          unidadId,
          gestion: Number(gestion),
        },
      },
      include: {
        responsable: true,
        movimientos: true,
      },
    });

    // 2. Calcular efectivo disponible sumando movimientos de efectivo registrados
    let efectivoDisponibleDecimal = new Decimal('0.00');
    let montoAutorizadoDecimal = new Decimal('0.00');
    let limitePorComprobanteDecimal = new Decimal('0.00');

    if (caja) {
      montoAutorizadoDecimal = new Decimal(caja.montoAutorizado.toString());
      // Límite ordinario por comprobante: 10 % del fondo autorizado según reglamento CPS 002/2013
      limitePorComprobanteDecimal = montoAutorizadoDecimal.times(0.10);

      // Calcular saldo efectivo sumando movimientos
      for (const mov of caja.movimientos) {
        const movDecimal = new Decimal(mov.monto.toString());
        efectivoDisponibleDecimal = efectivoDisponibleDecimal.plus(movDecimal);
      }
    }

    // 3. Obtener presupuestos por partida para la unidad y gestión
    const [presupuestos, anticipos] = await Promise.all([
      this.prisma.presupuestoPartida.findMany({
        where: {
          unidadId,
          gestion: Number(gestion),
          activo: true,
        },
        include: {
          partida: true,
        },
        orderBy: {
          partida: { codigo: 'asc' },
        },
      }),
      this.prisma.anticipo.findMany({
        where: {
          cajaApertura: {
            unidadId,
            gestion: Number(gestion),
          },
          estado: 'PENDIENTE',
        },
        include: {
          pedido: { select: { partidaId: true } },
        },
      }),
    ]);

    const mapaComprometido = new Map<string, Decimal>();
    let totalAnticiposPendientesDecimal = new Decimal('0.00');

    anticipos.forEach((ant) => {
      const pId = ant.pedido.partidaId;
      const antDec = new Decimal(ant.monto.toString());
      totalAnticiposPendientesDecimal = totalAnticiposPendientesDecimal.plus(antDec);
      const prev = mapaComprometido.get(pId) || new Decimal('0.00');
      mapaComprometido.set(pId, prev.plus(antDec));
    });

    let totalPresupuestoDecimal = new Decimal('0.00');
    let totalComprometidoDecimal = new Decimal('0.00');

    const presupuestoPorPartida = presupuestos.map((p) => {
      const pDecimal = new Decimal(p.montoAsignado.toString());
      totalPresupuestoDecimal = totalPresupuestoDecimal.plus(pDecimal);
      const compromDec = mapaComprometido.get(p.partidaId) || new Decimal('0.00');
      totalComprometidoDecimal = totalComprometidoDecimal.plus(compromDec);
      // REGLA CENTRALIZADA CPS: disponible = asignado - comprometido - ejecutado
      const calculo = calcularDisponibilidadPresupuesto(pDecimal, compromDec, 0);
      const disponibleDec = calculo.disponible;

      return {
        id: p.id,
        partidaId: p.partidaId,
        partidaCodigo: p.partida.codigo,
        partidaDescripcion: p.partida.descripcion,
        montoAsignado: p.montoAsignado.toFixed(2),
        comprometido: compromDec.toFixed(2),
        disponible: disponibleDec.toFixed(2),
      };
    });

    const totalDisponiblePresupuestoDecimal = totalPresupuestoDecimal.minus(totalComprometidoDecimal);

    // REGLA INSTITUCIONAL CPS: Límite por operación (10%) calculado sobre el presupuesto total asignado por partidas (POA)
    const baseCalculoLimite = totalPresupuestoDecimal.greaterThan(0)
      ? totalPresupuestoDecimal
      : montoAutorizadoDecimal;
    limitePorComprobanteDecimal = baseCalculoLimite.times(0.10);

    return {
      unidad: {
        id: unit.id,
        codigo: unit.codigo,
        nombre: unit.nombre,
        dependencia: unit.dependencia,
        activo: unit.activo,
      },
      gestion: Number(gestion),
      caja: caja
        ? {
            id: caja.id,
            unidadId: caja.unidadId,
            gestion: caja.gestion,
            responsableId: caja.responsableId,
            montoAutorizado: caja.montoAutorizado.toFixed(2),
            importeRecibido: caja.importeRecibido.toFixed(2),
            fechaApertura: caja.fechaApertura,
            docAutorizacion: caja.docAutorizacion,
            compIngreso: caja.compIngreso,
            estado: caja.estado,
            fechaConfirmacion: caja.fechaConfirmacion,
            confirmadoPorId: caja.confirmadoPorId,
          }
        : null,
      responsable: caja?.responsable
        ? {
            id: caja.responsable.id,
            unidadId: caja.responsable.unidadId,
            nombres: caja.responsable.nombres,
            apellidos: caja.responsable.apellidos,
            carnetIdentidad: caja.responsable.carnetIdentidad,
            cargo: caja.responsable.cargo,
            documentoDesignacion: caja.responsable.documentoDesignacion,
            fechaDesignacion: caja.responsable.fechaDesignacion,
            activo: caja.responsable.activo,
          }
        : null,
      montoAutorizado: montoAutorizadoDecimal.toFixed(2),
      efectivoDisponible: efectivoDisponibleDecimal.toFixed(2),
      limitePorComprobante: limitePorComprobanteDecimal.toFixed(2),
      totalAnticiposPendientes: totalAnticiposPendientesDecimal.toFixed(2),
      cantidadAnticiposPendientes: anticipos.length,
      totalComprometido: totalComprometidoDecimal.toFixed(2),
      totalDisponiblePresupuesto: totalDisponiblePresupuestoDecimal.toFixed(2),
      presupuestoPorPartida,
      resumen: {
        totalPresupuestoAsignado: totalPresupuestoDecimal.toFixed(2),
        totalComprometido: totalComprometidoDecimal.toFixed(2),
        totalDisponiblePresupuesto: totalDisponiblePresupuestoDecimal.toFixed(2),
        totalAnticiposPendientes: totalAnticiposPendientesDecimal.toFixed(2),
        cantidadAnticiposPendientes: anticipos.length,
        totalPartidasConfiguradas: presupuestoPorPartida.length,
        estadoCaja: caja ? caja.estado : 'NO_CONFIGURADA',
      },
    };
  }
}
