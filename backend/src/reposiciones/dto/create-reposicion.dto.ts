import { IsNotEmpty, IsString, IsInt, IsArray, ArrayMinSize, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReposicionDto {
  @ApiProperty({ description: 'ID de la unidad institucional' })
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  @IsString()
  unidadId: string;

  @ApiProperty({ description: 'Gestión fiscal (ej. 2026)' })
  @IsNotEmpty({ message: 'La gestión es obligatoria.' })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  gestion: number;

  @ApiProperty({ description: 'Array de IDs de rendiciones de cuentas aprobadas a incluir en la reposición' })
  @IsArray({ message: 'rendicionIds debe ser un arreglo de identificadores.' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos una rendición de cuentas aprobada para reponer el fondo.' })
  @IsString({ each: true, message: 'Cada identificador de rendición debe ser un texto.' })
  rendicionIds: string[];

  @ApiProperty({ description: 'Observaciones o justificativo de la reposición', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
