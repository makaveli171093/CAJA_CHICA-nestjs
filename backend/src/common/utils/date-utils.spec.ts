import {
  getFechaHoyBolivia,
  formatDateOnly,
  parseDateOnlyToUtc,
  formatearFechaCortaBolivia,
  formatearFechaLegibleBolivia,
  calcularFechaLimiteHorasHabiles,
  calcularEstadoPlazo48Horas,
  BOLIVIA_TIMEZONE,
} from './date-utils';


describe('Utilidades de Fecha Bolivia (date-utils)', () => {
  it('1. getFechaHoyBolivia devuelve fecha en formato YYYY-MM-DD en America/La_Paz', () => {
    const hoy = getFechaHoyBolivia();
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('2. formatDateOnly y parseDateOnlyToUtc preservan el día exacto sin desfase UTC-4', () => {
    const isoString = '2026-03-12';
    const utcDate = parseDateOnlyToUtc(isoString);

    expect(utcDate.getUTCFullYear()).toBe(2026);
    expect(utcDate.getUTCMonth()).toBe(2); // Marzo (0-indexed)
    expect(utcDate.getUTCDate()).toBe(12);

    const formattedBack = formatDateOnly(utcDate);
    expect(formattedBack).toBe('2026-03-12');
  });

  it('3. formatearFechaCortaBolivia convierte 2026-03-12 a 12/03/2026', () => {
    expect(formatearFechaCortaBolivia('2026-03-12')).toBe('12/03/2026');
    expect(formatearFechaCortaBolivia('2026-12-03')).toBe('03/12/2026');
  });

  it('4. formatearFechaLegibleBolivia formatea correctamente con mes en español', () => {
    expect(formatearFechaLegibleBolivia('2026-03-12')).toBe('12 de Marzo de 2026');
    expect(formatearFechaLegibleBolivia('2026-09-28')).toBe('28 de Septiembre de 2026');
  });

  it('5. Regla 48 horas hábiles: omite fines de semana (sábado y domingo)', () => {
    // Viernes 25 de Septiembre de 2026 a las 10:00 AM (UTC)
    const viernes = new Date('2026-09-25T10:00:00.000Z');
    // +24 horas hábiles = Lunes 28 de Septiembre 10:00 AM
    // +48 horas hábiles = Martes 29 de Septiembre 10:00 AM
    const limite = calcularFechaLimiteHorasHabiles(viernes, 48);

    expect(limite.toISOString().startsWith('2026-09-29')).toBe(true);

    // Si verificamos el domingo a mediodía, no debe haber consumido horas de fin de semana
    const domingo = new Date('2026-09-27T12:00:00.000Z');
    const estadoDomingo = calcularEstadoPlazo48Horas(viernes, domingo, 48);
    expect(estadoDomingo.vencido).toBe(false);
    expect(estadoDomingo.horasHabilesTranscurridas).toBe(18); // exactamente las 18 horas del viernes (06:00 a 24:00)
  });
});


