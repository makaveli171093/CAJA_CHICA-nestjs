import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DesignacionDto {
  @ApiProperty({ description: 'ID de la unidad institucional asignada' })
  @IsString({ message: 'El ID de la unidad debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  unidadId: string;

  @ApiProperty({ description: 'Referencia del documento formal de designación (ej. Memo RRHH N° 045/2026)' })
  @IsString({ message: 'La referencia del documento debe ser texto.' })
  @IsNotEmpty({ message: 'El documento de designación es obligatorio.' })
  @MaxLength(150, { message: 'El documento de designación no puede exceder 150 caracteres.' })
  documentoDesignacion: string;

  @ApiProperty({ description: 'Fecha de designación formal (YYYY-MM-DD)', example: '2026-01-15' })
  @IsString({ message: 'La fecha de designación debe ser una fecha en formato YYYY-MM-DD.' })
  @IsNotEmpty({ message: 'La fecha de designación es obligatoria.' })
  fechaDesignacion: string;

  @ApiPropertyOptional({ description: 'Cargo específico en esta unidad (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({ description: 'ID de ficha de responsable existente para vinculación explícita' })
  @IsOptional()
  @IsString()
  responsableId?: string;
}
