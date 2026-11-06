import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CorregirPedidoDto {
  @ApiProperty({
    description: 'Motivo o justificación de la corrección del pedido (auditable)',
    example: 'Corrección de error tipográfico en nombre de solicitante según memorándum interno',
  })
  @IsString({ message: 'La justificación debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La justificación o motivo de la corrección es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justificacion: string;

  @ApiPropertyOptional({ description: 'ID de la partida presupuestaria' })
  @IsOptional()
  @IsUUID('4', { message: 'El ID de la partida presupuestaria debe ser un UUID válido.' })
  partidaId?: string;

  @ApiPropertyOptional({ description: 'Monto del pedido / anticipo (en Bs.)' })
  @IsOptional()
  @IsString()
  monto?: string;

  @ApiPropertyOptional({ description: 'Fecha de solicitud del pedido (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaSolicitud?: string;

  @ApiPropertyOptional({ description: 'Fecha de entrega del anticipo (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fechaEntrega?: string;

  @ApiPropertyOptional({ description: 'Nombres del solicitante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  solicitanteNombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del solicitante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  solicitanteApellidos?: string;

  @ApiPropertyOptional({ description: 'CI del solicitante' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  solicitanteCi?: string;

  @ApiPropertyOptional({ description: 'Área solicitante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  solicitanteArea?: string;

  @ApiPropertyOptional({ description: 'Lugar de emisión' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugar?: string;

  @ApiPropertyOptional({ description: 'Descripción del bien o servicio' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Motivo o destino' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ description: 'Nombres del receptor' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  receptorNombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del receptor' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  receptorApellidos?: string;

  @ApiPropertyOptional({ description: 'CI del receptor' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  receptorCi?: string;

  @ApiPropertyOptional({ description: 'Referencia REP-MAT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenciaRepMat?: string;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

