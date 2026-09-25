import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogParams {
  actorId?: string | null;
  actorUsername?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  detalle?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));

    const sensitiveKeys = [
      'password',
      'passwordHash',
      'contrasena',
      'token',
      'secret',
      'authorization',
      'cookie',
      'caja_session',
      'jwt',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        sanitized[key] = '[REDACTADO_POR_SEGURIDAD]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      const sanitizedDetail = params.detalle ? this.sanitize(params.detalle) : null;
      await this.prisma.auditoria.create({
        data: {
          actorId: params.actorId || null,
          actorUsername: params.actorUsername || 'SISTEMA',
          accion: params.accion,
          entidad: params.entidad,
          entidadId: params.entidadId || null,
          detalleJson: sanitizedDetail ? JSON.stringify(sanitizedDetail) : null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent ? params.userAgent.substring(0, 500) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Error al registrar auditoría para acción ${params.accion}: ${error.message}`);
    }
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    entidad?: string;
    accion?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.entidad) where.entidad = params.entidad;
    if (params.accion) where.accion = { contains: params.accion, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
