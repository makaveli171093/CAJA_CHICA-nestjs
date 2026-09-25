import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';

export class CreateAperturaDto {
  @ApiProperty({ description: 'ID de la unidad institucional' })
  @IsString()
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  unidadId: string;

  @ApiProperty({ description: 'Gestión anual de la caja', example: 2026 })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero (año).' })
  @Min(2000, { message: 'La gestión no puede ser anterior al 2000.' })
  @Max(2100, { message: 'La gestión no puede ser posterior al 2100.' })
  gestion: number;

  @ApiProperty({ description: 'ID del responsable designado de la caja' })
  @IsString()
  @IsNotEmpty({ message: 'El responsable es obligatorio.' })
  responsableId: string;

  @ApiProperty({
    description: 'Monto total autorizado para el fondo de caja chica (cadena decimal)',
    example: '10000.00',
  })
  @IsDecimalString(
    { min: '0.01', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    { message: 'El monto autorizado debe ser un decimal válido mayor a cero (ej. "10000.00").' },
  )
  montoAutorizado: string;

  @ApiProperty({
    description: 'Importe de dinero en efectivo efectivamente recibido',
    example: '10000.00',
  })
  @IsDecimalString(
    { min: '0.01', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    { message: 'El importe recibido debe ser un decimal válido mayor a cero (ej. "10000.00").' },
  )
  importeRecibido: string;

  @ApiProperty({ description: 'Fecha oficial de apertura (YYYY-MM-DD)', example: '2026-01-10' })
  @IsDateString({}, { message: 'La fecha de apertura debe tener formato YYYY-MM-DD.' })
  fechaApertura: string;

  @ApiProperty({
    description: 'Referencia del documento de autorización (ej. Resolución)',
    example: 'Resolución Administrativa N° 004/2026',
  })
  @IsString()
  @IsNotEmpty({ message: 'El documento de autorización es obligatorio.' })
  @MaxLength(150)
  docAutorizacion: string;

  @ApiProperty({
    description: 'Referencia del comprobante de ingreso o cheque',
    example: 'Comprobante de Egreso C-0081 / Cheque N° 99120',
  })
  @IsString()
  @IsNotEmpty({ message: 'El comprobante de ingreso es obligatorio.' })
  @MaxLength(150)
  compIngreso: string;
}

export class UpdateAperturaDto {
  @ApiProperty({ description: 'ID del responsable designado' })
  @IsString()
  @IsNotEmpty()
  responsableId: string;

  @ApiProperty({ description: 'Monto total autorizado' })
  @IsDecimalString({ min: '0.01' })
  montoAutorizado: string;

  @ApiProperty({ description: 'Importe recibido' })
  @IsDecimalString({ min: '0.01' })
  importeRecibido: string;

  @ApiProperty({ description: 'Fecha de apertura' })
  @IsDateString()
  fechaApertura: string;

  @ApiProperty({ description: 'Documento de autorización' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  docAutorizacion: string;

  @ApiProperty({ description: 'Comprobante de ingreso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  compIngreso: string;
}
