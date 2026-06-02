/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDTO } from './dto/login.dto';
import { MailerService } from 'src/mailer.service';
import { CloudinaryService } from 'src/cloudinary.service';
import { createId } from '@paralleldrive/cuid2';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { Role, Department } from '@prisma/client';
// import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private cloudinaryService: CloudinaryService,
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

    const existUser = await this.prisma.user.findUnique({
      where: { email },
    });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      department: true,
      jobTitle: true,
      avatar: true,
      createdAt: true,
    } as const;

    let user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: Role;
      department: Department;
      jobTitle: string | null;
      avatar: string | null;
      createdAt: Date;
    };

    if (existUser && existUser.deletedAt === null) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    if (existUser && existUser.deletedAt !== null) {
      user = await this.prisma.user.update({
        where: { id: existUser.id },
        data: {
          firstName,
          lastName,
          password: hashedPassword,
          role,
          department,
          jobTitle,
          avatar,
          deletedAt: null,
        },
        select: userSelect,
      });
    } else {
      user = await this.prisma.user.create({
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
        select: userSelect,
      });
    }

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

  async createUserByAdmin(dto: AdminCreateUserDto) {
    const { firstName, lastName, email, role, department, jobTitle } = dto;

    const existUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existUser && existUser.deletedAt === null) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      department: true,
      jobTitle: true,
      avatar: true,
      createdAt: true,
    } as const;

    const user =
      existUser && existUser.deletedAt !== null
        ? await this.prisma.user.update({
            where: { id: existUser.id },
            data: {
              firstName,
              lastName,
              password: hashedPassword,
              role,
              department,
              jobTitle,
              avatar: null,
              deletedAt: null,
            },
            select: userSelect,
          })
        : await this.prisma.user.create({
            data: {
              firstName,
              lastName,
              email,
              password: hashedPassword,
              role,
              department,
              jobTitle,
            },
            select: userSelect,
          });

    try {
      await this.mailerService.sendAdminCreatedAccountEmail({
        recipient: email,
        firstName,
        email,
        password: tempPassword,
      });
    } catch (err) {
      this.logger.error('Échec envoi email credentials', err as Error);
      throw new BadRequestException(
        "Le compte a été créé mais l'email n'a pas pu être envoyé. Contactez l'administrateur.",
      );
    }

    return user;
  }

  async login(loginDto: LoginDTO) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
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

      if (!existUser || existUser.deletedAt !== null) {
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
          resetPasswordTokenExpiresAt: new Date(Date.now() + 3_600_000), // 1h
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

      if (
        existUser.resetPasswordTokenExpiresAt &&
        existUser.resetPasswordTokenExpiresAt < new Date()
      ) {
        throw new ConflictException(
          'Le lien de réinitialisation a expiré. Veuillez faire une nouvelle demande.',
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

      if (
        existUser.resetPasswordTokenExpiresAt &&
        existUser.resetPasswordTokenExpiresAt < new Date()
      ) {
        throw new ConflictException(
          'Le lien de réinitialisation a expiré. Veuillez faire une nouvelle demande.',
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.user.update({
        where: { resetPasswordToken: token },
        data: {
          password: hashedPassword,
          isResetPasswordRequested: false,
          resetPasswordToken: null,
          resetPasswordTokenExpiresAt: null,
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

  async getUserImpact(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const [projectsOwned, taskAssignments, projectMemberships] =
      await Promise.all([
        this.prisma.project.findMany({
          where: { ownerId: userId, deletedAt: null },
          select: { id: true, name: true, status: true },
        }),
        this.prisma.taskAssignment.findMany({
          where: { userId },
          select: {
            taskId: true,
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                projectId: true,
                project: { select: { id: true, name: true } },
              },
            },
          },
        }),
        this.prisma.projectMember.findMany({
          where: { userId, project: { deletedAt: null } },
          select: {
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

    return {
      user,
      projectsOwned,
      tasksAssigned: taskAssignments.map((a) => a.task),
      projectsMember: projectMemberships.map((p) => p.project),
      hasImpact:
        projectsOwned.length > 0 ||
        taskAssignments.length > 0 ||
        projectMemberships.length > 0,
    };
  }

  async deleteUser(userId: string, reassignTo?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.deletedAt) {
      throw new ConflictException('Utilisateur déjà supprimé');
    }

    const impact = await this.getUserImpact(userId);

    if (impact.hasImpact && !reassignTo) {
      throw new BadRequestException(
        "Cet utilisateur a des projets ou tâches assignés. Sélectionnez un utilisateur de remplacement.",
      );
    }

    if (reassignTo) {
      if (reassignTo === userId) {
        throw new BadRequestException(
          'Le remplaçant doit être différent de la personne supprimée',
        );
      }
      const replacement = await this.prisma.user.findUnique({
        where: { id: reassignTo },
      });
      if (!replacement || replacement.deletedAt) {
        throw new NotFoundException('Utilisateur de remplacement introuvable');
      }
    }

    const deletedUser = await this.prisma.$transaction(async (tx) => {
      if (reassignTo) {
        // 1. Transférer ownership des projets
        if (impact.projectsOwned.length > 0) {
          await tx.project.updateMany({
            where: { ownerId: userId },
            data: { ownerId: reassignTo },
          });
        }

        // 2. Transférer assignments de tâches (en évitant les doublons)
        for (const task of impact.tasksAssigned) {
          const exists = await tx.taskAssignment.findUnique({
            where: {
              taskId_userId: { taskId: task.id, userId: reassignTo },
            },
          });
          if (!exists) {
            await tx.taskAssignment.update({
              where: {
                taskId_userId: { taskId: task.id, userId },
              },
              data: { userId: reassignTo },
            });
          } else {
            // Le remplaçant est déjà assigné → on supprime juste l'assignation de l'ancien
            await tx.taskAssignment.delete({
              where: { taskId_userId: { taskId: task.id, userId } },
            });
          }
        }

        // 3. Ajouter le remplaçant comme membre des projets de l'utilisateur (s'il ne l'est pas déjà)
        for (const p of impact.projectsMember) {
          const exists = await tx.projectMember.findUnique({
            where: {
              projectId_userId: { projectId: p.id, userId: reassignTo },
            },
          });
          if (!exists) {
            await tx.projectMember.create({
              data: { projectId: p.id, userId: reassignTo },
            });
          }
        }
      }

      return tx.user.update({
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
    });

    return {
      message: 'Utilisateur supprimé avec succès',
      user: deletedUser,
    };
  }

  // Mettre à jour le profil utilisateur
  async updateProfile(userId: string, updateProfileDto: any) {
    const { firstName, lastName, email, jobTitle, avatar } = updateProfileDto;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Si l'email change, vérifier qu'il n'existe pas ailleurs
    if (email && email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    // Mettre à jour le profil
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(avatar !== undefined && { avatar }),
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
      },
    });

    return updatedUser;
  }

  // Uploader un avatar
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Vérifier que c'est une image
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image');
    }

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Uploader vers Cloudinary
    const { url } = await this.cloudinaryService.uploadDocument(file, {
      folder: 'gestion-projets/avatars',
      resource_type: 'image',
    });

    // Mettre à jour l'avatar dans la base de données
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: url },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    });

    return updatedUser;
  }

  // Récupérer les valeurs enum des départements
  getDepartmentEnums() {
    return Object.values(Department);
  }
}
