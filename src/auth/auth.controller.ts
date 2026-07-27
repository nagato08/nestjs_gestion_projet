/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request as ExpressRequest, Response } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { LoginDTO } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';

/**
 * Limite stricte sur les routes d'authentification anonymes.
 *
 * Ces routes sont les seules exploitables sans compte : sans plafond dédié,
 * les quotas généraux (300 req/min) laisseraient largement place au bourrage
 * d'identifiants. Le compteur retombe sur l'IP faute d'utilisateur connu.
 *
 * La clé doit être le nom d'un limiteur déclaré dans `ThrottlerModule`
 * (`app.module.ts`) : un nom inconnu serait silencieusement ignoré. On
 * resserre donc la fenêtre `long`, qui est la plus large.
 */
const AUTH_THROTTLE = { long: { limit: 10, ttl: 60_000 } };

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7);
const isProd = process.env.NODE_ENV === 'production';

// Cookie httpOnly : invisible au JS (protégé du XSS). SameSite=None + Secure en prod
// car le front (forge.tadjo.dev) et l'API (api.forge.tadjo.dev) sont sur des sous-domaines.
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  path: '/auth',
  maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

function sessionContext(req: ExpressRequest) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Inscrire un utilisateur' })
  async register(
    @Body() dto: CreateUserDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.register(
      dto,
      sessionContext(req),
    );
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    return result;
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Connecter un utilisateur' })
  async login(
    @Body() loginDto: LoginDTO,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.login(
      loginDto,
      sessionContext(req),
    );
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    return result;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renouveler l’access token via le refresh cookie' })
  async refresh(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const current = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    const { access_token, refreshToken } = await this.authService.refresh(
      current,
      sessionContext(req),
    );
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    return { access_token };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion (révoque le refresh token courant)' })
  async logout(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const current = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    await this.authService.logout(current);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Déconnexion de tous les appareils' })
  async logoutAll(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logoutAll(req.user.sub);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: "Profile d'un utilisateur" })
  async getProfile(@Request() req) {
    return this.authService.validateUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiOperation({ summary: 'Mettre à jour le profil utilisateur' })
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Uploader un avatar' })
  async uploadAvatar(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadAvatar(req.user.sub, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @Get('users')
  @ApiOperation({
    summary: 'Liste des utilisateurs (admins et chefs de projet)',
  })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('users')
  @ApiOperation({
    summary:
      'Créer un utilisateur (admin uniquement). Mot de passe généré + envoyé par email.',
  })
  async adminCreateUser(@Body() dto: AdminCreateUserDto) {
    return this.authService.createUserByAdmin(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('users/:id/impact')
  @ApiOperation({
    summary:
      "Impact de la suppression d'un utilisateur (projets, tâches assignées, etc.)",
  })
  async getUserImpact(@Param('id') id: string) {
    return this.authService.getUserImpact(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(
    @Param('id') id: string,
    @Request() req,
    @Body() body?: { reassignTo?: string },
  ) {
    if (req.user?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }
    return this.authService.deleteUser(id, body?.reassignTo);
  }

  @Post('request-reset-password')
  @Throttle(AUTH_THROTTLE)
  async requestResetPassword(@Body('email') email: string) {
    return this.authService.resetUserPasswordRequest({ email });
  }

  @Get('verify-reset-password-token')
  @Throttle(AUTH_THROTTLE)
  async verifyResetPasswordToken(@Query('token') token: string) {
    return this.authService.verifyResetPasswordToken({ token });
  }

  @Post('reset-password')
  @Throttle(AUTH_THROTTLE)
  async resetUserPassword(@Body() resetPasswordDto: ResetUserPasswordDto) {
    return this.authService.resetUserPassword({ resetPasswordDto });
  }

  @Get('enums/departments')
  @ApiOperation({ summary: 'Récupérer les valeurs enum des départements' })
  getDepartmentEnums() {
    return this.authService.getDepartmentEnums();
  }
}
