import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolUsuario } from '@prisma/client';
import { DesignacionDto } from './designacion.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nombres del funcionario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del funcionario' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @ApiPropertyOptional({ description: 'Nombre completo' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreCompleto?: string;

  @ApiPropertyOptional({ description: 'Carnet de identidad del funcionario' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  carnetIdentidad?: string;

  @ApiPropertyOptional({ description: 'Cargo institucional' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({ description: 'Correo electrónico' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña (opcional para restablecer)' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password?: string;

  @ApiPropertyOptional({ enum: RolUsuario })
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'IDs de unidades asignadas (legado)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unidades?: string[];

  @ApiPropertyOptional({ description: 'Designaciones formales por unidad institucional', type: [DesignacionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DesignacionDto)
  designaciones?: DesignacionDto[];
}

