/**
 * Utilidades de fechas para reglas de negocio y zona horaria de Bolivia (America/La_Paz).
 *
 * Reglas clave:
 * 1. Para fechas de negocio de calendario (solicitud, entrega, apertura), se utiliza el contrato API YYYY-MM-DD
 *    y almacenamiento @db.Date en PostgreSQL.
 * 2. Se evitan conversiones implícitas a través de new Date(str).getDate(), que en huso horario UTC-4 desplazan el día anterior.
 * 3. La fecha "hoy" se obtiene estrictamente en zona horaria America/La_Paz.
 */

export const BOLIVIA_TIMEZONE = 'America/La_Paz';

/**
 * Obtiene la fecha actual en Bolivia (America/La_Paz) en formato ISO YYYY-MM-DD.
 */
export function getFechaHoyBolivia(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Normaliza cualquier entrada Date o string a una cadena limpia de fecha 'YYYY-MM-DD'.
 */
export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  // Para Date de Prisma (@db.Date se instancia como UTC midnight)
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parsea una cadena 'YYYY-MM-DD' a un objeto Date en UTC medianoche para almacenamiento exacto en PostgreSQL @db.Date.
 */
export function parseDateOnlyToUtc(dateStr: string): Date {
  const clean = dateStr.slice(0, 10);
  const [year, month, day] = clean.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Formatea una fecha a formato corto boliviano: DD/MM/YYYY.
 */
export function formatearFechaCortaBolivia(date: Date | string | null | undefined): string {
  const iso = formatDateOnly(date);
  if (!iso || iso.length !== 10) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha de negocio a texto legible en español (ej. "12 de Marzo de 2026").
 */
export function formatearFechaLegibleBolivia(fechaInput: Date | string | null | undefined): string {
  const iso = formatDateOnly(fechaInput);
  if (!iso || iso.length !== 10) return '';
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const dia = parseInt(dayStr, 10);
  const mesIdx = parseInt(monthStr, 10) - 1;
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const nombreMes = meses[mesIdx] || monthStr;
  return `${dia} de ${nombreMes} de ${yearStr}`;
}

/**
 * Verifica si una fecha cae en fin de semana (sábado o domingo) en zona horaria America/La_Paz.
 * Bolivia está fijada permanentemente a UTC-4 (sin horario de verano).
 */
export function esFinDeSemana(date: Date): boolean {
  const boliviaDay = new Date(date.getTime() - 4 * 60 * 60 * 1000).getUTCDay();
  return boliviaDay === 0 || boliviaDay === 6;
}

/**
 * Calcula la fecha límite sumando horas hábiles administrativas (Lunes a Viernes),
 * excluyendo íntegramente sábados y domingos.
 */
export function calcularFechaLimiteHorasHabiles(fechaInicio: Date | string, horasHabiles: number = 48): Date {
  let actual = new Date(fechaInicio);
  let horasRestantes = horasHabiles;

  while (horasRestantes > 0) {
    if (esFinDeSemana(actual)) {
      actual = new Date(actual.getTime() + 60 * 60 * 1000);
      continue;
    }
    actual = new Date(actual.getTime() + 60 * 60 * 1000);
    horasRestantes--;
  }

  while (esFinDeSemana(actual)) {
    actual = new Date(actual.getTime() + 60 * 60 * 1000);
  }

  return actual;
}

/**
 * Calcula las horas hábiles administrativas (Lunes a Viernes) transcurridas y el estado de vencimiento del plazo de 48 horas.
 */
export function calcularEstadoPlazo48Horas(
  fechaEntrega: Date | string,
  fechaReferencia: Date | string = new Date(),
  limiteHoras: number = 48
): {
  horasHabilesTranscurridas: number;
  horasHabilesRestantes: number;
  vencido: boolean;
  fechaLimite: Date;
  porcentajeConsumido: number;
} {
  const inicio = new Date(fechaEntrega);
  const fin = new Date(fechaReferencia);
  const fechaLimite = calcularFechaLimiteHorasHabiles(inicio, limiteHoras);

  let horasHabilesTranscurridas = 0;
  if (fin.getTime() > inicio.getTime()) {
    let cursor = new Date(inicio.getTime());
    const stepMs = 30 * 60 * 1000; // saltos de 30 minutos
    while (cursor.getTime() + stepMs <= fin.getTime()) {
      if (!esFinDeSemana(cursor)) {
        horasHabilesTranscurridas += 0.5;
      }
      cursor = new Date(cursor.getTime() + stepMs);
    }
  }

  horasHabilesTranscurridas = Math.round(horasHabilesTranscurridas * 10) / 10;
  const horasHabilesRestantes = Math.max(0, Math.round((limiteHoras - horasHabilesTranscurridas) * 10) / 10);
  const vencido = fin.getTime() >= fechaLimite.getTime() || horasHabilesTranscurridas >= limiteHoras;
  const porcentajeConsumido = Math.min(100, Math.round((horasHabilesTranscurridas / limiteHoras) * 100));

  return {
    horasHabilesTranscurridas,
    horasHabilesRestantes,
    vencido,
    fechaLimite,
    porcentajeConsumido,
  };
}

