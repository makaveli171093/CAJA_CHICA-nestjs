import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Middleware para lectura de cookies de sesión HttpOnly
  app.use(cookieParser());

  // Configuración de CORS segura
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Prefijo global para la API REST
  app.setGlobalPrefix('api');

  // Validación global estricta de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // Swagger / OpenAPI condicional (protegido/deshabilitado en producción)
  const swaggerEnabled =
    !isProduction || process.env.SWAGGER_ENABLED === 'true';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Caja Chica Multiunidad API - CPS')
      .setDescription(
        'Documentación y especificación de endpoints REST para la gestión de fondos de Caja Chica institucional - Caja Petrolera de Salud (Fase 1).',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth('caja_session')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('Documentación Swagger OpenAPI habilitada en: /api/docs');
  } else {
    logger.log('Swagger deshabilitado en este entorno por directiva de seguridad.');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Servidor Backend ejecutándose en: http://localhost:${port}/api`);
}

bootstrap();
