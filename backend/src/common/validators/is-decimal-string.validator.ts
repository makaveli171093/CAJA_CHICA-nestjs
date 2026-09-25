import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import Decimal from 'decimal.js';

export interface DecimalStringOptions {
  min?: string;
  max?: string;
  maxIntegerDigits?: number;
  maxDecimalDigits?: number;
}

export function IsDecimalString(
  options: DecimalStringOptions = { min: '0.00', maxIntegerDigits: 12, maxDecimalDigits: 2 },
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isDecimalString',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          
          const trimmed = value.trim();
          // Solo números con hasta 2 decimales opcionales
          const regex = /^\d+(\.\d{1,2})?$/;
          if (!regex.test(trimmed)) return false;

          const parts = trimmed.split('.');
          const integerPart = parts[0];
          const decimalPart = parts[1] || '';

          const maxInt = options.maxIntegerDigits ?? 12;
          const maxDec = options.maxDecimalDigits ?? 2;

          if (integerPart.length > maxInt) return false;
          if (decimalPart.length > maxDec) return false;

          try {
            const decVal = new Decimal(trimmed);
            if (options.min !== undefined && decVal.lessThan(new Decimal(options.min))) {
              return false;
            }
            if (options.max !== undefined && decVal.greaterThan(new Decimal(options.max))) {
              return false;
            }
          } catch {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser una cadena numérica decimal válida (ej. "1500.50"), con hasta 12 enteros y 2 decimales, mínimo ${options.min ?? '0.00'}.`;
        },
      },
    });
  };
}
