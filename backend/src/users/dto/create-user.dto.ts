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
} from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Nombre de usuario único para acceso', example: 'jlinares' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio.' })
  @MaxLength(50)
  username: string;

  @ApiProperty({ description: 'Nombre completo del funcionario', example: 'Jared Linares' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @MaxLength(150)
  nombreCompleto: string;

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

  @ApiPropertyOptional({ description: 'IDs de unidades institucionales asignadas', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unidades?: string[];
}
