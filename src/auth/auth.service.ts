import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginDTO } from './dto/login.dto';
import { MailerService } from 'src/mailer.service';
import { createId } from '@paralleldrive/cuid2';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { Role } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      jobTitle,
      avatar,
    } = createUserDto;

    // 1️⃣ Vérifier si l'utilisateur existe déjà
    const existUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existUser) {
      throw new ConflictException('User already exists');
    }

    // 2️⃣ Sécurité : interdiction de créer un ADMIN
    if (role === Role.ADMIN) {
      throw new ForbiddenException('You cannot create an ADMIN user');
    }

    // 3️⃣ Hash du mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4️⃣ Création de l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        department,
        jobTitle,
        avatar,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        jobTitle: true,
        avatar: true,
        createdAt: true,
      },
    });

    // 5️⃣ Envoi de l’email
    await this.mailerService.sendEmailFromRegister({
      recipient: email,
      firstName,
    });

    // 6️⃣ Génération du JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return { access_token, user };
  }

  async login(loginDto: LoginDTO) {
    const { email, password } = loginDto;

    // 1️⃣ Chercher l'utilisateur par email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2️⃣ Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3️⃣ Préparer le payload JWT (on inclut le role pour les guards)
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
    };
    const access_token = await this.jwtService.signAsync(payload);

    // 4️⃣ Sélectionner les infos « safe » à renvoyer au frontend
    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 5️⃣ Déterminer l'URL du dashboard selon le rôle
    const getDashboardUrl = (role: Role): string => {
      switch (role) {
        case Role.ADMIN:
          return '/dashboard/admin';
        case Role.PROJECT_MANAGER:
          return '/dashboard/project-manager';
        case Role.EMPLOYEE:
          return '/dashboard/employee';
        default:
          return '/dashboard';
      }
    };

    return {
      user: safeUser,
      access_token,
      dashboardUrl: getDashboardUrl(user.role),
    };
  }

  async validateUser(userId: string) {
    // Retourne toutes les infos utiles (sauf password)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        jobTitle: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      where: { deletedAt: null }, // ✅ uniquement actifs
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        jobTitle: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resetUserPasswordRequest({ email }: { email: string }) {
    try {
      const existUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!existUser) {
        throw new ConflictException("L'utilisateur n'existe pas");
      }

      if (existUser.isResetPasswordRequested === true) {
        throw new ConflictException(
          'Une demande de réinitialisation de mot de passe est déjà en cours',
        );
      }
      const createdId = createId();

      await this.prisma.user.update({
        where: { email },
        data: {
          isResetPasswordRequested: true,
          resetPasswordToken: createdId,
        },
      });

      await this.mailerService.sendRequestPasswordEmail({
        recipient: existUser.email,
        firstName: existUser.firstName,
        token: createdId,
      });

      return {
        error: false,
        message: 'Demande de réinitialisation de mot de passe envoyée',
      };
    } catch (error) {
      this.logger.error('resetUserPasswordRequest', error);
      throw error;
    }
  }

  async verifyResetPasswordToken({ token }: { token: string }) {
    try {
      const existUser = await this.prisma.user.findUnique({
        where: { resetPasswordToken: token },
      });

      if (!existUser) {
        throw new ConflictException("L'utilisateur n'existe pas");
      }

      if (existUser.isResetPasswordRequested === false) {
        throw new ConflictException(
          'Aucune demande de réinitialisation de mot de passe est actuellement en cours',
        );
      }

      return {
        error: false,
        message:
          'le token est valide, vous pouvez réinitialiser votre mot de passe',
      };
    } catch (error) {
      this.logger.error('verifyResetPasswordToken', error);
      throw error;
    }
  }

  async resetUserPassword({
    resetPasswordDto,
  }: {
    resetPasswordDto: ResetUserPasswordDto;
  }) {
    try {
      const { password, token } = resetPasswordDto;

      const existUser = await this.prisma.user.findUnique({
        where: { resetPasswordToken: token },
      });

      if (!existUser) {
        throw new ConflictException("L'utilisateur n'existe pas");
      }

      if (existUser.isResetPasswordRequested === false) {
        throw new ConflictException(
          'Une demande de réinitialisation de mot de passe est déjà en cours',
        );
      }
      //const createdId = createId();
      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.update({
        where: { resetPasswordToken: token },
        data: {
          password: hashedPassword,
          isResetPasswordRequested: false,
        },
      });
      return {
        error: false,
        message: 'Mot de passe réinitialisé avec succès',
      };
    } catch (error) {
      this.logger.error('resetUserPassword', error);
      throw error;
    }
  }

  async deleteUser(userId: string) {
    // 1️⃣ Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2️⃣ Soft delete en ajoutant deletedAt
    const deletedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        deletedAt: true,
      },
    });

    return {
      message: 'User soft-deleted successfully',
      user: deletedUser,
    };
  }
}
