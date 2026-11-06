import { montoEnBolivianosLiteral } from './numero-a-letras';

describe('montoEnBolivianosLiteral', () => {
  it('convierte montos básicos a palabras', () => {
    expect(montoEnBolivianosLiteral('100.00')).toBe('BOLIVIANOS CIEN 00/100');
    expect(montoEnBolivianosLiteral('500.50')).toBe('BOLIVIANOS QUINIENTOS 50/100');
    expect(montoEnBolivianosLiteral('1234.56')).toBe('BOLIVIANOS UN MIL DOSCIENTOS TREINTA Y CUATRO 56/100');
    expect(montoEnBolivianosLiteral('21.05')).toBe('BOLIVIANOS VEINTIUN 05/100');
    expect(montoEnBolivianosLiteral('10000.00')).toBe('BOLIVIANOS DIEZ MIL 00/100');
    expect(montoEnBolivianosLiteral('0.50')).toBe('BOLIVIANOS CERO 50/100');
  });
});
