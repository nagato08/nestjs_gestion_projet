import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AbsenceService } from './absence.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'utilisateur-1';
const OTHER_USER_ID = 'utilisateur-2';
const ABSENCE_ID = 'absence-1';

function buildService() {
  const prisma = {
    absence: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: ABSENCE_ID }),
      update: jest.fn().mockResolvedValue({ id: ABSENCE_ID }),
      delete: jest.fn().mockResolvedValue({ id: ABSENCE_ID }),
    },
  };

  const service = new AbsenceService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('Déclaration d’une indisponibilité', () => {
  it('couvre la journée entière, bornes incluses', async () => {
    const { service, prisma } = buildService();

    await service.create(USER_ID, {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });

    const call = prisma.absence.create.mock.calls[0][0] as {
      data: { startDate: Date; endDate: Date };
    };
    // Une absence d'une journée doit couvrir cette journée en entier, sans
    // quoi une échéance de fin d'après-midi paraîtrait hors absence. Bornes
    // vérifiées en UTC : c'est dans ce fuseau que la date repart vers
    // l'agenda, quel que soit celui du serveur.
    expect(call.data.startDate.getUTCHours()).toBe(0);
    expect(call.data.endDate.getUTCHours()).toBe(23);
    expect(call.data.endDate.getUTCMinutes()).toBe(59);
    expect(call.data.startDate.toISOString().split('T')[0]).toBe('2026-08-10');
    expect(call.data.endDate.toISOString().split('T')[0]).toBe('2026-08-10');
  });

  it('refuse une date de fin antérieure au début', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.create(USER_ID, {
        startDate: '2026-08-10',
        endDate: '2026-08-05',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.absence.create).not.toHaveBeenCalled();
  });

  it('refuse une période qui en recouvre une déjà déclarée', async () => {
    const { service, prisma } = buildService();
    prisma.absence.findFirst.mockResolvedValue({ id: 'absence-existante' });

    await expect(
      service.create(USER_ID, {
        startDate: '2026-08-10',
        endDate: '2026-08-12',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.absence.create).not.toHaveBeenCalled();
  });

  it('déclare toujours pour soi-même, jamais pour autrui', async () => {
    const { service, prisma } = buildService();

    await service.create(USER_ID, {
      startDate: '2026-08-10',
      endDate: '2026-08-12',
    });

    const call = prisma.absence.create.mock.calls[0][0] as {
      data: { userId: string };
    };
    expect(call.data.userId).toBe(USER_ID);
  });
});

describe('Modification et suppression', () => {
  it('refuse de toucher à la disponibilité de quelqu’un d’autre', async () => {
    const { service, prisma } = buildService();
    prisma.absence.findUnique.mockResolvedValue({
      id: ABSENCE_ID,
      userId: OTHER_USER_ID,
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-12'),
    });

    await expect(
      service.update(ABSENCE_ID, USER_ID, { type: 'SICK' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.absence.update).not.toHaveBeenCalled();
  });

  it('valide les deux dates ensemble quand une seule change', async () => {
    // Ne repousser que la date de début, au-delà d'une fin déjà enregistrée,
    // produirait une période inversée si chaque borne était validée seule.
    const { service, prisma } = buildService();
    prisma.absence.findUnique.mockResolvedValue({
      id: ABSENCE_ID,
      userId: USER_ID,
      startDate: new Date('2026-08-10T00:00:00'),
      endDate: new Date('2026-08-12T23:59:59'),
    });

    await expect(
      service.update(ABSENCE_ID, USER_ID, { startDate: '2026-08-20' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('ignore la période courante dans la détection de chevauchement', async () => {
    const { service, prisma } = buildService();
    prisma.absence.findUnique.mockResolvedValue({
      id: ABSENCE_ID,
      userId: USER_ID,
      startDate: new Date('2026-08-10T00:00:00'),
      endDate: new Date('2026-08-12T23:59:59'),
    });

    await service.update(ABSENCE_ID, USER_ID, { endDate: '2026-08-14' });

    const call = prisma.absence.findFirst.mock.calls[0][0] as {
      where: { id: { not: string } };
    };
    expect(call.where.id.not).toBe(ABSENCE_ID);
    expect(prisma.absence.update).toHaveBeenCalled();
  });

  it('signale une disponibilité introuvable', async () => {
    const { service } = buildService();

    await expect(service.remove(ABSENCE_ID, USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('Visibilité des motifs', () => {
  it('n’expose jamais le motif dans la vue collègues', async () => {
    const { service, prisma } = buildService();

    await service.listForUsers([OTHER_USER_ID], '2026-08-01', '2026-08-31');

    const call = prisma.absence.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    // Le motif reste privé : l'équipe a besoin de l'indisponibilité, pas de
    // sa raison.
    expect(call.select.reason).toBeUndefined();
  });

  it('ne requête rien quand personne n’est visible', async () => {
    const { service, prisma } = buildService();

    const result = await service.listForUsers([], '2026-08-01', '2026-08-31');

    expect(result).toEqual([]);
    expect(prisma.absence.findMany).not.toHaveBeenCalled();
  });
});
