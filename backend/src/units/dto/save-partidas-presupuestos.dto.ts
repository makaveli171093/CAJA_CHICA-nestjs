import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PartidaPresupuestoConfigItemDto {
  @ApiProperty({ description: 'ID de la partida presupuestaria' })
  @IsString()
  @IsNotEmpty({ message: 'El partidaId es obligatorio.' })
  partidaId: string;

  @ApiProperty({
    description: 'Estado de habilitación de la partida para la unidad',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;

  @ApiProperty({
    description:
      'Monto presupuestado asignado (ej. "5000.00", null o vacío para no asignar/conservar)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  montoAsignado?: string | null;

  @ApiProperty({
    description: 'Motivo o justificativo del cambio presupuestario',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class SavePartidasPresupuestosDto {
  @ApiProperty({ description: 'Gestión fiscal (ej. 2026)', example: 2026 })
  @IsNumber()
  @IsNotEmpty({ message: 'La gestión fiscal es obligatoria.' })
  gestion: number;

  @ApiProperty({
    description: 'Lista de partidas con su estado de habilitación y presupuesto',
    type: [PartidaPresupuestoConfigItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartidaPresupuestoConfigItemDto)
  items: PartidaPresupuestoConfigItemDto[];
}
