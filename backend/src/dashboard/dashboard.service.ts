import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario, EstadoCajaApertura } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (currentUser.rol === RolUsuario.ADMINISTRADOR) return;
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
    const presupuestos = await this.prisma.presupuestoPartida.findMany({
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
    });

    let totalPresupuestoDecimal = new Decimal('0.00');
    const presupuestoPorPartida = presupuestos.map((p) => {
      const pDecimal = new Decimal(p.montoAsignado.toString());
      totalPresupuestoDecimal = totalPresupuestoDecimal.plus(pDecimal);
      return {
        id: p.id,
        partidaId: p.partidaId,
        partidaCodigo: p.partida.codigo,
        partidaDescripcion: p.partida.descripcion,
        montoAsignado: p.montoAsignado.toFixed(2),
      };
    });

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
      presupuestoPorPartida,
      resumen: {
        totalPresupuestoAsignado: totalPresupuestoDecimal.toFixed(2),
        totalPartidasConfiguradas: presupuestoPorPartida.length,
        estadoCaja: caja ? caja.estado : 'NO_CONFIGURADA',
      },
    };
  }
}
