import Decimal from 'decimal.js';

const UNIDADES = [
  '',
  'UN',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
];

const DECENAS = [
  '',
  'DIEZ',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const DIEZ_A_DIECINUEVE = [
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
];

const VEINTI_UNOS = [
  'VEINTE',
  'VEINTIUN',
  'VEINTIDOS',
  'VEINTITRES',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISEIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function leerCentenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let str = CENTENAS[c];

  if (resto > 0) {
    if (str) str += ' ';
    if (resto < 10) {
      str += UNIDADES[resto];
    } else if (resto >= 10 && resto < 20) {
      str += DIEZ_A_DIECINUEVE[resto - 10];
    } else if (resto >= 20 && resto < 30) {
      str += VEINTI_UNOS[resto - 20];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      str += DECENAS[d];
      if (u > 0) {
        str += ' Y ' + UNIDADES[u];
      }
    }
  }

  return str.trim();
}

function leerMiles(n: number): string {
  if (n === 0) return '';
  if (n < 1000) return leerCentenas(n);

  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  let str = '';

  if (miles === 1) {
    str = 'UN MIL';
  } else {
    str = leerCentenas(miles) + ' MIL';
  }

  if (resto > 0) {
    str += ' ' + leerCentenas(resto);
  }

  return str.trim();
}

function leerMillones(n: number): string {
  if (n === 0) return 'CERO';
  if (n < 1000000) return leerMiles(n);

  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  let str = '';

  if (millones === 1) {
    str = 'UN MILLON';
  } else {
    str = leerCentenas(millones) + ' MILLONES';
  }

  if (resto > 0) {
    str += ' ' + leerMiles(resto);
  }

  return str.trim();
}

/**
 * Convierte un monto en bolivianos a su representación literal oficial
 * Ejemplo: 1550.50 -> "BOLIVIANOS UN MIL QUINIENTOS CINCUENTA 50/100"
 */
export function montoEnBolivianosLiteral(monto: string | number | Decimal): string {
  const dec = new Decimal(monto.toString());
  const entero = dec.floor().toNumber();
  const centavos = dec.minus(entero).times(100).round().toNumber();
  const centavosStr = String(centavos).padStart(2, '0');

  const parteEnteraLiteral = leerMillones(entero);

  return `BOLIVIANOS ${parteEnteraLiteral} ${centavosStr}/100`;
}
