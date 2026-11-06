import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';

export class UpdatePedidoDto {
  @ApiPropertyOptional({ description: 'ID de la partida presupuestaria' })
  @IsOptional()
  @IsString()
  partidaId?: string;

  @ApiPropertyOptional({ description: 'Referencia del pedido autorizado' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroPedido?: string;

  @ApiPropertyOptional({ description: 'Fecha de solicitud (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de solicitud debe tener formato YYYY-MM-DD.',
  })
  fechaSolicitud?: string;

  @ApiPropertyOptional({ description: 'Lugar de emisión' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugar?: string;

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

  @ApiPropertyOptional({ description: 'Monto solicitado' })
  @IsOptional()
  @IsDecimalString(
    { min: '0.01', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    { message: 'El monto debe ser un decimal positivo con hasta 2 decimales.' },
  )
  monto?: string;

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
