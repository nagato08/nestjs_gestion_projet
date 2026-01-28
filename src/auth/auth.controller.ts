/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDTO } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
// import { AuthGuard } from '@nestjs/passport'; // Removed as it's not used

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ title: 'Inscrire un utilisateur' })
  async register(@Body() CreateUserDto: CreateUserDto) {
    return this.authService.register(CreateUserDto);
  }

  @Post('login')
  @ApiOperation({ title: 'Connecter un utilisateur' })
  async login(@Body() loginDto: LoginDTO) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ title: "Profile d'un utilisateur" })
  async getProfile(@Request() req) {
    return this.authService.validateUser(req.user.sub);
  }

  @Get('users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string, @Request() req) {
    if (req.user?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }
    return this.authService.deleteUser(id);
  }

  @Post('request-reset-password')
  async requestResetPassword(@Body('email') email: string) {
    return this.authService.resetUserPasswordRequest({ email });
  }

  @Get('verify-reset-password-token')
  async verifyResetPasswordToken(@Query('token') token: string) {
    return this.authService.verifyResetPasswordToken({ token });
  }

  @Post('reset-password')
  async resetUserPassword(@Body() resetPasswordDto: ResetUserPasswordDto) {
    return this.authService.resetUserPassword({ resetPasswordDto });
  }
}
