import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoRendicion,
  EstadoAnticipo,
  TipoMovimientoEfectivo,
  RolUsuario,
  Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { AuthenticatedUser } from '../common/decorators';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { CorregirRendicionDto } from './dto/corregir-rendicion.dto';
import {
  AprobarRendicionDto,
  RechazarRendicionDto,
  DevolverRendicionBorradorDto,
} from './dto/aprobar-rechazar.dto';
import {
  getFechaHoyBolivia,
  parseDateOnlyToUtc,
  formatearFechaCortaBolivia,
  formatearFechaLegibleBolivia,
  calcularEstadoPlazo48Horas,
} from '../common/utils/date-utils';
import { montoEnBolivianosLiteral } from '../common/utils/numero-a-letras';

@Injectable()
export class RendicionesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva Rendición de Cuentas (Formulario 002 / Form. 5308).
   */
  async create(dto: CreateRendicionDto, user: AuthenticatedUser) {
    // 1. Obtener y validar anticipo
    const anticipo = await this.prisma.anticipo.findUnique({
      where: { id: dto.anticipoId },
      include: {
        pedido: {
          include: {
            unidad: true,
            partida: true,
          },
        },
        cajaApertura: true,
        rendicion: true,
      },
    });

    if (!anticipo) {
      throw new NotFoundException('El anticipo especificado no existe.');
    }

    if (anticipo.rendicion) {
      throw new ConflictException(
        `El anticipo ya cuenta con una rendición registrada (${anticipo.rendicion.numeroRendicion}).`,
      );
    }

    if (anticipo.estado !== EstadoAnticipo.PENDIENTE) {
      throw new BadRequestException('Solo se pueden rendir anticipos en estado PENDIENTE.');
    }

    // Validar aislamiento multiunidad si es ENCARGADO
    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(anticipo.pedido.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene autorización para operar en la unidad de este anticipo.');
      }
    }

    if (dto.documentos.length === 0) {
      throw new BadRequestException('Debe incluir al menos un documento o factura de descargo.');
    }

    // 2. Validar documentos y calcular totales decimales exactos
    let totalDescargadoDec = new Decimal(0);
    const docData: {
      tipoDocumento: any;
      numeroDocumento: string;
      nitCiEmisor: string;
      razonSocial: string;
      fechaEmision: Date;
      codigoAutorizacion?: string;
      codigoControl?: string;
      partidaId: string;
      importe: Decimal;
      concepto: string;
    }[] = [];

    // Validar partidas habilitadas para la unidad
    const partidasHabilitadas = await this.prisma.unidadPartida.findMany({
      where: {
        unidadId: anticipo.pedido.unidadId,
        activo: true,
      },
      select: { partidaId: true },
    });
    const setPartidasHabilitadas = new Set(partidasHabilitadas.map((p) => p.partidaId));

    for (const doc of dto.documentos) {
      const importeDec = new Decimal(doc.importe);
      if (importeDec.lte(0)) {
        throw new BadRequestException(`El importe del documento ${doc.numeroDocumento} debe ser mayor a 0.`);
      }

      if (!setPartidasHabilitadas.has(doc.partidaId)) {
        throw new BadRequestException(
          `La partida presupuestaria seleccionada en el documento ${doc.numeroDocumento} no está habilitada para esta unidad.`,
        );
      }

      totalDescargadoDec = totalDescargadoDec.plus(importeDec);
      docData.push({
        tipoDocumento: doc.tipoDocumento,
        numeroDocumento: doc.numeroDocumento.trim(),
        nitCiEmisor: doc.nitCiEmisor.trim(),
        razonSocial: doc.razonSocial.trim(),
        fechaEmision: parseDateOnlyToUtc(doc.fechaEmision),
        codigoAutorizacion: doc.codigoAutorizacion?.trim() || null,
        codigoControl: doc.codigoControl?.trim() || null,
        partidaId: doc.partidaId,
        importe: importeDec,
        concepto: doc.concepto.trim(),
      });
    }

    const montoAnticipoDec = new Decimal(anticipo.monto);
    if (totalDescargadoDec.gt(montoAnticipoDec)) {
      throw new BadRequestException(
        `El total descargado (Bs ${totalDescargadoDec.toFixed(2)}) no puede exceder el monto del anticipo recibido (Bs ${montoAnticipoDec.toFixed(2)}).`,
      );
    }

    const montoSobranteDec = montoAnticipoDec.minus(totalDescargadoDec);
    const montoDevueltoDec = dto.montoDevuelto ? new Decimal(dto.montoDevuelto) : new Decimal(0);

    if (montoDevueltoDec.lt(0)) {
      throw new BadRequestException('El monto devuelto no puede ser negativo.');
    }

    if (montoDevueltoDec.gt(montoSobranteDec)) {
      throw new BadRequestException(
        `El monto devuelto a caja (Bs ${montoDevueltoDec.toFixed(2)}) no puede ser mayor al sobrante real (Bs ${montoSobranteDec.toFixed(2)}).`,
      );
    }

    const fechaRendicionStr = dto.fechaRendicion || getFechaHoyBolivia();
    const fechaRendicionUtc = parseDateOnlyToUtc(fechaRendicionStr);

    // 3. Transacción atómica con generación de correlativo secuencial
    return this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.rendicion.findFirst({
        where: { cajaAperturaId: anticipo.cajaAperturaId },
        orderBy: { correlativoRendicion: 'desc' },
        select: { correlativoRendicion: true },
      });

      const correlativo = (ultimo?.correlativoRendicion || 0) + 1;
      const correlativoPad = String(correlativo).padStart(4, '0');
      const numeroRendicion = `REND-002-${anticipo.pedido.unidad.codigo}-${anticipo.pedido.gestion}-${correlativoPad}`;

      const rendicion = await tx.rendicion.create({
        data: {
          numeroRendicion,
          correlativoRendicion: correlativo,
          anticipoId: anticipo.id,
          cajaAperturaId: anticipo.cajaAperturaId,
          unidadId: anticipo.pedido.unidadId,
          gestion: anticipo.pedido.gestion,
          fechaRendicion: fechaRendicionUtc,
          montoAnticipo: montoAnticipoDec,
          totalDescargado: totalDescargadoDec,
          montoSobrante: montoSobranteDec,
          montoDevuelto: montoDevueltoDec,
          estado: EstadoRendicion.BORRADOR,
          observaciones: dto.observaciones?.trim() || null,
          creadoPorUserId: user.id,
          documentos: {
            create: docData,
          },
        },
        include: {
          documentos: {
            include: { partida: true },
          },
          anticipo: {
            include: { pedido: true },
          },
        },
      });

      await tx.auditoria.create({
        data: {
          actorId: user.id,
          actorUsername: user.username,
          accion: 'CREAR_RENDICION_BORRADOR',
          entidad: 'Rendicion',
          entidadId: rendicion.id,
          detalleJson: JSON.stringify({
            numeroRendicion,
            anticipoId: anticipo.id,
            totalDescargado: totalDescargadoDec.toFixed(2),
            montoSobrante: montoSobranteDec.toFixed(2),
          }),
        },
      });

      return rendicion;
    });
  }

  /**
   * Envía la rendición para revisión del rol FINANCIERO.
   */
  async enviar(id: string, user: AuthenticatedUser) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: { anticipo: { include: { pedido: true } } },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición no existe.');
    }

    if (rendicion.estado !== EstadoRendicion.BORRADOR && rendicion.estado !== EstadoRendicion.RECHAZADA) {
      throw new BadRequestException('Solo rendiciones en BORRADOR o RECHAZADA pueden enviarse a aprobación.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para enviar esta rendición.');
      }
    }

    const actualizada = await this.prisma.rendicion.update({
      where: { id },
      data: {
        estado: EstadoRendicion.ENVIADA,
        motivoRechazo: null,
      },
    });

    await this.prisma.auditoria.create({
      data: {
        actorId: user.id,
        actorUsername: user.username,
        accion: 'ENVIAR_RENDICION_A_FINANCIERO',
        entidad: 'Rendicion',
        entidadId: id,
        detalleJson: JSON.stringify({ numeroRendicion: rendicion.numeroRendicion }),
      },
    });

    return actualizada;
  }

  /**
   * Aprobación definitiva por rol FINANCIERO o ADMINISTRADOR.
   * Ejecuta la liquidación de cuentas, devolución de sobrante a caja y consolidación de gasto ejecutado.
   */
  async aprobar(id: string, dto: AprobarRendicionDto, user: AuthenticatedUser) {
    if (
      user.rol !== RolUsuario.FINANCIERO &&
      user.rol !== RolUsuario.ADMINISTRADOR &&
      user.rol !== RolUsuario.ENCARGADO
    ) {
      throw new ForbiddenException('No tiene permisos para aprobar rendiciones de cuentas.');
    }

    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: {
        anticipo: {
          include: {
            pedido: {
              include: {
                unidad: true,
                partida: true,
              },
            },
          },
        },
        documentos: {
          include: { partida: true },
        },
        cajaApertura: true,
      },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición de cuentas no existe.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para aprobar la rendición de esta unidad.');
      }
    }

    if (rendicion.estado === EstadoRendicion.APROBADA) {
      throw new ConflictException('Esta rendición ya fue aprobada previamente.');
    }

    return this.prisma.$transaction(async (tx) => {
      const fechaAprobacion = new Date();

      // 1. Si hubo sobrante devuelto físicamente a caja, registrar entrada de efectivo
      const montoDevueltoDec = new Decimal(rendicion.montoDevuelto);
      if (montoDevueltoDec.gt(0)) {
        await tx.movimientoEfectivo.create({
          data: {
            cajaAperturaId: rendicion.cajaAperturaId,
            tipo: TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE,
            monto: montoDevueltoDec,
            fecha: fechaAprobacion,
            descripcion: `Devolución de sobrante por Rendición ${rendicion.numeroRendicion}`,
            comprobanteReferencia: rendicion.numeroRendicion,
            actorId: user.id,
            rendicionId: rendicion.id,
          },
        });
      }

      // 2. Actualizar estado del Anticipo a RENDIDO
      await tx.anticipo.update({
        where: { id: rendicion.anticipoId },
        data: { estado: EstadoAnticipo.RENDIDO },
      });

      // 3. Generar instantánea JSON inmutable para reimpresiones históricas exactas
      const snapshot = {
        numeroRendicion: rendicion.numeroRendicion,
        correlativo: rendicion.correlativoRendicion,
        fechaRendicion: formatearFechaCortaBolivia(rendicion.fechaRendicion),
        fechaRendicionTexto: formatearFechaLegibleBolivia(rendicion.fechaRendicion),
        fechaAprobacion: formatearFechaCortaBolivia(fechaAprobacion),
        unidad: {
          id: rendicion.anticipo.pedido.unidad.id,
          codigo: rendicion.anticipo.pedido.unidad.codigo,
          nombre: rendicion.anticipo.pedido.unidad.nombre,
        },
        gestion: rendicion.gestion,
        anticipo: {
          id: rendicion.anticipo.id,
          numeroVale: rendicion.anticipo.numeroVale,
          monto: new Decimal(rendicion.montoAnticipo).toFixed(2),
          montoLiteral: montoEnBolivianosLiteral(new Decimal(rendicion.montoAnticipo)),
        },
        solicitante: {
          nombreCompleto: `${rendicion.anticipo.pedido.solicitanteNombres} ${rendicion.anticipo.pedido.solicitanteApellidos}`,
          ci: rendicion.anticipo.pedido.solicitanteCi,
          area: rendicion.anticipo.pedido.solicitanteArea,
        },
        documentos: rendicion.documentos.map((d, index) => ({
          nro: index + 1,
          tipo: d.tipoDocumento,
          numero: d.numeroDocumento,
          nit: d.nitCiEmisor,
          razonSocial: d.razonSocial,
          fecha: formatearFechaCortaBolivia(d.fechaEmision),
          partidaCodigo: d.partida.codigo,
          partidaDescripcion: d.partida.descripcion,
          concepto: d.concepto,
          importe: new Decimal(d.importe).toFixed(2),
        })),
        totales: {
          montoAnticipo: new Decimal(rendicion.montoAnticipo).toFixed(2),
          totalDescargado: new Decimal(rendicion.totalDescargado).toFixed(2),
          montoSobrante: new Decimal(rendicion.montoSobrante).toFixed(2),
          montoDevuelto: new Decimal(rendicion.montoDevuelto).toFixed(2),
        },
        aprobador: {
          id: user.id,
          username: user.username,
          nombreCompleto: user.nombreCompleto,
          rol: user.rol,
        },
      };

      // 4. Actualizar estado de Rendición
      const aprobada = await tx.rendicion.update({
        where: { id },
        data: {
          estado: EstadoRendicion.APROBADA,
          aprobadoPorUserId: user.id,
          fechaAprobacion,
          datosRendicionJson: JSON.stringify(snapshot),
          observaciones: dto.observaciones
            ? `${rendicion.observaciones ? rendicion.observaciones + ' | ' : ''}Aprobación Financiera: ${dto.observaciones}`
            : rendicion.observaciones,
        },
      });

      // 5. Auditoría
      await tx.auditoria.create({
        data: {
          actorId: user.id,
          actorUsername: user.username,
          accion: 'APROBAR_RENDICION_FINANCIERO',
          entidad: 'Rendicion',
          entidadId: id,
          detalleJson: JSON.stringify({
            numeroRendicion: rendicion.numeroRendicion,
            totalDescargado: rendicion.totalDescargado,
            montoDevuelto: rendicion.montoDevuelto,
          }),
        },
      });

      return aprobada;
    });
  }

  /**
   * Rechaza la rendición con observaciones para subsanación.
   */
  async rechazar(id: string, dto: RechazarRendicionDto, user: AuthenticatedUser) {
    if (
      user.rol !== RolUsuario.FINANCIERO &&
      user.rol !== RolUsuario.ADMINISTRADOR &&
      user.rol !== RolUsuario.ENCARGADO
    ) {
      throw new ForbiddenException('No tiene permisos para rechazar rendiciones de cuentas.');
    }

    const rendicion = await this.prisma.rendicion.findUnique({ where: { id } });
    if (!rendicion) {
      throw new NotFoundException('La rendición no existe.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para rechazar la rendición de esta unidad.');
      }
    }

    if (rendicion.estado === EstadoRendicion.APROBADA) {
      throw new BadRequestException('No se puede rechazar una rendición que ya fue aprobada.');
    }

    const actualizada = await this.prisma.rendicion.update({
      where: { id },
      data: {
        estado: EstadoRendicion.RECHAZADA,
        motivoRechazo: dto.motivoRechazo.trim(),
      },
    });

    await this.prisma.auditoria.create({
      data: {
        actorId: user.id,
        actorUsername: user.username,
        accion: 'RECHAZAR_RENDICION_FINANCIERO',
        entidad: 'Rendicion',
        entidadId: id,
        detalleJson: JSON.stringify({
          numeroRendicion: rendicion.numeroRendicion,
          motivoRechazo: dto.motivoRechazo,
        }),
      },
    });

    return actualizada;
  }

  /**
   * Devuelve una rendición enviada o rechazada a estado BORRADOR para subsanación o corrección.
   */
  async devolverABorrador(id: string, dto: DevolverRendicionBorradorDto, user: AuthenticatedUser) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición no existe.');
    }

    if (rendicion.estado === EstadoRendicion.APROBADA) {
      throw new BadRequestException('No se puede devolver a borrador una rendición que ya fue aprobada definitivamente.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para modificar esta rendición.');
      }
    }

    const obsAnteriores = rendicion.observaciones ? `${rendicion.observaciones} | ` : '';
    const nuevaObservacion = `${obsAnteriores}[Devuelto a borrador por ${user.username}: ${dto.motivoDevolucion.trim()}]`;

    const actualizada = await this.prisma.rendicion.update({
      where: { id },
      data: {
        estado: EstadoRendicion.BORRADOR,
        motivoRechazo: null,
        observaciones: nuevaObservacion,
      },
    });

    await this.prisma.auditoria.create({
      data: {
        actorId: user.id,
        actorUsername: user.username,
        accion: 'DEVOLVER_RENDICION_A_BORRADOR',
        entidad: 'Rendicion',
        entidadId: id,
        detalleJson: JSON.stringify({
          numeroRendicion: rendicion.numeroRendicion,
          estadoAnterior: rendicion.estado,
          motivoDevolucion: dto.motivoDevolucion.trim(),
        }),
      },
    });

    return {
      message: 'Rendición devuelta a estado BORRADOR exitosamente para su corrección.',
      rendicion: actualizada,
    };
  }

  /**
   * Elimina una rendición en estado BORRADOR o RECHAZADA para permitir re-registro limpio.
   */
  async eliminarBorrador(id: string, user: AuthenticatedUser) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: { documentos: true },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición no existe.');
    }

    if (rendicion.estado === EstadoRendicion.APROBADA) {
      throw new BadRequestException('No se puede eliminar una rendición que ya fue aprobada.');
    }

    if (rendicion.estado === EstadoRendicion.ENVIADA && user.rol === RolUsuario.ENCARGADO) {
      throw new BadRequestException(
        'La rendición se encuentra ENVIADA. Debe solicitar su devolución a borrador antes de poder eliminarla.',
      );
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para eliminar esta rendición.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Eliminar documentos de descargo vinculados
      await tx.documentoDescargo.deleteMany({
        where: { rendicionId: id },
      });

      // Eliminar rendición
      await tx.rendicion.delete({
        where: { id },
      });

      await tx.auditoria.create({
        data: {
          actorId: user.id,
          actorUsername: user.username,
          accion: 'ELIMINAR_RENDICION_BORRADOR',
          entidad: 'Rendicion',
          entidadId: id,
          detalleJson: JSON.stringify({
            numeroRendicion: rendicion.numeroRendicion,
            anticipoId: rendicion.anticipoId,
            totalDescargado: rendicion.totalDescargado,
            cantidadDocumentos: rendicion.documentos.length,
          }),
        },
      });
    });

    return {
      message: `Rendición ${rendicion.numeroRendicion} eliminada correctamente. El anticipo ha sido liberado para una nueva rendición.`,
    };
  }

  /**
   * Listado de rendiciones con filtros y cómputo de 48 horas hábiles administrativas.
   */
  async findAll(unidadId: string, gestion: number, user: AuthenticatedUser) {
    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para consultar rendiciones de esta unidad.');
      }
    }

    const rendiciones = await this.prisma.rendicion.findMany({
      where: {
        unidadId,
        gestion,
      },
      include: {
        anticipo: {
          include: {
            pedido: true,
          },
        },
        documentos: {
          include: { partida: true },
        },
        creadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
        aprobadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
      },
      orderBy: { correlativoRendicion: 'desc' },
    });

    // Calcular estado de plazo para anticipos vinculados
    return rendiciones.map((r) => {
      const plazoInfo = calcularEstadoPlazo48Horas(
        r.anticipo.fechaEntrega,
        r.fechaRendicion || new Date(),
        48,
      );
      return {
        ...r,
        plazo48Horas: plazoInfo,
      };
    });
  }

  /**
   * Obtiene una rendición por ID con detalles completos.
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: {
        anticipo: {
          include: {
            pedido: {
              include: {
                unidad: true,
                partida: true,
              },
            },
          },
        },
        documentos: {
          include: { partida: true },
        },
        creadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
        aprobadoPor: {
          select: { id: true, nombreCompleto: true, username: true },
        },
        cajaApertura: {
          include: { responsable: true },
        },
      },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición de cuentas no existe.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para acceder a esta rendición.');
      }
    }

    const plazoInfo = calcularEstadoPlazo48Horas(
      rendicion.anticipo.fechaEntrega,
      rendicion.fechaRendicion,
      48,
    );

    return {
      ...rendicion,
      plazo48Horas: plazoInfo,
    };
  }

  /**
   * Estructura los datos de reporte para el motor de impresión dual:
   * 1. Modo plantilla preimpresa (coordenadas milimétricas para inyección exacta sobre papel físico preimpreso).
   * 2. Modo hoja blanca completa (grilla con encabezados institucionales).
   */
  async getDatosReporteImpresion(id: string, user: AuthenticatedUser) {
    const r = await this.findOne(id, user);

    const solCompleto = `${r.anticipo.pedido.solicitanteNombres} ${r.anticipo.pedido.solicitanteApellidos}`;
    const montoLiteral = montoEnBolivianosLiteral(new Decimal(r.montoAnticipo));

    // Coordenadas milimétricas base para el formulario preimpreso (Form. 002 / 5308)
    const coordenadasPreimpreso = {
      unidadNombre: { topMm: 38, leftMm: 30, widthMm: 80 },
      gestion: { topMm: 38, leftMm: 175, widthMm: 25 },
      numeroRendicion: { topMm: 45, leftMm: 160, widthMm: 40 },
      fechaRendicion: { topMm: 45, leftMm: 30, widthMm: 45 },
      solicitante: { topMm: 52, leftMm: 35, widthMm: 100 },
      numeroVale: { topMm: 52, leftMm: 160, widthMm: 40 },
      montoAnticipoCifras: { topMm: 60, leftMm: 40, widthMm: 35 },
      montoAnticipoLetras: { topMm: 60, leftMm: 85, widthMm: 115 },
      // Filas de la tabla de documentos
      tablaInicioTopMm: 78,
      filaAltoMm: 8,
      columnas: {
        item: { leftMm: 15, widthMm: 10 },
        fecha: { leftMm: 26, widthMm: 22 },
        facturaNro: { leftMm: 49, widthMm: 22 },
        nitCi: { leftMm: 72, widthMm: 25 },
        proveedor: { leftMm: 98, widthMm: 45 },
        partida: { leftMm: 144, widthMm: 18 },
        importe: { leftMm: 163, widthMm: 35 },
      },
      // Totales pie de página
      totalDescargado: { topMm: 225, leftMm: 163, widthMm: 35 },
      montoSobrante: { topMm: 233, leftMm: 163, widthMm: 35 },
      montoDevuelto: { topMm: 241, leftMm: 163, widthMm: 35 },
      // Firmas
      firmaEncargado: { topMm: 258, leftMm: 25, widthMm: 50 },
      firmaSolicitante: { topMm: 258, leftMm: 85, widthMm: 50 },
      firmaFinanciero: { topMm: 258, leftMm: 145, widthMm: 50 },
    };

    return {
      rendicion: {
        id: r.id,
        numeroRendicion: r.numeroRendicion,
        correlativo: r.correlativoRendicion,
        fechaRendicion: formatearFechaCortaBolivia(r.fechaRendicion),
        fechaRendicionTexto: formatearFechaLegibleBolivia(r.fechaRendicion),
        estado: r.estado,
        unidad: {
          codigo: r.anticipo.pedido.unidad.codigo,
          nombre: r.anticipo.pedido.unidad.nombre,
        },
        gestion: r.gestion,
        solicitante: {
          nombreCompleto: solCompleto,
          ci: r.anticipo.pedido.solicitanteCi,
          area: r.anticipo.pedido.solicitanteArea,
        },
        anticipo: {
          numeroVale: r.anticipo.numeroVale,
          monto: new Decimal(r.montoAnticipo).toFixed(2),
          montoLiteral,
        },
        documentos: r.documentos.map((d, idx) => ({
          item: idx + 1,
          tipo: d.tipoDocumento,
          numeroDocumento: d.numeroDocumento,
          nitCiEmisor: d.nitCiEmisor,
          razonSocial: d.razonSocial,
          fechaEmision: formatearFechaCortaBolivia(d.fechaEmision),
          partidaCodigo: d.partida.codigo,
          partidaDescripcion: d.partida.descripcion,
          concepto: d.concepto,
          importe: new Decimal(d.importe).toFixed(2),
        })),
        totales: {
          montoAnticipo: new Decimal(r.montoAnticipo).toFixed(2),
          totalDescargado: new Decimal(r.totalDescargado).toFixed(2),
          montoSobrante: new Decimal(r.montoSobrante).toFixed(2),
          montoDevuelto: new Decimal(r.montoDevuelto).toFixed(2),
        },
        firmas: {
          encargadoNombre: r.creadoPor.nombreCompleto,
          solicitanteNombre: solCompleto,
          financieroNombre: r.aprobadoPor?.nombreCompleto || 'Dirección Administrativa Financiera (DAF)',
        },
      },
      coordenadasPreimpreso,
    };
  }

  /**
   * Corrección integral de la rendición de cuentas (Fase de pruebas / Auditable).
   * Permite modificar encabezado (fecha, observaciones, efectivo devuelto) y documentos de descargo (facturas/recibos).
   */
  async corregir(id: string, dto: CorregirRendicionDto, user: AuthenticatedUser) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: {
        anticipo: {
          include: {
            pedido: {
              include: {
                unidad: true,
                partida: true,
              },
            },
          },
        },
        documentos: {
          include: { partida: true },
        },
        cajaApertura: true,
      },
    });

    if (!rendicion) {
      throw new NotFoundException('La rendición de cuentas no existe.');
    }

    if (user.rol === RolUsuario.ENCARGADO) {
      const hasAccess = user.unidades && user.unidades.includes(rendicion.unidadId);
      if (!hasAccess) {
        throw new ForbiddenException('No tiene permisos para modificar la rendición de esta unidad.');
      }
    }

    const montoAnticipoDec = new Decimal(rendicion.montoAnticipo.toString());
    let totalDescargadoDec = new Decimal(rendicion.totalDescargado.toString());

    // 1. Validar documentos si se enviaron
    let docData: {
      tipoDocumento: any;
      numeroDocumento: string;
      nitCiEmisor: string;
      razonSocial: string;
      fechaEmision: Date;
      codigoAutorizacion?: string | null;
      codigoControl?: string | null;
      partidaId: string;
      importe: Decimal;
      concepto: string;
    }[] | null = null;

    if (dto.documentos) {
      if (dto.documentos.length === 0) {
        throw new BadRequestException('La rendición debe contener al menos un documento o factura de descargo.');
      }

      const partidasHabilitadas = await this.prisma.unidadPartida.findMany({
        where: {
          unidadId: rendicion.unidadId,
          activo: true,
        },
        select: { partidaId: true },
      });
      const setPartidasHabilitadas = new Set(partidasHabilitadas.map((p) => p.partidaId));

      totalDescargadoDec = new Decimal(0);
      docData = [];

      for (const doc of dto.documentos) {
        const importeDec = new Decimal(doc.importe);
        if (importeDec.lte(0)) {
          throw new BadRequestException(`El importe del documento ${doc.numeroDocumento} debe ser mayor a 0.`);
        }

        if (!setPartidasHabilitadas.has(doc.partidaId)) {
          throw new BadRequestException(
            `La partida presupuestaria seleccionada en el documento ${doc.numeroDocumento} no está habilitada para esta unidad.`,
          );
        }

        totalDescargadoDec = totalDescargadoDec.plus(importeDec);
        docData.push({
          tipoDocumento: doc.tipoDocumento,
          numeroDocumento: doc.numeroDocumento.trim(),
          nitCiEmisor: doc.nitCiEmisor.trim(),
          razonSocial: doc.razonSocial.trim(),
          fechaEmision: parseDateOnlyToUtc(doc.fechaEmision),
          codigoAutorizacion: doc.codigoAutorizacion?.trim() || null,
          codigoControl: doc.codigoControl?.trim() || null,
          partidaId: doc.partidaId,
          importe: importeDec,
          concepto: doc.concepto.trim(),
        });
      }

      if (totalDescargadoDec.gt(montoAnticipoDec)) {
        throw new BadRequestException(
          `El total descargado (Bs ${totalDescargadoDec.toFixed(2)}) no puede exceder el monto del anticipo recibido (Bs ${montoAnticipoDec.toFixed(2)}).`,
        );
      }
    }

    const montoSobranteDec = montoAnticipoDec.minus(totalDescargadoDec);
    let montoDevueltoDec = dto.montoDevuelto !== undefined
      ? new Decimal(dto.montoDevuelto)
      : new Decimal(rendicion.montoDevuelto.toString());

    if (montoDevueltoDec.lt(0)) {
      throw new BadRequestException('El monto devuelto no puede ser negativo.');
    }

    if (montoDevueltoDec.gt(montoSobranteDec)) {
      throw new BadRequestException(
        `El monto devuelto a caja (Bs ${montoDevueltoDec.toFixed(2)}) no puede ser mayor al sobrante real (Bs ${montoSobranteDec.toFixed(2)}).`,
      );
    }

    const fechaRendicionUtc = dto.fechaRendicion
      ? parseDateOnlyToUtc(dto.fechaRendicion)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      // Si se enviaron documentos, reemplazar los existentes de manera atómica
      if (docData) {
        await tx.documentoDescargo.deleteMany({
          where: { rendicionId: id },
        });

        await tx.documentoDescargo.createMany({
          data: docData.map((d) => ({
            rendicionId: id,
            tipoDocumento: d.tipoDocumento,
            numeroDocumento: d.numeroDocumento,
            nitCiEmisor: d.nitCiEmisor,
            razonSocial: d.razonSocial,
            fechaEmision: d.fechaEmision,
            codigoAutorizacion: d.codigoAutorizacion,
            codigoControl: d.codigoControl,
            partidaId: d.partidaId,
            importe: new Prisma.Decimal(d.importe.toFixed(2)),
            concepto: d.concepto,
          })),
        });
      }

      const actualizada = await tx.rendicion.update({
        where: { id },
        data: {
          ...(fechaRendicionUtc ? { fechaRendicion: fechaRendicionUtc } : {}),
          totalDescargado: new Prisma.Decimal(totalDescargadoDec.toFixed(2)),
          montoSobrante: new Prisma.Decimal(montoSobranteDec.toFixed(2)),
          montoDevuelto: new Prisma.Decimal(montoDevueltoDec.toFixed(2)),
          ...(dto.observaciones !== undefined ? { observaciones: dto.observaciones?.trim() || null } : {}),
        },
        include: {
          documentos: {
            include: { partida: true },
          },
          anticipo: {
            include: {
              pedido: {
                include: {
                  unidad: true,
                  partida: true,
                },
              },
            },
          },
        },
      });

      // Sincronizar movimiento de efectivo (sobrante devuelto) si existiera o si la rendición fue aprobada
      const movExistente = await tx.movimientoEfectivo.findFirst({
        where: { rendicionId: id },
      });

      if (montoDevueltoDec.gt(0)) {
        if (movExistente) {
          await tx.movimientoEfectivo.update({
            where: { id: movExistente.id },
            data: {
              monto: new Prisma.Decimal(montoDevueltoDec.toFixed(2)),
              descripcion: `Devolución de sobrante rectificado por Rendición ${rendicion.numeroRendicion}`,
            },
          });
        } else if (rendicion.estado === EstadoRendicion.APROBADA) {
          await tx.movimientoEfectivo.create({
            data: {
              cajaAperturaId: rendicion.cajaAperturaId,
              tipo: TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE,
              monto: new Prisma.Decimal(montoDevueltoDec.toFixed(2)),
              fecha: new Date(),
              descripcion: `Devolución de sobrante rectificado por Rendición ${rendicion.numeroRendicion}`,
              comprobanteReferencia: rendicion.numeroRendicion,
              actorId: user.id,
              rendicionId: rendicion.id,
            },
          });
        }
      } else if (movExistente) {
        await tx.movimientoEfectivo.delete({
          where: { id: movExistente.id },
        });
      }

      // Si la rendición tenía snapshot previo, actualizarlo con los datos corregidos para impresión
      if (rendicion.datosRendicionJson) {
        try {
          const snap = JSON.parse(rendicion.datosRendicionJson);
          snap.fechaRendicion = formatearFechaCortaBolivia(actualizada.fechaRendicion);
          snap.fechaRendicionTexto = formatearFechaLegibleBolivia(actualizada.fechaRendicion);
          snap.documentos = actualizada.documentos.map((d, index) => ({
            nro: index + 1,
            tipo: d.tipoDocumento,
            numero: d.numeroDocumento,
            nit: d.nitCiEmisor,
            razonSocial: d.razonSocial,
            fecha: formatearFechaCortaBolivia(d.fechaEmision),
            partidaCodigo: d.partida.codigo,
            partidaDescripcion: d.partida.descripcion,
            concepto: d.concepto,
            importe: new Decimal(d.importe.toString()).toFixed(2),
          }));
          snap.totales = {
            montoAnticipo: new Decimal(actualizada.montoAnticipo.toString()).toFixed(2),
            totalDescargado: totalDescargadoDec.toFixed(2),
            montoSobrante: montoSobranteDec.toFixed(2),
            montoDevuelto: montoDevueltoDec.toFixed(2),
          };

          await tx.rendicion.update({
            where: { id },
            data: { datosRendicionJson: JSON.stringify(snap) },
          });
        } catch (e) {
          // Ignorar error de parsing si el snapshot era inválido
        }
      }

      await tx.auditoria.create({
        data: {
          actorId: user.id,
          actorUsername: user.username,
          accion: 'CORREGIR_RENDICION',
          entidad: 'Rendicion',
          entidadId: id,
          detalleJson: JSON.stringify({
            numeroRendicion: rendicion.numeroRendicion,
            estado: rendicion.estado,
            justificacion: dto.justificacion.trim(),
            totalDescargadoAnterior: rendicion.totalDescargado.toString(),
            totalDescargadoNuevo: totalDescargadoDec.toFixed(2),
            montoDevueltoAnterior: rendicion.montoDevuelto.toString(),
            montoDevueltoNuevo: montoDevueltoDec.toFixed(2),
            cantidadDocumentos: actualizada.documentos.length,
          }),
        },
      });

      return {
        message: 'Rendición de cuentas corregida exitosamente.',
        rendicion: {
          ...actualizada,
          montoAnticipo: actualizada.montoAnticipo.toFixed(2),
          totalDescargado: actualizada.totalDescargado.toFixed(2),
          montoSobrante: actualizada.montoSobrante.toFixed(2),
          montoDevuelto: actualizada.montoDevuelto.toFixed(2),
        },
      };
    });
  }
}
