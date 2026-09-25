import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

function prompt(query: string, hide = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hide) {
      // Ocultar caracteres o imprimir indicador para contraseñas
      process.stdout.write(query);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', function onData(char) {
        const c = char.toString('utf8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          console.log();
          resolve(input);
        } else if (c === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (c === '\b' || c === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += c;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  console.log('================================================================');
  console.log(' CAJA PETROLERA DE SALUD - CREACIÓN DE ADMINISTRADOR INICIAL    ');
  console.log('================================================================');

  try {
    const args = process.argv.slice(2);
    let username = '';
    let nombreCompleto = '';
    let email = '';
    let password = '';

    // Soporte para argumentos por línea de comandos si se invocan
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--username' && args[i + 1]) username = args[i + 1];
      if (args[i] === '--name' && args[i + 1]) nombreCompleto = args[i + 1];
      if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
      if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
    }

    if (!username) {
      username = await prompt('Ingrese el nombre de usuario (ej. admin): ');
    }
    if (!username) {
      console.error('Error: El nombre de usuario no puede estar vacío.');
      process.exit(1);
    }

    if (!nombreCompleto) {
      nombreCompleto = await prompt('Ingrese el nombre completo del administrador: ');
    }
    if (!nombreCompleto) {
      console.error('Error: El nombre completo no puede estar vacío.');
      process.exit(1);
    }

    if (!email) {
      email = await prompt('Ingrese correo electrónico institucional (opcional): ');
    }

    if (!password) {
      password = await prompt('Ingrese la contraseña para el nuevo administrador: ', true);
    }
    if (!password || password.length < 6) {
      console.error('Error: La contraseña debe tener al menos 6 caracteres.');
      process.exit(1);
    }

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      console.log(`\nEl usuario "${username}" ya existe.`);
      const confirm = await prompt('¿Desea restablecer su contraseña y elevar a ADMINISTRADOR? (s/n): ');
      if (confirm.toLowerCase() === 's') {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            rol: RolUsuario.ADMINISTRADOR,
            activo: true,
            nombreCompleto: nombreCompleto || existing.nombreCompleto,
          },
        });
        console.log(`✓ Administrador "${username}" actualizado exitosamente.`);
      } else {
        console.log('Operación cancelada.');
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

    // Registrar en auditoría
    await prisma.auditoria.create({
      data: {
        actorUsername: 'CLI_SETUP',
        accion: 'CREAR_ADMIN_INICIAL',
        entidad: 'User',
        entidadId: created.id,
        detalleJson: JSON.stringify({
          username: created.username,
          rol: created.rol,
          origen: 'create-admin script',
        }),
      },
    });

    console.log('\n================================================================');
    console.log(`✓ Usuario Administrador creado satisfactoriamente: [${created.username}]`);
    console.log(`✓ Rol asignado: ADMINISTRADOR`);
    console.log(`✓ Ninguna credencial o contraseña fue expuesta ni almacenada en texto plano.`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('Error al crear el administrador:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
