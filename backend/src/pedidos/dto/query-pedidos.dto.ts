import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPedido } from '@prisma/client';

export class QueryPedidosDto {
  @ApiPropertyOptional({ description: 'ID de la unidad institucional' })
  @IsOptional()
  @IsString()
  unidadId?: string;

  @ApiPropertyOptional({ description: 'Gestión fiscal anual', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;

  @ApiPropertyOptional({
    description: 'Estado del pedido',
    enum: EstadoPedido,
  })
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;

  @ApiPropertyOptional({ description: 'Fecha inicio filtro (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio debe tener formato YYYY-MM-DD.',
  })
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha fin filtro (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de fin debe tener formato YYYY-MM-DD.',
  })
  fechaHasta?: string;
}
