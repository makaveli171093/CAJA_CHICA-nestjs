import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateResponsableDto {
  @ApiProperty({ description: 'ID de la unidad institucional a la que pertenece' })
  @IsString()
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  unidadId: string;

  @ApiProperty({ description: 'Nombres del responsable', example: 'Carlos Alberto' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios.' })
  @MaxLength(100)
  nombres: string;

  @ApiProperty({ description: 'Apellidos del responsable', example: 'Mamani Flores' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios.' })
  @MaxLength(100)
  apellidos: string;

  @ApiProperty({ description: 'Carnet de identidad (como texto)', example: '4892145 LP' })
  @IsString()
  @IsNotEmpty({ message: 'El carnet de identidad es obligatorio.' })
  @MaxLength(30)
  carnetIdentidad: string;

  @ApiProperty({ description: 'Cargo institucional', example: 'Encargado de Caja Chica' })
  @IsString()
  @IsNotEmpty({ message: 'El cargo es obligatorio.' })
  @MaxLength(120)
  cargo: string;

  @ApiProperty({
    description: 'Referencia del documento de designación',
    example: 'Memorando RRHH N° 045/2026',
  })
  @IsString()
  @IsNotEmpty({ message: 'El documento de designación es obligatorio.' })
  @MaxLength(150)
  documentoDesignacion: string;

  @ApiProperty({ description: 'Fecha de designación (formato YYYY-MM-DD)', example: '2026-01-05' })
  @IsDateString({}, { message: 'La fecha de designación debe tener formato de fecha válido (YYYY-MM-DD).' })
  fechaDesignacion: string;
}

export class UpdateResponsableDto {
  @ApiPropertyOptional({ description: 'Nombres del responsable' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del responsable' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @ApiPropertyOptional({ description: 'Carnet de identidad' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  carnetIdentidad?: string;

  @ApiPropertyOptional({ description: 'Cargo institucional' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;

  @ApiPropertyOptional({ description: 'Referencia del documento de designación' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  documentoDesignacion?: string;

  @ApiPropertyOptional({ description: 'Fecha de designación' })
  @IsOptional()
  @IsDateString()
  fechaDesignacion?: string;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo' })
  @IsOptional()
  activo?: boolean;
}
