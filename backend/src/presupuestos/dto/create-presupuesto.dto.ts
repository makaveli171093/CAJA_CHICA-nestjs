import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';

export class CreatePresupuestoDto {
  @ApiProperty({ description: 'ID de la unidad institucional' })
  @IsString()
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  unidadId: string;

  @ApiProperty({ description: 'Gestión anual presupuestaria', example: 2026 })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero (año).' })
  @Min(2000, { message: 'La gestión no puede ser anterior al año 2000.' })
  @Max(2100, { message: 'La gestión no puede ser posterior al año 2100.' })
  gestion: number;

  @ApiProperty({ description: 'ID de la partida presupuestaria' })
  @IsString()
  @IsNotEmpty({ message: 'La partida presupuestaria es obligatoria.' })
  partidaId: string;

  @ApiProperty({
    description: 'Monto presupuestado asignado (cadena numérica con 2 decimales)',
    example: '15000.00',
  })
  @IsDecimalString(
    { min: '0.00', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    { message: 'El monto asignado debe ser un decimal válido (ej. "15000.00") con hasta 2 decimales.' },
  )
  montoAsignado: string;
}
