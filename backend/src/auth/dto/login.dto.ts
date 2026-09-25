import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Nombre de usuario', example: 'admin' })
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre de usuario no puede estar vacío.' })
  @MaxLength(50, { message: 'El nombre de usuario no puede exceder 50 caracteres.' })
  username: string;

  @ApiProperty({ description: 'Contraseña de acceso', example: 'Admin123!' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres.' })
  password: string;
}
