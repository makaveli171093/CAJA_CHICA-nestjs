import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nombre completo' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreCompleto?: string;

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
}
