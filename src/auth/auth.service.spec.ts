import { ConflictException } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from 'src/mailer.service';
import { CloudinaryService } from 'src/cloudinary.service';

/**
 * Inscription publique.
 *
 * Le premier cas couvre une faille d'élévation de privilège corrigée en
 * phase 1 : la route publique acceptait le rôle envoyé par le client, ce qui
 * permettait à n'importe qui de s'inscrire administrateur. Ce test est là
 * pour que la régression ne puisse pas repasser inaperçue.
 */

const dto = (extra: Record<string, unknown> = {}): CreateUserDto =>
  ({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'motdepasse-solide',
    department: Department.IT,
    ...extra,
  }) as CreateUserDto;

describe('Inscription publique', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock };
  };
  let mailer: { sendEmailFromRegister: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        // Renvoie ce qu'on lui demande d'écrire : le test inspecte l'appel,
        // pas la persistance.
        create: jest.fn().mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({
            id: 'utilisateur-1',
            createdAt: new Date(),
            ...data,
          }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({
            id: 'utilisateur-1',
            createdAt: new Date(),
            ...data,
          }),
        ),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    mailer = { sendEmailFromRegister: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      prisma as unknown as PrismaService,
      {
        signAsync: jest.fn().mockResolvedValue('jeton'),
      } as unknown as JwtService,
      mailer as unknown as MailerService,
      {} as CloudinaryService,
    );
  });

  it('force le rôle EMPLOYEE même si le client en réclame un autre', async () => {
    await service.register(dto({ role: Role.ADMIN }));

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.EMPLOYEE }),
      }),
    );
  });

  it('refuse un rôle PROJECT_MANAGER réclamé à l’inscription', async () => {
    await service.register(dto({ role: Role.PROJECT_MANAGER }));

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.EMPLOYEE }),
      }),
    );
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    await service.register(dto());

    const { data } = prisma.user.create.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(data.password).not.toBe('motdepasse-solide');
    // Empreinte bcrypt : marqueur de version suivi du coût.
    expect(data.password).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('rejette une adresse déjà utilisée par un compte actif', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existant',
      deletedAt: null,
    });

    await expect(service.register(dto())).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('réactive un compte supprimé plutôt que d’en créer un doublon', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existant',
      deletedAt: new Date(),
    });

    await service.register(dto());

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: null, role: Role.EMPLOYEE }),
      }),
    );
  });
});
