import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolUsuario } from '@prisma/client';
import { DesignacionDto } from './designacion.dto';

export class CreateUserDto {
  @ApiProperty({ description: 'Nombre de usuario único para acceso', example: 'jlinares' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio.' })
  @MaxLength(50)
  username: string;

  @ApiPropertyOptional({ description: 'Nombres del funcionario', example: 'Jared Angel' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos del funcionario', example: 'Linares Quispe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @ApiPropertyOptional({ description: 'Nombre completo del funcionario (opcional si se proporcionan nombres y apellidos)', example: 'Jared Linares' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreCompleto?: string;

  @ApiPropertyOptional({ description: 'Carnet de identidad del funcionario', example: '6854125 LP' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  carnetIdentidad?: string;

  @ApiPropertyOptional({ description: 'Cargo institucional', example: 'Encargado de Caja Chica' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiPropertyOptional({ description: 'Correo electrónico de contacto', example: 'jlinares@cps.org.bo' })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email?: string;

  @ApiProperty({ description: 'Contraseña inicial', example: 'ContrasenaSegura#2026' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @MaxLength(100)
  password: string;

  @ApiProperty({ enum: RolUsuario, description: 'Rol asignado', default: RolUsuario.ENCARGADO })
  @IsEnum(RolUsuario, { message: 'El rol debe ser ADMINISTRADOR o ENCARGADO.' })
  rol: RolUsuario;

  @ApiPropertyOptional({ description: 'Estado activo del usuario', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'IDs de unidades institucionales asignadas (legado)', type: [String] })
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

