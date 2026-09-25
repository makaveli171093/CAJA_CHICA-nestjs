import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePartidaDto {
  @ApiProperty({ description: 'Código presupuestario como texto', example: '31110' })
  @IsString({ message: 'El código de partida debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código de la partida es obligatorio.' })
  @MaxLength(30, { message: 'El código no puede exceder 30 caracteres.' })
  codigo: string;

  @ApiProperty({ description: 'Descripción oficial del gasto según clasificador', example: 'Gastos de Oficina y Útiles' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción de la partida es obligatoria.' })
  @MaxLength(200, { message: 'La descripción no puede exceder 200 caracteres.' })
  descripcion: string;
}

export class UpdatePartidaDto {
  @ApiPropertyOptional({ description: 'Descripción oficial de la partida' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
