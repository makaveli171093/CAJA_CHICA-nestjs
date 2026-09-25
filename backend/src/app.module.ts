import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UnitsModule } from './units/units.module';
import { ResponsablesModule } from './responsables/responsables.module';
import { PartidasModule } from './partidas/partidas.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { AperturaModule } from './apertura/apertura.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('THROTTLE_TTL') || 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT') || 30,
        },
      ],
      inject: [ConfigService],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    UnitsModule,
    ResponsablesModule,
    PartidasModule,
    PresupuestosModule,
    AperturaModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
