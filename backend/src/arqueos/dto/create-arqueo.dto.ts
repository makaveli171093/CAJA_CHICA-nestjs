import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TipoArqueo } from '@prisma/client';

export class BilleteoDto {
  @ApiProperty({ description: 'Cantidad de billetes de Bs. 200', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b200: number;

  @ApiProperty({ description: 'Cantidad de billetes de Bs. 100', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b100: number;

  @ApiProperty({ description: 'Cantidad de billetes de Bs. 50', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b50: number;

  @ApiProperty({ description: 'Cantidad de billetes de Bs. 20', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b20: number;

  @ApiProperty({ description: 'Cantidad de billetes de Bs. 10', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b10: number;

  @ApiProperty({ description: 'Cantidad de monedas de Bs. 5', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m5: number;

  @ApiProperty({ description: 'Cantidad de monedas de Bs. 2', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m2: number;

  @ApiProperty({ description: 'Cantidad de monedas de Bs. 1', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m1: number;

  @ApiProperty({ description: 'Cantidad de monedas de 50 centavos (Bs. 0.50)', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m050: number;

  @ApiProperty({ description: 'Cantidad de monedas de 20 centavos (Bs. 0.20)', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m020: number;

  @ApiProperty({ description: 'Cantidad de monedas de 10 centavos (Bs. 0.10)', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  m010: number;
}

export class CreateArqueoDto {
  @ApiProperty({ description: 'ID de la unidad institucional' })
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  @IsString()
  unidadId: string;

  @ApiProperty({ description: 'Gestión fiscal (ej. 2026)' })
  @IsNotEmpty({ message: 'La gestión es obligatoria.' })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  gestion: number;

  @ApiProperty({ description: 'Tipo de arqueo institucional', enum: TipoArqueo, default: TipoArqueo.PERIODICO })
  @IsEnum(TipoArqueo, { message: 'El tipo de arqueo debe ser PERIODICO, SORPRESIVO o CIERRE_GESTION.' })
  tipoArqueo: TipoArqueo;

  @ApiProperty({ description: 'Hora del arqueo (ej. 11:30)', required: false })
  @IsOptional()
  @IsString()
  horaArqueo?: string;

  @ApiProperty({ description: 'Detalle de billetes y monedas contados' })
  @ValidateNested()
  @Type(() => BilleteoDto)
  billeteo: BilleteoDto;

  @ApiProperty({ description: 'Nombre completo del testigo presente', required: false })
  @IsOptional()
  @IsString()
  testigoNombre?: string;

  @ApiProperty({ description: 'Observaciones o conclusiones del acta de arqueo', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
