import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ description: 'Código único de la unidad institucional', example: 'LP-ADM' })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código de la unidad es obligatorio.' })
  @MaxLength(30, { message: 'El código no puede exceder 30 caracteres.' })
  codigo: string;

  @ApiProperty({ description: 'Nombre oficial de la unidad', example: 'Administración Regional La Paz' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre de la unidad es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Administración de dependencia', example: 'Oficina Central' })
  @IsOptional()
  @IsString({ message: 'La dependencia debe ser una cadena de texto.' })
  @MaxLength(150, { message: 'La dependencia no puede exceder 150 caracteres.' })
  dependencia?: string;
}

export class UpdateUnitDto {
  @ApiPropertyOptional({ description: 'Nombre oficial de la unidad' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ description: 'Administración de dependencia' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  dependencia?: string;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo de la unidad' })
  @IsOptional()
  activo?: boolean;
}
