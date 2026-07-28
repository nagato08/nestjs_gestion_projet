import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { ProjectController } from '../src/project/project.controller';
import { ProjectService } from '../src/project/project.service';
import { InvitationService } from '../src/project/invitation.service';
import { ProjectAccessService } from '../src/common/access/project-access.service';
import { PrismaService } from '../src/prisma.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';

/**
 * Parcours HTTP de bout en bout sur les routes projet.
 *
 * Contrairement aux tests unitaires, l'application Nest est réellement
 * montée : le jeton traverse le vrai `JwtAuthGuard`, les entrées passent par
 * le `ValidationPipe` configuré comme en production, et les exceptions métier
 * sont converties en véritables codes HTTP. C'est cette chaîne — et non la
 * logique déjà couverte par ailleurs — que ces tests vérifient.
 *
 * La persistance est simulée : ces cas portent sur l'authentification, les
 * autorisations et le contrat HTTP, pas sur le comportement de PostgreSQL.
 */

const JWT_SECRET = 'secret-de-test';
// La stratégie Passport lit la clé dans l'environnement à sa construction :
// elle doit être posée avant que le module de test ne soit compilé.
process.env.JWT_SECRET = JWT_SECRET;
const PROJECT_ID = 'projet-1';

describe('Routes projet (HTTP)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let projectService: {
    getProjectById: jest.Mock;
    deleteProject: jest.Mock;
    createProject: jest.Mock;
  };

  beforeAll(async () => {
    projectService = {
      getProjectById: jest.fn(),
      deleteProject: jest.fn(),
      createProject: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ global: true, secret: JWT_SECRET }),
      ],
      controllers: [ProjectController],
      providers: [
        // La vraie stratégie : c'est elle qu'on veut éprouver, un guard
        // simulé ne prouverait rien sur la validation des jetons.
        JwtStrategy,
        { provide: ProjectService, useValue: projectService },
        { provide: InvitationService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mêmes réglages qu'en production : sans cela on validerait une
    // application qui n'est pas celle qui tourne.
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Jeton valide pour l'utilisateur donné. */
  const tokenFor = (userId: string, role = 'EMPLOYEE') =>
    jwt.sign({ sub: userId, email: `${userId}@example.com`, role });

  describe('authentification', () => {
    it('refuse l’accès sans jeton', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}`)
        .expect(401);

      expect(projectService.getProjectById).not.toHaveBeenCalled();
    });

    it('refuse un jeton signé avec une autre clé', async () => {
      const forgé = new JwtService({ secret: 'mauvaise-cle' }).sign({
        sub: 'intrus',
      });

      await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}`)
        .set('Authorization', `Bearer ${forgé}`)
        .expect(401);
    });

    it('refuse un jeton expiré', async () => {
      const expiré = jwt.sign({ sub: 'utilisateur-1' }, { expiresIn: '-1h' });

      await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}`)
        .set('Authorization', `Bearer ${expiré}`)
        .expect(401);
    });

    it('laisse passer un jeton valide', async () => {
      projectService.getProjectById.mockResolvedValue({
        id: PROJECT_ID,
        name: 'Projet',
      });

      await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}`)
        .set('Authorization', `Bearer ${tokenFor('utilisateur-1')}`)
        .expect(200);
    });
  });

  describe('autorisations', () => {
    it('traduit un refus métier en 403 et non en erreur serveur', async () => {
      // Un droit insuffisant doit rester un refus explicite : renvoyer 500
      // masquerait la règle et ferait passer une protection pour une panne.
      projectService.deleteProject.mockRejectedValue(
        new ForbiddenException('Action réservée au propriétaire du projet'),
      );

      const response = await request(app.getHttpServer())
        .delete(`/projects/${PROJECT_ID}`)
        .set('Authorization', `Bearer ${tokenFor('utilisateur-1')}`)
        .expect(403);

      expect(response.body.message).toContain('propriétaire');
    });

    it('transmet au service l’identité issue du jeton, jamais celle du corps', async () => {
      // Faire confiance à un identifiant fourni par le client permettrait
      // d'agir au nom d'autrui.
      projectService.deleteProject.mockResolvedValue({ message: 'supprimé' });

      await request(app.getHttpServer())
        .delete(`/projects/${PROJECT_ID}`)
        .set('Authorization', `Bearer ${tokenFor('utilisateur-legitime')}`)
        .send({ userId: 'utilisateur-usurpe' })
        .expect(200);

      const args = projectService.deleteProject.mock.calls[0] as string[];
      expect(args).toContain('utilisateur-legitime');
      expect(args).not.toContain('utilisateur-usurpe');
    });
  });

  describe('validation des entrées', () => {
    it('rejette une création de projet sans les champs obligatoires', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${tokenFor('utilisateur-1', 'ADMIN')}`)
        .send({})
        .expect(400);

      expect(projectService.createProject).not.toHaveBeenCalled();
    });

    it('écarte les champs non déclarés au lieu de les transmettre', async () => {
      // `whitelist: true` : un client ne doit pas pouvoir injecter une
      // propriété que le DTO ne prévoit pas.
      projectService.createProject.mockResolvedValue({ id: PROJECT_ID });

      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${tokenFor('utilisateur-1', 'ADMIN')}`)
        .send({
          name: 'Projet légitime',
          description: 'Description',
          priority: 'HIGH',
          startDate: '2026-01-01',
          champInvente: 'valeur hostile',
        });

      if (projectService.createProject.mock.calls.length > 0) {
        const payload = JSON.stringify(
          projectService.createProject.mock.calls[0],
        );
        expect(payload).not.toContain('champInvente');
        expect(payload).not.toContain('valeur hostile');
      }
    });
  });
});
