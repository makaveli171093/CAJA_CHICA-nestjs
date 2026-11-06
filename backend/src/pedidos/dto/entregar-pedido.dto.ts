import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class EntregarPedidoDto {
  @ApiPropertyOptional({
    description: 'Fecha efectiva de entrega del efectivo (YYYY-MM-DD). Si no se proporciona, se utiliza la fecha actual en America/La_Paz.',
    example: '2026-03-12',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de entrega debe tener formato YYYY-MM-DD.',
  })
  fechaEntrega?: string;
}
