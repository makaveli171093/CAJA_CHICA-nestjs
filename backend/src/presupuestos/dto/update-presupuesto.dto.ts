import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';

export class UpdatePresupuestoDto {
  @ApiProperty({
    description: 'Nuevo monto presupuestado asignado (cadena numérica con 2 decimales)',
    example: '18000.00',
  })
  @IsDecimalString(
    { min: '0.00', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    { message: 'El monto asignado debe ser un decimal válido (ej. "18000.00") con hasta 2 decimales.' },
  )
  montoAsignado: string;

  @ApiProperty({
    description: 'Motivo y justificación del ajuste o modificación presupuestaria',
    example: 'Reasignación de recursos aprobada mediante Nota CITE 124/2026',
  })
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Debe especificar el motivo o justificación del cambio presupuestario.' })
  @MaxLength(250, { message: 'El motivo no puede exceder 250 caracteres.' })
  motivo: string;
}
