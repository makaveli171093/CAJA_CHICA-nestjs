/**
 * Utilidades de fecha para el contexto de Bolivia (America/La_Paz).
 *
 * Reglas:
 * 1. Formato visual oficial: DD/MM/AAAA (ej. 12/03/2026).
 * 2. Formato de contrato de API: YYYY-MM-DD (ej. 2026-03-12).
 * 3. Se evita new Date(str).getDate() para fechas calendario sin hora,
 *    eliminando el desplazamiento por zona horaria UTC-4.
 */

export const BOLIVIA_TIMEZONE = 'America/La_Paz';

/**
 * Obtiene la fecha actual en Bolivia en formato ISO 'YYYY-MM-DD'.
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
 * Convierte una fecha ISO/DATE ('YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss.sssZ' o Date)
 * al formato 'DD/MM/YYYY'.
 */
export function formatDateToBO(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }
  return dateStr;
}

/**
 * Convierte una fecha con hora (timestamp ISO o Date) al formato 'DD/MM/YYYY HH:mm'.
 */
export function formatDateTimeToBO(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : '';
    const formatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: BOLIVIA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch (_) {
    return formatDateToBO(dateInput);
  }
}

/**
 * Convierte una fecha en formato boliviano 'DD/MM/AAAA' al formato API 'YYYY-MM-DD'.
 * Devuelve null si no es válida.
 */
export function parseBOToISODate(boStr: string): string | null {
  if (!boStr) return null;
  const clean = boStr.trim().replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Valida si una cadena corresponde a una fecha válida en formato boliviano 'DD/MM/AAAA'.
 */
export function isValidBODate(boStr: string): boolean {
  return parseBOToISODate(boStr) !== null;
}
