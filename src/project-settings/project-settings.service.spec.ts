import { ProjectSettingsService } from './project-settings.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

/**
 * Paramètres de pilotage d'un projet.
 *
 * Le point à verrouiller : la création paresseuse. `CompanySettings` suit le
 * même principe — un projet qui ne personnalise jamais ses seuils ne doit
 * pas forcer une ligne en base à la première consultation d'un simple
 * VIEWER.
 */

const PROJECT_ID = 'projet-1';
const USER_ID = 'utilisateur-1';

function buildService() {
  const prisma = {
    projectSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue('VIEWER'),
    requireManager: jest.fn().mockResolvedValue('ADMIN'),
  };

  const service = new ProjectSettingsService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
  );

  return { service, prisma, access };
}

describe('Paramètres de pilotage du projet', () => {
  it('renvoie les paramètres existants sans en recréer', async () => {
    const { service, prisma } = buildService();
    const existing = { id: 's1', projectId: PROJECT_ID, hoursPerDay: 8 };
    prisma.projectSettings.findUnique.mockResolvedValue(existing);

    const result = await service.getSettings(PROJECT_ID, USER_ID);

    expect(result).toBe(existing);
    expect(prisma.projectSettings.create).not.toHaveBeenCalled();
  });

  it('crée des paramètres par défaut à la première consultation', async () => {
    const { service, prisma } = buildService();
    prisma.projectSettings.findUnique.mockResolvedValue(null);
    prisma.projectSettings.create.mockResolvedValue({
      id: 's1',
      projectId: PROJECT_ID,
    });

    await service.getSettings(PROJECT_ID, USER_ID);

    expect(prisma.projectSettings.create).toHaveBeenCalledWith({
      data: { projectId: PROJECT_ID },
    });
  });

  it('autorise un VIEWER à consulter les paramètres', async () => {
    const { service, prisma, access } = buildService();
    prisma.projectSettings.findUnique.mockResolvedValue({ id: 's1' });

    await service.getSettings(PROJECT_ID, USER_ID);

    expect(access.requireMember).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
  });

  it('exige un rôle de gestionnaire pour modifier les paramètres', async () => {
    const { service, prisma, access } = buildService();
    prisma.projectSettings.upsert.mockResolvedValue({ id: 's1' });

    await service.updateSettings(PROJECT_ID, USER_ID, { hoursPerDay: 10 });

    expect(access.requireManager).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
  });

  it('convertit les jours fériés reçus en dates avant écriture', async () => {
    const { service, prisma } = buildService();
    prisma.projectSettings.upsert.mockResolvedValue({ id: 's1' });

    await service.updateSettings(PROJECT_ID, USER_ID, {
      publicHolidays: ['2026-12-25'],
    });

    const call = prisma.projectSettings.upsert.mock.calls[0][0] as {
      update: { publicHolidays: Date[] };
    };
    expect(call.update.publicHolidays[0]).toBeInstanceOf(Date);
  });

  it('crée les paramètres via upsert s’ils n’existaient pas encore', async () => {
    const { service, prisma } = buildService();
    prisma.projectSettings.upsert.mockResolvedValue({ id: 's1' });

    await service.updateSettings(PROJECT_ID, USER_ID, { hoursPerDay: 10 });

    expect(prisma.projectSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: PROJECT_ID },
        create: expect.objectContaining({
          projectId: PROJECT_ID,
          hoursPerDay: 10,
        }),
      }),
    );
  });
});
