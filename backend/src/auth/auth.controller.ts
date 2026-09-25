import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public, CurrentUser, AuthenticatedUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesión seguro para el personal institucional' })
  @ApiResponse({ status: 200, description: 'Sesión iniciada con éxito. Establece cookie HttpOnly.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  @ApiResponse({ status: 403, description: 'Usuario desactivado o temporalmente bloqueado.' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'] as string;

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    // Establecer cookie HttpOnly con SameSite=Lax
    res.cookie('caja_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    });

    return {
      message: 'Inicio de sesión satisfactorio.',
      user: result.user,
      token: result.token, // Opcional para clientes móviles o testing
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierre de sesión seguro' })
  @ApiResponse({ status: 200, description: 'Sesión finalizada y cookie eliminada.' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('caja_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Sesión finalizada correctamente.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar el perfil y unidades del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil y unidades autorizadas.' })
  async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.getProfile(currentUser.id);
  }
}
