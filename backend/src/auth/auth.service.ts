import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RolUsuario } from '@prisma/client';

interface LoginAttemptInfo {
  attempts: number;
  lockedUntil?: Date;
}

@Injectable()
export class AuthService {
  private failedAttempts: Map<string, LoginAttemptInfo> = new Map();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  private checkLockout(key: string) {
    const attempt = this.failedAttempts.get(key);
    if (attempt && attempt.lockedUntil) {
      if (new Date() < attempt.lockedUntil) {
        const remainingMinutes = Math.ceil(
          (attempt.lockedUntil.getTime() - Date.now()) / (60 * 1000),
        );
        throw new ForbiddenException(
          `Demasiados intentos fallidos. Cuenta bloqueada temporalmente por ${remainingMinutes} minuto(s).`,
        );
      } else {
        this.failedAttempts.delete(key);
      }
    }
  }

  private registerFailedAttempt(key: string) {
    const current = this.failedAttempts.get(key) || { attempts: 0 };
    current.attempts += 1;
    if (current.attempts >= 5) {
      // Bloquear 15 minutos tras 5 intentos fallidos
      current.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    this.failedAttempts.set(key, current);
  }

  private clearFailedAttempts(key: string) {
    this.failedAttempts.delete(key);
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const lockKey = `${loginDto.username.toLowerCase()}_${ipAddress || 'local'}`;
    this.checkLockout(lockKey);

    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username.trim() },
      include: {
        unidades: {
          include: {
            unit: true,
          },
        },
      },
    });

    if (!user) {
      this.registerFailedAttempt(lockKey);
      await this.auditService.log({
        actorUsername: loginDto.username,
        accion: 'LOGIN_FALLIDO',
        entidad: 'User',
        detalle: { motivo: 'Usuario no encontrado' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!user.activo) {
      await this.auditService.log({
        actorId: user.id,
        actorUsername: user.username,
        accion: 'LOGIN_RECHAZADO',
        entidad: 'User',
        entidadId: user.id,
        detalle: { motivo: 'Usuario desactivado' },
        ipAddress,
        userAgent,
      });
      throw new ForbiddenException('Su cuenta de usuario se encuentra desactivada. Contacte al administrador.');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      this.registerFailedAttempt(lockKey);
      await this.auditService.log({
        actorId: user.id,
        actorUsername: user.username,
        accion: 'LOGIN_FALLIDO',
        entidad: 'User',
        entidadId: user.id,
        detalle: { motivo: 'Contraseña incorrecta' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.clearFailedAttempts(lockKey);

    const payload = {
      sub: user.id,
      username: user.username,
      rol: user.rol,
    };

    const token = this.jwtService.sign(payload);

    await this.auditService.log({
      actorId: user.id,
      actorUsername: user.username,
      accion: 'LOGIN_EXITOSO',
      entidad: 'User',
      entidadId: user.id,
      detalle: { rol: user.rol },
      ipAddress,
      userAgent,
    });

    let accessibleUnits: any[] = [];
    if (user.rol === RolUsuario.ADMINISTRADOR) {
      accessibleUnits = await this.prisma.unit.findMany({
        where: { activo: true },
        orderBy: { codigo: 'asc' },
      });
    } else {
      accessibleUnits = user.unidades.map((u) => u.unit).filter((u) => u.activo);
    }

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombreCompleto: user.nombreCompleto,
        nombres: user.nombres,
        apellidos: user.apellidos,
        carnetIdentidad: user.carnetIdentidad,
        cargo: user.cargo,
        rol: user.rol,
        activo: user.activo,
        unidades: accessibleUnits,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        unidades: {
          include: {
            unit: true,
          },
        },
      },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo.');
    }

    let accessibleUnits: any[] = [];
    if (user.rol === RolUsuario.ADMINISTRADOR) {
      accessibleUnits = await this.prisma.unit.findMany({
        where: { activo: true },
        orderBy: { codigo: 'asc' },
      });
    } else {
      accessibleUnits = user.unidades.map((u) => u.unit).filter((u) => u.activo);
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nombreCompleto: user.nombreCompleto,
      nombres: user.nombres,
      apellidos: user.apellidos,
      carnetIdentidad: user.carnetIdentidad,
      cargo: user.cargo,
      rol: user.rol,
      activo: user.activo,
      unidades: accessibleUnits,
    };
  }
}
