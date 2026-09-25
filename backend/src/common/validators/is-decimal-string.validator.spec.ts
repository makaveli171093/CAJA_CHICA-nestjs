import { validate } from 'class-validator';
import { IsDecimalString } from './is-decimal-string.validator';

class TestDecimalModel {
  @IsDecimalString({ min: '0.01', maxIntegerDigits: 12, maxDecimalDigits: 2 })
  monto: string;

  constructor(monto: any) {
    this.monto = monto;
  }
}

describe('IsDecimalString Validator', () => {
  it('debe aceptar importes decimales válidos con 2 decimales', async () => {
    const validValues = ['100.00', '1500.50', '0.01', '999999999999.99', '500'];
    for (const val of validValues) {
      const model = new TestDecimalModel(val);
      const errors = await validate(model);
      expect(errors.length).toBe(0);
    }
  });

  it('debe rechazar importes con más de 2 decimales', async () => {
    const model = new TestDecimalModel('100.555');
    const errors = await validate(model);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('debe rechazar importes negativos o menores al mínimo', async () => {
    const model = new TestDecimalModel('-50.00');
    const errors = await validate(model);
    expect(errors.length).toBeGreaterThan(0);

    const modelZero = new TestDecimalModel('0.00');
    const errorsZero = await validate(modelZero);
    expect(errorsZero.length).toBeGreaterThan(0);
  });

  it('debe rechazar textos no numéricos o comas decimales', async () => {
    const invalidValues = ['abc', '100,50', '10.00.00', '', null, undefined, 100];
    for (const val of invalidValues) {
      const model = new TestDecimalModel(val);
      const errors = await validate(model);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('debe rechazar números con más de 12 dígitos enteros', async () => {
    const model = new TestDecimalModel('1234567890123.00'); // 13 dígitos
    const errors = await validate(model);
    expect(errors.length).toBeGreaterThan(0);
  });
});
