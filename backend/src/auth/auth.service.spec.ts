import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';

describe('AuthService (Seguridad y Control de Acceso)', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let audit: any;

  const mockUser = {
    id: 'user-uuid-1',
    username: 'operador1',
    passwordHash: '',
    nombreCompleto: 'Operador Uno',
    email: 'operador1@cps.org.bo',
    rol: RolUsuario.ENCARGADO,
    activo: true,
    unidades: [{ unit: { id: 'unit-1', codigo: 'LP-ADM', nombre: 'La Paz' } }],
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('PasswordSegura#2026', 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('debe permitir inicio de sesión válido y devolver token seguro', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.login({
      username: 'operador1',
      password: 'PasswordSegura#2026',
    });

    expect(result).toHaveProperty('token', 'mock-jwt-token');
    expect(result.user.username).toBe('operador1');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_EXITOSO' }),
    );
  });

  it('debe rechazar contraseña incorrecta con UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.login({
        username: 'operador1',
        password: 'PasswordEquivocada',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_FALLIDO' }),
    );
  });

  it('debe rechazar acceso a usuario desactivado con ForbiddenException', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      activo: false,
    });

    await expect(
      service.login({
        username: 'operador1',
        password: 'PasswordSegura#2026',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_RECHAZADO' }),
    );
  });

  it('debe bloquear temporalmente tras 5 intentos fallidos consecutivos', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    // 4 intentos fallidos
    for (let i = 0; i < 4; i++) {
      await expect(
        service.login({ username: 'bruteforce_user', password: 'bad' }, '192.168.1.1'),
      ).rejects.toThrow(UnauthorizedException);
    }

    // 5to intento fallido
    await expect(
      service.login({ username: 'bruteforce_user', password: 'bad' }, '192.168.1.1'),
    ).rejects.toThrow(UnauthorizedException);

    // 6to intento debe dar bloqueo temporal con ForbiddenException
    await expect(
      service.login({ username: 'bruteforce_user', password: 'bad' }, '192.168.1.1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
