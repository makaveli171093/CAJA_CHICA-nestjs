import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('--- CARGANDO DATOS FICTICIOS DE PRUEBA (DEMO CPS) ---');
  console.log('Nota: Todos los datos son completamente ficticios para fines de verificación.');

  // 1. Unidades institucionales ficticias
  const unidad1 = await prisma.unit.upsert({
    where: { codigo: 'DEMO-ADM-LP' },
    update: {},
    create: {
      codigo: 'DEMO-ADM-LP',
      nombre: 'Administración Regional La Paz (Ficticio)',
      dependencia: 'Oficina Central (Ficticio)',
    },
  });

  const unidad2 = await prisma.unit.upsert({
    where: { codigo: 'DEMO-HPO' },
    update: {},
    create: {
      codigo: 'DEMO-HPO',
      nombre: 'Hospital Petrolero Obrajes (Ficticio)',
      dependencia: 'Administración Regional La Paz (Ficticio)',
    },
  });

  console.log('✓ Unidades ficticias registradas.');

  // 2. Partidas presupuestarias ficticias
  const partida1 = await prisma.partida.upsert({
    where: { codigo: '31110' },
    update: {},
    create: {
      codigo: '31110',
      descripcion: 'Gastos de Escritorio y Papelería (Ficticio)',
    },
  });

  const partida2 = await prisma.partida.upsert({
    where: { codigo: '39500' },
    update: {},
    create: {
      codigo: '39500',
      descripcion: 'Útiles de Aseo y Limpieza (Ficticio)',
    },
  });

  console.log('✓ Partidas ficticias registradas.');

  // 3. Responsable ficticio
  const resp1 = await prisma.responsable.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      unidadId: unidad1.id,
      nombres: 'Juan Carlos',
      apellidos: 'Pérez Demostración',
      carnetIdentidad: '1234567 LP',
      cargo: 'Responsable de Caja Chica Ficticio',
      documentoDesignacion: 'Memorando DEMO N° 001/2026',
      fechaDesignacion: new Date('2026-01-02'),
    },
  });

  console.log('✓ Responsable ficticio registrado.');

  console.log('--- DATOS FICTICIOS CARGADOS CON ÉXITO ---');
}

seed()
  .catch((e) => {
    console.error('Error al cargar datos ficticios:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
