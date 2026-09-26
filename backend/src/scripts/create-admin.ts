import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prompts = require('prompts');

// Cargar explícitamente backend/.env usando ruta absoluta resuelta desde este script
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Validar que DATABASE_URL exista antes de inicializar Prisma
if (!process.env.DATABASE_URL) {
  console.error('\n================================================================');
  console.error(' ERROR DE CONFIGURACIÓN');
  console.error('================================================================');
  console.error('No se encontró la variable DATABASE_URL en backend/.env.');
  console.error('Verifique que el archivo exista y contenga los parámetros requeridos.\n');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('================================================================');
  console.log(' CAJA PETROLERA DE SALUD - CREACIÓN DE ADMINISTRADOR INICIAL    ');
  console.log('================================================================');

  // Validar conexión con PostgreSQL antes de solicitar datos al usuario
  try {
    process.stdout.write('Verificando conexión con PostgreSQL... ');
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('[OK]\n');
  } catch {
    console.log('[FALLO]');
    console.error('\n================================================================');
    console.error(' ERROR DE CONEXIÓN A LA BASE DE DATOS');
    console.error('================================================================');
    console.error('No se pudo conectar con el servidor PostgreSQL.');
    console.error('Verifique que el servicio esté activo y los parámetros locales sean válidos.\n');
    process.exit(1);
  }

  try {
    const args = process.argv.slice(2);
    let username = '';
    let nombreCompleto = '';
    let email = '';
    let password = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--username' && args[i + 1]) username = args[i + 1];
      if (args[i] === '--name' && args[i + 1]) nombreCompleto = args[i + 1];
      if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
      if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
    }

    const questions: any[] = [];

    if (!username) {
      questions.push({
        type: 'text',
        name: 'username',
        message: 'Ingrese el nombre de usuario (ej. admin):',
        validate: (val: string) => (val && val.trim().length > 0 ? true : 'El nombre de usuario no puede estar vacío.'),
      });
    }

    if (!nombreCompleto) {
      questions.push({
        type: 'text',
        name: 'nombreCompleto',
        message: 'Ingrese el nombre completo del administrador:',
        validate: (val: string) => (val && val.trim().length > 0 ? true : 'El nombre completo no puede estar vacío.'),
      });
    }

    if (!email) {
      questions.push({
        type: 'text',
        name: 'email',
        message: 'Ingrese correo electrónico institucional (opcional):',
      });
    }

    if (!password) {
      questions.push({
        type: 'password',
        name: 'password',
        message: 'Ingrese la contraseña para el administrador:',
        validate: (val: string) => (val && val.length >= 6 ? true : 'La contraseña debe tener al menos 6 caracteres.'),
      });

      questions.push({
        type: 'password',
        name: 'confirmPassword',
        message: 'Confirme la contraseña:',
        validate: (val: string, answers: any) =>
          val === answers.password ? true : 'Las contraseñas no coinciden.',
      });
    }

    const answers = await prompts(questions, {
      onCancel: () => {
        console.log('\n\nOperación cancelada por el usuario.\n');
        process.exit(0);
      },
    });

    // Consolidar valores ingresados
    username = username || (answers.username ? answers.username.trim() : '');
    nombreCompleto = nombreCompleto || (answers.nombreCompleto ? answers.nombreCompleto.trim() : '');
    email = email || (answers.email ? answers.email.trim() : '');
    password = password || answers.password;

    if (!username || !nombreCompleto || !password) {
      console.log('\nOperación incompleta. Cancelando sin realizar cambios.');
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      console.log(`\nEl usuario "${username}" ya existe en la base de datos.`);
      const confirmPrompt = await prompts(
        {
          type: 'confirm',
          name: 'confirmed',
          message: '¿Desea restablecer su contraseña y asegurar rol ADMINISTRADOR?',
          initial: false,
        },
        {
          onCancel: () => {
            console.log('\nOperación cancelada por el usuario.\n');
            process.exit(0);
          },
        },
      );

      if (confirmPrompt.confirmed) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            rol: RolUsuario.ADMINISTRADOR,
            activo: true,
            nombreCompleto: nombreCompleto || existing.nombreCompleto,
            email: email || existing.email,
          },
        });

        await prisma.auditoria.create({
          data: {
            actorUsername: 'CLI_SETUP',
            accion: 'RESTABLECER_ADMIN',
            entidad: 'User',
            entidadId: existing.id,
            detalleJson: JSON.stringify({
              username: existing.username,
              rol: RolUsuario.ADMINISTRADOR,
              origen: 'create-admin script (prompts)',
            }),
          },
        });

        console.log(`\n================================================================`);
        console.log(`✓ Administrador "${username}" actualizado exitosamente.`);
        console.log(`✓ Nueva contraseña cifrada con bcrypt (10 rondas de salt).`);
        console.log(`✓ Registro de auditoría guardado.`);
        console.log(`================================================================\n`);
      } else {
        console.log('\nOperación cancelada. El usuario no fue modificado.');
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const created = await prisma.user.create({
      data: {
        username,
        nombreCompleto,
        email: email || null,
        passwordHash,
        rol: RolUsuario.ADMINISTRADOR,
        activo: true,
      },
    });

    // Registrar en auditoría institucional
    await prisma.auditoria.create({
      data: {
        actorUsername: 'CLI_SETUP',
        accion: 'CREAR_ADMIN_INICIAL',
        entidad: 'User',
        entidadId: created.id,
        detalleJson: JSON.stringify({
          username: created.username,
          rol: created.rol,
          origen: 'create-admin script (prompts)',
        }),
      },
    });

    console.log('\n================================================================');
    console.log(`✓ Usuario Administrador creado satisfactoriamente: [${created.username}]`);
    console.log(`✓ Rol asignado: ADMINISTRADOR`);
    console.log(`✓ Contraseña cifrada con bcrypt (10 rondas de salt).`);
    console.log(`✓ Registro de auditoría guardado.`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('Error al procesar la operación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
