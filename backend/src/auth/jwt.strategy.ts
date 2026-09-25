import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['caja_session'];
          }
          if (!token && request.headers.authorization) {
            const parts = request.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
              token = parts[1];
            }
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'CPS_DEFAULT_SECRET_KEY_2026',
    });
  }

  async validate(payload: { sub: string; username: string }): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        unidades: {
          select: {
            unitId: true,
          },
        },
      },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario no válido o deshabilitado.');
    }

    return {
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombreCompleto,
      rol: user.rol,
      unidades: user.unidades.map((u) => u.unitId),
    };
  }
}
