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
import { PedidosModule } from './pedidos/pedidos.module';
import { RendicionesModule } from './rendiciones/rendiciones.module';
import { ReposicionesModule } from './reposiciones/reposiciones.module';
import { ArqueosModule } from './arqueos/arqueos.module';
import { ReportesModule } from './reportes/reportes.module';

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
    PedidosModule,
    RendicionesModule,
    ReposicionesModule,
    ArqueosModule,
    ReportesModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
