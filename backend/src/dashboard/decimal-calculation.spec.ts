import Decimal from 'decimal.js';

describe('Cálculo Decimal Exacto (Regla CPS 10% y Suma Monetaria)', () => {
  it('debe calcular exactamente el 10% del fondo autorizado sin pérdidas de precisión IEEE-754', () => {
    const fondos = [
      { fondo: '10000.00', expected10Pct: '1000.00' },
      { fondo: '15555.50', expected10Pct: '1555.55' },
      { fondo: '33333.33', expected10Pct: '3333.33' },
      { fondo: '0.10', expected10Pct: '0.01' },
      { fondo: '777.77', expected10Pct: '77.78' }, // redondeo bancario estándar
    ];

    for (const { fondo, expected10Pct } of fondos) {
      const fondoDec = new Decimal(fondo);
      const limite10Pct = fondoDec.times(0.10).toFixed(2);
      expect(limite10Pct).toBe(expected10Pct);
    }
  });

  it('debe realizar sumas monetarias de presupuestos sin errores de coma flotante', () => {
    // Ejemplo clásico de float en JS: 0.1 + 0.2 = 0.30000000000000004
    const montos = ['0.10', '0.20', '0.30', '1000.05', '999.95'];
    let total = new Decimal('0.00');

    for (const m of montos) {
      total = total.plus(new Decimal(m));
    }

    expect(total.toFixed(2)).toBe('2000.60');
  });
});
