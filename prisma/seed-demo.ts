/**
 * Jeu de données de démonstration.
 *
 * ⚠️  Ce script VIDE intégralement la base avant de la reremplir. Il est fait
 * pour une instance de démonstration ou de développement, jamais pour une base
 * portant de vraies données.
 *
 * Utilisation en développement :
 *   npm run db:seed              # demande confirmation
 *   npm run db:seed -- --force   # sans confirmation
 *
 * Utilisation en production — l'image est construite avec `--omit=dev`, donc
 * sans ts-node ; c'est la version compilée qu'il faut lancer, et `--force` est
 * nécessaire car `docker compose exec` n'offre pas toujours d'entrée
 * interactive pour la confirmation :
 *   docker compose -f docker-compose.prod.yml exec api \
 *     node dist/prisma/seed-demo.js --force
 *
 * Le jeu produit est volontairement cohérent : les tâches terminées portent
 * une date de complétion, les jalons atteints une date d'atteinte, les congés
 * validés un approbateur. C'est ce qui permet aux écrans calculés — feuille de
 * route, tableau de bord, charge — d'afficher autre chose que des zéros.
 */
import 'dotenv/config';
import * as readline from 'node:readline/promises';
import {
  PrismaClient,
  Role,
  Department,
  Priority,
  ProjectStatus,
  ProjectRole,
  TaskStatus,
  SprintStatus,
  IssueSeverity,
  IssueStatus,
  ConversationType,
  AbsenceType,
  AbsenceStatus,
  CallStatus,
  ProjectMethodology,
  ChargeUnit,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// --- Utilitaires de date -------------------------------------------------
// Toutes les dates sont relatives à l'instant du seed : la démonstration
// reste crédible quelle que soit la date à laquelle on la rejoue.

const DAY = 24 * 60 * 60 * 1000;

function days(offset: number, hour = 9): Date {
  const date = new Date(Date.now() + offset * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Entier pseudo-aléatoire dans [min, max]. */
function between(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// --- Comptes de démonstration -------------------------------------------

/** Mot de passe unique : la page de connexion l'affiche, autant qu'il soit simple. */
const DEMO_PASSWORD = 'Demo1234!';

const PEOPLE = [
  // Les trois comptes mis en avant sur la page de connexion.
  {
    key: 'admin',
    firstName: 'Awa',
    lastName: 'Ndiaye',
    email: 'admin@forge.dev',
    role: Role.ADMIN,
    department: Department.ADMINISTRATION,
    jobTitle: 'Directrice des systèmes d’information',
  },
  {
    key: 'chef',
    firstName: 'Jean',
    lastName: 'Mballa',
    email: 'chef@forge.dev',
    role: Role.PROJECT_MANAGER,
    department: Department.IT,
    jobTitle: 'Chef de projet senior',
  },
  {
    key: 'employe',
    firstName: 'Fatou',
    lastName: 'Diallo',
    email: 'employe@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.IT,
    jobTitle: 'Développeuse full-stack',
  },

  // L'équipe autour, pour que les vues collectives aient de la matière.
  {
    key: 'chef2',
    firstName: 'Marc',
    lastName: 'Etoundi',
    email: 'marc.etoundi@forge.dev',
    role: Role.PROJECT_MANAGER,
    department: Department.OPERATIONS,
    jobTitle: 'Responsable des opérations',
  },
  {
    key: 'dev1',
    firstName: 'Ibrahim',
    lastName: 'Sow',
    email: 'ibrahim.sow@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.IT,
    jobTitle: 'Développeur backend',
  },
  {
    key: 'dev2',
    firstName: 'Chantal',
    lastName: 'Nkemi',
    email: 'chantal.nkemi@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.IT,
    jobTitle: 'Développeuse mobile',
  },
  {
    key: 'design',
    firstName: 'Sarah',
    lastName: 'Bakayoko',
    email: 'sarah.bakayoko@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.MARKETING,
    jobTitle: 'Designer produit',
  },
  {
    key: 'qa',
    firstName: 'Paul',
    lastName: 'Owona',
    email: 'paul.owona@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.OPERATIONS,
    jobTitle: 'Ingénieur qualité',
  },
  {
    key: 'finance',
    firstName: 'Aïcha',
    lastName: 'Traoré',
    email: 'aicha.traore@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.FINANCE,
    jobTitle: 'Contrôleuse de gestion',
  },
  {
    key: 'rh',
    firstName: 'Serge',
    lastName: 'Kamdem',
    email: 'serge.kamdem@forge.dev',
    role: Role.EMPLOYEE,
    department: Department.HR,
    jobTitle: 'Chargé des ressources humaines',
  },
] as const;

type PersonKey = (typeof PEOPLE)[number]['key'];

async function confirmWipe(): Promise<boolean> {
  if (process.argv.includes('--force')) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const url = process.env.DATABASE_URL ?? '(non définie)';
  // On n'affiche jamais le mot de passe de connexion à la base.
  const safeUrl = url.replace(/\/\/([^:]+):[^@]*@/, '//$1:***@');
  console.log(`\n⚠️  Cette opération VIDE la base : ${safeUrl}`);
  const answer = await rl.question('Taper « oui » pour confirmer : ');
  rl.close();
  return answer.trim().toLowerCase() === 'oui';
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    if (!(await confirmWipe())) {
      console.log('Annulé — la base n’a pas été touchée.');
      return;
    }

    // --- Purge ---------------------------------------------------------
    // TRUNCATE ... CASCADE plutôt qu'une cascade de deleteMany : l'ordre des
    // dépendances n'a pas à être maintenu à la main à chaque nouveau modèle.
    console.log('Purge de la base…');
    const tables = [
      'ChatAttachment',
      'ChatMessage',
      'ConversationParticipant',
      'Conversation',
      'Call',
      'Absence',
      'AuditLog',
      'Notification',
      'NotificationSettings',
      'RefreshToken',
      'DocumentComment',
      'DocumentVersion',
      'Document',
      'Comment',
      'TimeEntry',
      'ChecklistItem',
      'TaskRecurrence',
      'TaskDependency',
      'TaskAssignment',
      'ProjectIssue',
      'Task',
      'Sprint',
      'Milestone',
      'Phase',
      'ProjectSettings',
      'ProjectInvitation',
      'ProjectMember',
      'ProjectTemplateTask',
      'ProjectTemplate',
      'Project',
      'User',
      'CompanySettings',
    ];
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );

    // --- Comptes -------------------------------------------------------
    console.log('Création des comptes…');
    const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
    const users: Record<
      string,
      { id: string; firstName: string; lastName: string }
    > = {};

    for (const person of PEOPLE) {
      const created = await prisma.user.create({
        data: {
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          password: hashed,
          role: person.role,
          department: person.department,
          jobTitle: person.jobTitle,
        },
        select: { id: true, firstName: true, lastName: true },
      });
      users[person.key] = created;
    }

    const id = (key: PersonKey) => users[key].id;
    const fullName = (key: PersonKey) =>
      `${users[key].firstName} ${users[key].lastName}`;

    await prisma.companySettings.create({
      data: { companyName: 'Forge Solutions', primaryColor: '#2F81F7' },
    });

    // --- Projets -------------------------------------------------------
    console.log('Création des projets…');

    interface ProjectPlan {
      name: string;
      code: string;
      description: string;
      objectives: string;
      priority: Priority;
      status: ProjectStatus;
      startOffset: number;
      endOffset: number;
      owner: PersonKey;
      team: { key: PersonKey; role: ProjectRole }[];
      budget: number;
      machineCapacity: number;
      chargeUnit: ChargeUnit;
      methodology: ProjectMethodology;
      phases: { name: string; description: string; from: number; to: number }[];
      milestones: { name: string; at: number; reached: boolean }[];
      tasks: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: Priority;
        phase: number;
        from: number;
        to: number;
        points: number;
        assignees: PersonKey[];
        checklist?: string[];
      }[];
    }

    const PROJECTS: ProjectPlan[] = [
      {
        name: 'Plateforme logistique CEMAC',
        code: 'CEMAC-01',
        description:
          'Portail de suivi des expéditions entre Douala, Yaoundé et N’Djamena, avec dédouanement dématérialisé.',
        objectives:
          'Réduire de moitié le délai de traitement douanier et offrir aux transporteurs un suivi en temps réel de leurs conteneurs.',
        priority: Priority.CRITICAL,
        status: ProjectStatus.ACTIVE,
        startOffset: -95,
        endOffset: 70,
        owner: 'chef',
        team: [
          { key: 'admin', role: ProjectRole.ADMIN },
          { key: 'employe', role: ProjectRole.MEMBER },
          { key: 'dev1', role: ProjectRole.MEMBER },
          { key: 'design', role: ProjectRole.MEMBER },
          { key: 'qa', role: ProjectRole.MEMBER },
          { key: 'finance', role: ProjectRole.VIEWER },
        ],
        budget: 48_000_000,
        machineCapacity: 0,
        chargeUnit: ChargeUnit.HOURS,
        methodology: ProjectMethodology.AGILE,
        phases: [
          {
            name: 'Cadrage et analyse',
            description: 'Ateliers avec les douanes et les transitaires.',
            from: -95,
            to: -62,
          },
          {
            name: 'Conception technique',
            description: 'Architecture, modèle de données, maquettes.',
            from: -61,
            to: -32,
          },
          {
            name: 'Développement',
            description:
              'Construction des modules de suivi et de dédouanement.',
            from: -31,
            to: 30,
          },
          {
            name: 'Recette et déploiement',
            description: 'Tests de bout en bout puis mise en production.',
            from: 31,
            to: 70,
          },
        ],
        milestones: [
          { name: 'Cahier des charges validé', at: -63, reached: true },
          { name: 'Maquettes approuvées', at: -34, reached: true },
          { name: 'Première démonstration client', at: -8, reached: true },
          { name: 'Recette fonctionnelle', at: 34, reached: false },
          { name: 'Mise en production', at: 68, reached: false },
        ],
        tasks: [
          {
            title: 'Cartographier le processus douanier actuel',
            description:
              'Entretiens avec quatre transitaires et deux inspecteurs des douanes.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 0,
            from: -94,
            to: -84,
            points: 8,
            assignees: ['chef'],
            checklist: [
              'Entretiens transitaires',
              'Entretiens douanes',
              'Synthèse écrite',
            ],
          },
          {
            title: 'Rédiger le cahier des charges fonctionnel',
            description:
              'Formalisation des exigences issues des ateliers de cadrage.',
            status: TaskStatus.DONE,
            priority: Priority.CRITICAL,
            phase: 0,
            from: -83,
            to: -66,
            points: 13,
            assignees: ['chef', 'admin'],
          },
          {
            title: 'Concevoir le modèle de données des expéditions',
            description:
              'Conteneurs, lots, documents douaniers et jalons de transport.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 1,
            from: -60,
            to: -48,
            points: 8,
            assignees: ['dev1'],
          },
          {
            title: 'Maquetter le tableau de suivi transporteur',
            description:
              'Parcours complet, du dépôt de la déclaration à la livraison.',
            status: TaskStatus.DONE,
            priority: Priority.MEDIUM,
            phase: 1,
            from: -55,
            to: -38,
            points: 5,
            assignees: ['design'],
            checklist: [
              'Parcours mobile',
              'Parcours web',
              'Revue avec le client',
            ],
          },
          {
            title: 'Implémenter l’authentification et les habilitations',
            description:
              'Jetons courts, rafraîchissement, rôles par organisation.',
            status: TaskStatus.DONE,
            priority: Priority.CRITICAL,
            phase: 2,
            from: -30,
            to: -18,
            points: 13,
            assignees: ['employe', 'dev1'],
          },
          {
            title: 'Développer le suivi temps réel des conteneurs',
            description:
              'Flux de positions et notifications de franchissement de poste.',
            status: TaskStatus.DOING,
            priority: Priority.CRITICAL,
            phase: 2,
            from: -17,
            to: 8,
            points: 21,
            assignees: ['employe', 'dev1'],
            checklist: [
              'Flux de positions',
              'Notifications',
              'Historique',
              'Tests de charge',
            ],
          },
          {
            title: 'Intégrer le dédouanement dématérialisé',
            description:
              'Dépôt des pièces justificatives et échange avec le système douanier.',
            status: TaskStatus.DOING,
            priority: Priority.HIGH,
            phase: 2,
            from: -5,
            to: 22,
            points: 21,
            assignees: ['dev1'],
          },
          {
            title: 'Construire le tableau de bord transitaire',
            description: 'Indicateurs de délai, taux de conformité et alertes.',
            status: TaskStatus.TODO,
            priority: Priority.HIGH,
            phase: 2,
            from: 9,
            to: 28,
            points: 13,
            assignees: ['employe', 'design'],
          },
          {
            title: 'Campagne de tests de bout en bout',
            description: 'Scénarios complets sur les trois corridors.',
            status: TaskStatus.TODO,
            priority: Priority.HIGH,
            phase: 3,
            from: 32,
            to: 50,
            points: 13,
            assignees: ['qa'],
          },
          {
            title: 'Former les utilisateurs pilotes',
            description: 'Deux sessions à Douala, une à Yaoundé.',
            status: TaskStatus.TODO,
            priority: Priority.MEDIUM,
            phase: 3,
            from: 48,
            to: 62,
            points: 8,
            assignees: ['chef', 'qa'],
          },
        ],
      },
      {
        name: 'Refonte du site institutionnel',
        code: 'WEB-02',
        description:
          'Nouveau site vitrine multilingue, accessible et optimisé pour la recherche.',
        objectives:
          'Doubler le nombre de demandes de contact entrantes et atteindre le niveau AA d’accessibilité.',
        priority: Priority.MEDIUM,
        status: ProjectStatus.ACTIVE,
        startOffset: -48,
        endOffset: 40,
        owner: 'chef2',
        team: [
          { key: 'design', role: ProjectRole.ADMIN },
          { key: 'employe', role: ProjectRole.MEMBER },
          { key: 'dev2', role: ProjectRole.MEMBER },
          { key: 'admin', role: ProjectRole.VIEWER },
        ],
        budget: 9_500_000,
        machineCapacity: 0,
        chargeUnit: ChargeUnit.PERSON_DAYS,
        methodology: ProjectMethodology.AGILE,
        phases: [
          {
            name: 'Direction artistique',
            description: 'Recherche graphique et validation du parti pris.',
            from: -48,
            to: -26,
          },
          {
            name: 'Intégration',
            description: 'Développement des gabarits et du contenu.',
            from: -25,
            to: 18,
          },
          {
            name: 'Référencement et mise en ligne',
            description: 'Optimisation, mesures et bascule.',
            from: 19,
            to: 40,
          },
        ],
        milestones: [
          { name: 'Direction artistique validée', at: -27, reached: true },
          { name: 'Contenus livrés', at: -3, reached: true },
          { name: 'Mise en ligne', at: 38, reached: false },
        ],
        tasks: [
          {
            title: 'Explorer trois pistes graphiques',
            description: 'Planches d’ambiance et déclinaisons typographiques.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 0,
            from: -47,
            to: -34,
            points: 8,
            assignees: ['design'],
          },
          {
            title: 'Construire le système de composants',
            description: 'Bibliothèque partagée entre les gabarits.',
            status: TaskStatus.DONE,
            priority: Priority.MEDIUM,
            phase: 1,
            from: -24,
            to: -10,
            points: 13,
            assignees: ['design', 'dev2'],
          },
          {
            title: 'Intégrer les gabarits principaux',
            description: 'Accueil, offres, références et contact.',
            status: TaskStatus.DOING,
            priority: Priority.HIGH,
            phase: 1,
            from: -9,
            to: 12,
            points: 13,
            assignees: ['dev2', 'employe'],
            checklist: ['Accueil', 'Offres', 'Références', 'Contact'],
          },
          {
            title: 'Traduire l’ensemble du contenu',
            description: 'Français, anglais et espagnol.',
            status: TaskStatus.DOING,
            priority: Priority.MEDIUM,
            phase: 1,
            from: -2,
            to: 16,
            points: 8,
            assignees: ['design'],
          },
          {
            title: 'Audit d’accessibilité niveau AA',
            description: 'Contrastes, navigation clavier, lecteurs d’écran.',
            status: TaskStatus.TODO,
            priority: Priority.HIGH,
            phase: 2,
            from: 20,
            to: 30,
            points: 8,
            assignees: ['dev2'],
          },
          {
            title: 'Basculer le nom de domaine',
            description: 'Redirections, certificats et surveillance.',
            status: TaskStatus.TODO,
            priority: Priority.CRITICAL,
            phase: 2,
            from: 33,
            to: 38,
            points: 5,
            assignees: ['employe'],
          },
        ],
      },
      {
        name: 'Modernisation de l’atelier de production',
        code: 'PROD-03',
        description:
          'Suivi numérique de la ligne d’assemblage et maintenance préventive des machines.',
        objectives:
          'Réduire les arrêts non planifiés d’un tiers et tracer chaque lot produit.',
        priority: Priority.HIGH,
        status: ProjectStatus.ACTIVE,
        startOffset: -30,
        endOffset: 110,
        owner: 'chef2',
        team: [
          { key: 'chef', role: ProjectRole.ADMIN },
          { key: 'dev1', role: ProjectRole.MEMBER },
          { key: 'qa', role: ProjectRole.MEMBER },
          { key: 'finance', role: ProjectRole.VIEWER },
        ],
        budget: 72_000_000,
        // Ligne d'assemblage disponible seize heures par jour : le plafond est
        // collectif, il ne dépend pas du nombre de personnes qui s'y relaient.
        machineCapacity: 16,
        chargeUnit: ChargeUnit.HOURS,
        methodology: ProjectMethodology.CLASSIC,
        phases: [
          {
            name: 'Audit de l’existant',
            description: 'Relevé des équipements et des pannes historiques.',
            from: -30,
            to: -6,
          },
          {
            name: 'Équipement des machines',
            description: 'Capteurs, collecte et remontée des données.',
            from: -5,
            to: 55,
          },
          {
            name: 'Maintenance préventive',
            description: 'Modèles de prédiction et plans d’intervention.',
            from: 56,
            to: 110,
          },
        ],
        milestones: [
          { name: 'Audit restitué', at: -7, reached: true },
          { name: 'Première machine instrumentée', at: 12, reached: false },
          { name: 'Ligne complète connectée', at: 52, reached: false },
        ],
        tasks: [
          {
            title: 'Inventorier le parc machines',
            description: 'Vingt-huit équipements, âge et historique de panne.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 0,
            from: -29,
            to: -16,
            points: 8,
            assignees: ['qa', 'chef2'],
          },
          {
            title: 'Chiffrer les arrêts de production',
            description: 'Coût horaire d’immobilisation par machine.',
            status: TaskStatus.DONE,
            priority: Priority.MEDIUM,
            phase: 0,
            from: -20,
            to: -8,
            points: 5,
            assignees: ['finance'],
          },
          {
            title: 'Installer les capteurs sur la ligne A',
            description: 'Température, vibration et compteur de cycles.',
            status: TaskStatus.DOING,
            priority: Priority.CRITICAL,
            phase: 1,
            from: -4,
            to: 14,
            points: 13,
            assignees: ['qa', 'dev1'],
            checklist: ['Commande matériel', 'Pose', 'Étalonnage', 'Recette'],
          },
          {
            title: 'Développer la collecte des mesures',
            description: 'Passerelle et stockage temporel des relevés.',
            status: TaskStatus.DOING,
            priority: Priority.HIGH,
            phase: 1,
            from: 1,
            to: 26,
            points: 21,
            assignees: ['dev1'],
          },
          {
            title: 'Instrumenter les lignes B et C',
            description: 'Réplication du dispositif validé sur la ligne A.',
            status: TaskStatus.TODO,
            priority: Priority.HIGH,
            phase: 1,
            from: 18,
            to: 50,
            points: 21,
            assignees: ['qa'],
          },
          {
            title: 'Modéliser les signaux avant-coureurs',
            description: 'Détection des dérives à partir de l’historique.',
            status: TaskStatus.TODO,
            priority: Priority.MEDIUM,
            phase: 2,
            from: 58,
            to: 88,
            points: 21,
            assignees: ['dev1'],
          },
        ],
      },
      {
        name: 'Migration du système comptable',
        code: 'FIN-04',
        description:
          'Reprise de l’historique et bascule vers le nouveau progiciel de gestion.',
        objectives:
          'Clôturer l’exercice sur le nouvel outil sans rupture de piste d’audit.',
        priority: Priority.HIGH,
        status: ProjectStatus.COMPLETED,
        startOffset: -220,
        endOffset: -20,
        owner: 'chef',
        team: [
          { key: 'finance', role: ProjectRole.ADMIN },
          { key: 'admin', role: ProjectRole.MEMBER },
          { key: 'dev1', role: ProjectRole.MEMBER },
        ],
        budget: 15_000_000,
        machineCapacity: 0,
        chargeUnit: ChargeUnit.HOURS,
        methodology: ProjectMethodology.CLASSIC,
        phases: [
          {
            name: 'Reprise des données',
            description: 'Extraction, nettoyage et rapprochement.',
            from: -220,
            to: -140,
          },
          {
            name: 'Paramétrage',
            description: 'Plan comptable et règles de gestion.',
            from: -139,
            to: -70,
          },
          {
            name: 'Bascule',
            description: 'Double saisie puis arrêt de l’ancien système.',
            from: -69,
            to: -20,
          },
        ],
        milestones: [
          { name: 'Balance de reprise validée', at: -145, reached: true },
          { name: 'Paramétrage recetté', at: -74, reached: true },
          { name: 'Bascule effective', at: -22, reached: true },
        ],
        tasks: [
          {
            title: 'Extraire dix ans d’écritures',
            description: 'Export complet et contrôle d’intégrité.',
            status: TaskStatus.DONE,
            priority: Priority.CRITICAL,
            phase: 0,
            from: -218,
            to: -186,
            points: 13,
            assignees: ['dev1'],
          },
          {
            title: 'Rapprocher les balances',
            description: 'Contrôle poste à poste avec l’ancien système.',
            status: TaskStatus.DONE,
            priority: Priority.CRITICAL,
            phase: 0,
            from: -185,
            to: -148,
            points: 21,
            assignees: ['finance'],
          },
          {
            title: 'Paramétrer le plan comptable',
            description: 'Adaptation au référentiel OHADA révisé.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 1,
            from: -138,
            to: -96,
            points: 13,
            assignees: ['finance', 'admin'],
          },
          {
            title: 'Période de double saisie',
            description: 'Un mois en parallèle sur les deux outils.',
            status: TaskStatus.DONE,
            priority: Priority.HIGH,
            phase: 2,
            from: -68,
            to: -34,
            points: 8,
            assignees: ['finance'],
          },
          {
            title: 'Arrêter l’ancien système',
            description: 'Archivage et retrait des accès.',
            status: TaskStatus.DONE,
            priority: Priority.MEDIUM,
            phase: 2,
            from: -30,
            to: -22,
            points: 5,
            assignees: ['dev1', 'admin'],
          },
        ],
      },
    ];

    const createdProjects: {
      id: string;
      plan: ProjectPlan;
      taskIds: string[];
      memberIds: string[];
    }[] = [];

    for (const plan of PROJECTS) {
      const project = await prisma.project.create({
        data: {
          name: plan.name,
          description: plan.description,
          objectives: plan.objectives,
          priority: plan.priority,
          status: plan.status,
          startDate: days(plan.startOffset),
          endDate: days(plan.endOffset),
          projectCode: plan.code,
          ownerId: id(plan.owner),
          createdAt: days(plan.startOffset - 2),
        },
        select: { id: true },
      });

      await prisma.projectSettings.create({
        data: {
          projectId: project.id,
          hoursPerDay: 8,
          workingDays: [1, 2, 3, 4, 5],
          machineCapacityPerDay: plan.machineCapacity,
          lateAlertThresholdDays: 3,
          budgetAmount: plan.budget,
          currency: 'XAF',
          methodology: plan.methodology,
          chargeUnit: plan.chargeUnit,
        },
      });

      // Le propriétaire est membre à part entière : les vues d'équipe et le
      // calcul de charge s'appuient sur ProjectMember, pas sur ownerId.
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: id(plan.owner),
          role: ProjectRole.OWNER,
        },
      });
      for (const member of plan.team) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: id(member.key),
            role: member.role,
          },
        });
      }
      const memberIds = [id(plan.owner), ...plan.team.map((m) => id(m.key))];

      const phaseIds: string[] = [];
      for (const [index, phase] of plan.phases.entries()) {
        const created = await prisma.phase.create({
          data: {
            projectId: project.id,
            name: phase.name,
            description: phase.description,
            startDate: days(phase.from),
            endDate: days(phase.to),
            order: index,
          },
          select: { id: true },
        });
        phaseIds.push(created.id);
      }

      for (const milestone of plan.milestones) {
        await prisma.milestone.create({
          data: {
            projectId: project.id,
            name: milestone.name,
            date: days(milestone.at),
            reached: milestone.reached,
            // Figée au passage, comme le fait le service : un jalon atteint
            // porte la date de son atteinte, pas celle de sa création.
            reachedAt: milestone.reached ? days(milestone.at, 17) : null,
          },
        });
      }

      // Sprints : uniquement pour les projets menés en agile.
      const sprintIds: string[] = [];
      if (plan.methodology === ProjectMethodology.AGILE) {
        const cadence = [
          {
            name: 'Sprint 1',
            from: -42,
            to: -29,
            status: SprintStatus.COMPLETED,
          },
          {
            name: 'Sprint 2',
            from: -28,
            to: -15,
            status: SprintStatus.COMPLETED,
          },
          {
            name: 'Sprint 3',
            from: -14,
            to: -1,
            status: SprintStatus.COMPLETED,
          },
          { name: 'Sprint 4', from: 0, to: 13, status: SprintStatus.ACTIVE },
          { name: 'Sprint 5', from: 14, to: 27, status: SprintStatus.PLANNED },
        ];
        for (const sprint of cadence) {
          const created = await prisma.sprint.create({
            data: {
              projectId: project.id,
              name: sprint.name,
              goal: `Objectif de ${sprint.name.toLowerCase()} pour ${plan.name}.`,
              startDate: days(sprint.from),
              endDate: days(sprint.to),
              status: sprint.status,
            },
            select: { id: true },
          });
          sprintIds.push(created.id);
        }
      }

      // --- Tâches ------------------------------------------------------
      const taskIds: string[] = [];
      for (const task of plan.tasks) {
        const done = task.status === TaskStatus.DONE;
        const created = await prisma.task.create({
          data: {
            projectId: project.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            phaseId: phaseIds[task.phase],
            // Une tâche est rattachée au sprint qui recouvre sa période.
            sprintId:
              sprintIds.length > 0 && task.from >= -42 && task.from <= 27
                ? sprintIds[Math.min(4, Math.floor((task.from + 42) / 14))]
                : null,
            startDate: days(task.from),
            endDate: days(task.to),
            deadline: days(task.to, 18),
            // Référence figée : sur les projets déjà lancés, elle permet de
            // mesurer la dérive. Deux tâches dérivent volontairement.
            baselineStart: days(task.from),
            baselineEnd: days(
              task.to - (task.status === TaskStatus.DOING ? 4 : 0),
            ),
            completedAt: done ? days(task.to, 16) : null,
            storyPoints: task.points,
            optimisticDays: Math.max(
              1,
              Math.round((task.to - task.from) * 0.7),
            ),
            probableDays: Math.max(1, task.to - task.from),
            pessimisticDays: Math.max(
              2,
              Math.round((task.to - task.from) * 1.5),
            ),
            createdAt: days(task.from - 3),
          },
          select: { id: true },
        });
        taskIds.push(created.id);

        for (const assignee of task.assignees) {
          await prisma.taskAssignment.create({
            data: { taskId: created.id, userId: id(assignee) },
          });
        }

        if (task.checklist) {
          for (const [position, label] of task.checklist.entries()) {
            await prisma.checklistItem.create({
              data: {
                taskId: created.id,
                label,
                // Une tâche terminée a toute sa liste cochée ; une tâche en
                // cours, seulement son début.
                done:
                  done || (task.status === TaskStatus.DOING && position === 0),
                position,
              },
            });
          }
        }

        // Temps passé : uniquement sur ce qui est engagé ou terminé.
        if (task.status !== TaskStatus.TODO) {
          for (const assignee of task.assignees) {
            const sessions = done ? between(3, 6) : between(2, 4);
            for (let s = 0; s < sessions; s++) {
              const offset = between(
                Math.min(task.from, -1),
                Math.min(task.to, -1),
              );
              const minutes = between(90, 270);
              const start = days(offset, between(8, 15));
              await prisma.timeEntry.create({
                data: {
                  taskId: created.id,
                  userId: id(assignee),
                  startTime: start,
                  endTime: new Date(start.getTime() + minutes * 60_000),
                  duration: minutes,
                  isManual: Math.random() > 0.6,
                },
              });
            }
          }
        }
      }

      // Dépendances : chaque tâche bloque la suivante de sa phase.
      for (let i = 1; i < plan.tasks.length; i++) {
        if (plan.tasks[i].phase === plan.tasks[i - 1].phase) {
          await prisma.taskDependency.create({
            data: {
              blockingTaskId: taskIds[i - 1],
              blockedTaskId: taskIds[i],
              lagDays: 0,
            },
          });
        }
      }

      // Commentaires sur quelques tâches engagées.
      const commentables = plan.tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => task.status !== TaskStatus.TODO);
      for (const { task, index } of commentables.slice(0, 4)) {
        const author = task.assignees[0];
        await prisma.comment.create({
          data: {
            taskId: taskIds[index],
            userId: id(author),
            content: pick([
              'Point d’avancement fait avec l’équipe, rien de bloquant pour l’instant.',
              'J’ai repris la partie qui posait problème, c’est plus clair maintenant.',
              'Attention, cette tâche dépend de la livraison du prestataire.',
              'Première version prête, je passe la main pour relecture.',
            ]),
            createdAt: days(between(task.from, Math.min(task.to, -1)), 14),
          },
        });
      }

      createdProjects.push({ id: project.id, plan, taskIds, memberIds });
    }

    // --- Documents -----------------------------------------------------
    console.log('Création des documents…');
    const DOCS = [
      'Cahier des charges.pdf',
      'Compte rendu de réunion.pdf',
      'Planning prévisionnel.xlsx',
      'Budget détaillé.xlsx',
      'Spécifications techniques.pdf',
    ];
    for (const { id: projectId, plan, memberIds } of createdProjects) {
      for (const name of DOCS.slice(0, between(3, 5))) {
        const document = await prisma.document.create({
          data: {
            projectId,
            name,
            uploadedBy: pick(memberIds),
            createdAt: days(between(plan.startOffset, -5)),
          },
          select: { id: true },
        });
        const versions = between(1, 3);
        for (let v = 1; v <= versions; v++) {
          await prisma.documentVersion.create({
            data: {
              documentId: document.id,
              version: v,
              fileUrl: `https://res.cloudinary.com/demo/raw/upload/forge/${document.id}-v${v}`,
              fileSize: between(120_000, 4_500_000),
              createdAt: days(between(plan.startOffset, -3)),
            },
          });
        }
      }
    }

    // --- Difficultés ---------------------------------------------------
    console.log('Création du journal des difficultés…');
    const ISSUES: {
      project: number;
      title: string;
      description: string;
      severity: IssueSeverity;
      status: IssueStatus;
      reporter: PersonKey;
      action?: string;
    }[] = [
      {
        project: 0,
        title: 'Retard de livraison des badges douaniers',
        description:
          'Le prestataire annonce trois semaines de délai supplémentaire, ce qui décale les tests sur site.',
        severity: IssueSeverity.HIGH,
        status: IssueStatus.IN_PROGRESS,
        reporter: 'employe',
        action:
          'Relance hebdomadaire et recherche d’un fournisseur de secours.',
      },
      {
        project: 0,
        title: 'Connexion instable au poste frontière de Kyé-Ossi',
        description:
          'La liaison tombe plusieurs fois par jour, ce qui interrompt la remontée des positions.',
        severity: IssueSeverity.MEDIUM,
        status: IssueStatus.OPEN,
        reporter: 'dev1',
      },
      {
        project: 0,
        title: 'Format des déclarations non documenté',
        description:
          'Le format attendu par le système douanier n’était pas spécifié ; il a fallu le reconstituer.',
        severity: IssueSeverity.MEDIUM,
        status: IssueStatus.RESOLVED,
        reporter: 'dev1',
        action:
          'Format reconstitué avec les douanes et documenté dans le dépôt.',
      },
      {
        project: 1,
        title: 'Contenus multilingues livrés en retard',
        description:
          'Les traductions espagnoles manquent encore, ce qui bloque deux gabarits.',
        severity: IssueSeverity.MEDIUM,
        status: IssueStatus.OPEN,
        reporter: 'design',
      },
      {
        project: 2,
        title: 'Vibrations parasites sur le capteur de la ligne A',
        description:
          'Les relevés remontent des pics qui ne correspondent à aucun cycle réel.',
        severity: IssueSeverity.HIGH,
        status: IssueStatus.IN_PROGRESS,
        reporter: 'qa',
        action: 'Repositionnement du capteur et filtrage logiciel à l’étude.',
      },
      {
        project: 2,
        title: 'Arrêt non planifié de la ligne B',
        description:
          'Quatre heures d’immobilisation, cause mécanique confirmée.',
        severity: IssueSeverity.LOW,
        status: IssueStatus.RESOLVED,
        reporter: 'chef2',
        action: 'Pièce remplacée, la ligne a redémarré le jour même.',
      },
    ];
    for (const issue of ISSUES) {
      const target = createdProjects[issue.project];
      const resolved = issue.status === IssueStatus.RESOLVED;
      await prisma.projectIssue.create({
        data: {
          projectId: target.id,
          taskId: pick(target.taskIds),
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          status: issue.status,
          correctiveAction: issue.action ?? null,
          reportedById: id(issue.reporter),
          resolvedAt: resolved ? days(between(-20, -2), 15) : null,
          createdAt: days(between(-45, -5), 11),
        },
      });
    }

    // --- Conversations -------------------------------------------------
    console.log('Création des conversations…');
    const PROJECT_TALK = [
      'Bonjour à tous, le point hebdomadaire est décalé à demain 10 h.',
      'J’ai poussé la dernière version, vous pouvez relire quand vous voulez.',
      'Le client a validé les maquettes, on peut enchaîner sur l’intégration.',
      'Attention, la recette commence lundi : merci de clôturer vos tâches d’ici vendredi.',
      'Compte rendu de la réunion déposé dans les documents du projet.',
    ];
    for (const { id: projectId, memberIds } of createdProjects) {
      const conversation = await prisma.conversation.create({
        data: { projectId, type: ConversationType.PROJECT },
        select: { id: true },
      });
      for (const [index, content] of PROJECT_TALK.entries()) {
        await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: pick(memberIds),
            content,
            createdAt: days(-10 + index * 2, between(9, 17)),
          },
        });
      }
    }

    // Fils directs : trois échanges entre les comptes mis en avant.
    const DIRECT_THREADS: {
      a: PersonKey;
      b: PersonKey;
      messages: [PersonKey, string][];
    }[] = [
      {
        a: 'chef',
        b: 'employe',
        messages: [
          [
            'chef',
            'Bonjour Fatou, où en est le suivi temps réel des conteneurs ?',
          ],
          [
            'employe',
            'Le flux de positions fonctionne, il me reste les notifications de franchissement.',
          ],
          ['chef', 'Parfait. Tu penses tenir la démonstration de vendredi ?'],
          [
            'employe',
            'Oui sans problème, je garde une marge pour les tests de charge.',
          ],
        ],
      },
      {
        a: 'admin',
        b: 'chef',
        messages: [
          [
            'admin',
            'Jean, peux-tu valider les deux demandes de congé en attente ?',
          ],
          [
            'chef',
            'Je regarde ça ce matin, il faut juste que je vérifie la couverture sur le sprint en cours.',
          ],
        ],
      },
      {
        a: 'employe',
        b: 'dev1',
        messages: [
          [
            'employe',
            'Tu as une idée du format attendu pour les déclarations douanières ?',
          ],
          [
            'dev1',
            'Oui, je l’ai reconstitué avec les douanes — c’est documenté dans le dépôt maintenant.',
          ],
          ['employe', 'Excellent, merci, ça me débloque.'],
        ],
      },
    ];
    for (const thread of DIRECT_THREADS) {
      const conversation = await prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          participants: {
            create: [{ userId: id(thread.a) }, { userId: id(thread.b) }],
          },
        },
        select: { id: true },
      });
      for (const [index, [sender, content]] of thread.messages.entries()) {
        await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: id(sender),
            content,
            createdAt: days(-4, 9 + index),
          },
        });
      }
    }

    // --- Disponibilités ------------------------------------------------
    console.log('Création des disponibilités…');
    const ABSENCES: {
      user: PersonKey;
      type: AbsenceType;
      from: number;
      to: number;
      status: AbsenceStatus;
      reason?: string;
      note?: string;
    }[] = [
      {
        user: 'employe',
        type: AbsenceType.LEAVE,
        from: 12,
        to: 19,
        status: AbsenceStatus.APPROVED,
        reason: 'Congés annuels',
      },
      {
        user: 'dev1',
        type: AbsenceType.TRAINING,
        from: 5,
        to: 6,
        status: AbsenceStatus.APPROVED,
        reason: 'Formation sécurité applicative',
      },
      {
        user: 'design',
        type: AbsenceType.REMOTE,
        from: 2,
        to: 2,
        status: AbsenceStatus.APPROVED,
      },
      {
        user: 'qa',
        type: AbsenceType.SICK,
        from: -3,
        to: -2,
        status: AbsenceStatus.APPROVED,
      },
      {
        user: 'dev2',
        type: AbsenceType.LEAVE,
        from: 22,
        to: 30,
        status: AbsenceStatus.PENDING,
        reason: 'Vacances en famille',
      },
      {
        user: 'finance',
        type: AbsenceType.LEAVE,
        from: 9,
        to: 16,
        status: AbsenceStatus.PENDING,
        reason: 'Congés',
      },
      {
        user: 'rh',
        type: AbsenceType.LEAVE,
        from: 4,
        to: 11,
        status: AbsenceStatus.REJECTED,
        reason: 'Congés',
        note: 'Période de clôture, merci de décaler après le 20.',
      },
    ];
    for (const absence of ABSENCES) {
      const decided = absence.status !== AbsenceStatus.PENDING;
      const start = days(absence.from, 0);
      const end = days(absence.to, 23);
      end.setMinutes(59, 59, 999);
      await prisma.absence.create({
        data: {
          userId: id(absence.user),
          type: absence.type,
          startDate: start,
          endDate: end,
          reason: absence.reason ?? null,
          status: absence.status,
          // Une décision porte toujours un décideur et une date : c'est ce
          // couple qui distingue une demande traitée d'une demande en attente.
          approverId: decided ? id('chef') : null,
          decidedAt: decided ? days(-2, 10) : null,
          decisionNote: absence.note ?? null,
          createdAt: days(absence.from - between(6, 15), 9),
        },
      });
    }

    // --- Appels --------------------------------------------------------
    console.log('Création de l’historique d’appels…');
    const CALLS: {
      caller: PersonKey;
      callee: PersonKey;
      status: CallStatus;
      ago: number;
      seconds: number;
    }[] = [
      {
        caller: 'chef',
        callee: 'employe',
        status: CallStatus.ANSWERED,
        ago: -1,
        seconds: 412,
      },
      {
        caller: 'employe',
        callee: 'dev1',
        status: CallStatus.ANSWERED,
        ago: -2,
        seconds: 138,
      },
      {
        caller: 'admin',
        callee: 'chef',
        status: CallStatus.ANSWERED,
        ago: -3,
        seconds: 905,
      },
      {
        caller: 'dev1',
        callee: 'employe',
        status: CallStatus.MISSED,
        ago: -4,
        seconds: 0,
      },
      {
        caller: 'chef',
        callee: 'design',
        status: CallStatus.REJECTED,
        ago: -5,
        seconds: 0,
      },
    ];
    for (const call of CALLS) {
      const startedAt = days(call.ago, between(9, 17));
      const answered = call.status === CallStatus.ANSWERED;
      await prisma.call.create({
        data: {
          callerId: id(call.caller),
          calleeId: id(call.callee),
          status: call.status,
          startedAt,
          // La durée se compte à partir du décrochage, jamais de la sonnerie.
          answeredAt: answered ? new Date(startedAt.getTime() + 8_000) : null,
          endedAt: new Date(startedAt.getTime() + 8_000 + call.seconds * 1000),
        },
      });
    }

    // --- Notifications -------------------------------------------------
    console.log('Création des notifications…');
    const NOTIFICATIONS: {
      user: PersonKey;
      type: string;
      content: string;
      read: boolean;
      ago: number;
    }[] = [
      {
        user: 'employe',
        type: 'TASK_ASSIGNED',
        content: `${fullName('chef')} vous a assigné la tâche « Développer le suivi temps réel des conteneurs »`,
        read: false,
        ago: -1,
      },
      {
        user: 'employe',
        type: 'ABSENCE_DECIDED',
        content: 'Votre demande de congé du 12 au 19 a été approuvée',
        read: false,
        ago: -2,
      },
      {
        user: 'chef',
        type: 'ABSENCE_REQUESTED',
        content: `${fullName('dev2')} demande un congé du 22 au 30`,
        read: false,
        ago: -1,
      },
      {
        user: 'chef',
        type: 'ABSENCE_REQUESTED',
        content: `${fullName('finance')} demande un congé du 9 au 16`,
        read: false,
        ago: -2,
      },
      {
        user: 'chef',
        type: 'TASK_STATUS_CHANGED',
        content:
          'La tâche « Intégrer le dédouanement dématérialisé » est passée en cours',
        read: true,
        ago: -4,
      },
      {
        user: 'employe',
        type: 'CALL_MISSED',
        content: `Appel manqué de ${fullName('dev1')}`,
        read: true,
        ago: -4,
      },
      {
        user: 'admin',
        type: 'DOCUMENT_UPLOADED',
        content:
          'Un nouveau document a été déposé sur Plateforme logistique CEMAC',
        read: true,
        ago: -6,
      },
      {
        user: 'dev1',
        type: 'TASK_COMMENT',
        content: `${fullName('employe')} a commenté une tâche qui vous est assignée`,
        read: false,
        ago: -3,
      },
    ];
    for (const notification of NOTIFICATIONS) {
      await prisma.notification.create({
        data: {
          userId: id(notification.user),
          type: notification.type,
          content: notification.content,
          isRead: notification.read,
          createdAt: days(notification.ago, between(8, 18)),
        },
      });
    }

    // --- Journal d'audit -----------------------------------------------
    console.log('Création du journal d’audit…');
    const AUDIT: { user: PersonKey; action: string; targetType: string }[] = [
      { user: 'admin', action: 'user.create_by_admin', targetType: 'User' },
      { user: 'chef', action: 'project.update', targetType: 'Project' },
      {
        user: 'chef',
        action: 'project.member.add',
        targetType: 'ProjectMember',
      },
      { user: 'chef', action: 'task.assign', targetType: 'Task' },
      { user: 'employe', action: 'task.status.update', targetType: 'Task' },
      { user: 'chef', action: 'project.baseline.set', targetType: 'Project' },
      {
        user: 'admin',
        action: 'project.settings.update',
        targetType: 'ProjectSettings',
      },
      { user: 'chef', action: 'absence.decide', targetType: 'User' },
      { user: 'dev1', action: 'issue.create', targetType: 'ProjectIssue' },
      { user: 'chef', action: 'issue.update', targetType: 'ProjectIssue' },
      {
        user: 'admin',
        action: 'project.member.role.update',
        targetType: 'ProjectMember',
      },
      { user: 'chef', action: 'milestone.update', targetType: 'Milestone' },
    ];
    for (const [index, entry] of AUDIT.entries()) {
      const person = PEOPLE.find((p) => p.key === entry.user)!;
      await prisma.auditLog.create({
        data: {
          userId: id(entry.user),
          userEmail: person.email,
          action: entry.action,
          targetType: entry.targetType,
          targetId: pick(createdProjects).id,
          ip: `41.202.${between(10, 250)}.${between(2, 250)}`,
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          createdAt: days(-index - 1, between(8, 19)),
        },
      });
    }

    // --- Récapitulatif -------------------------------------------------
    const counts = {
      comptes: await prisma.user.count(),
      projets: await prisma.project.count(),
      taches: await prisma.task.count(),
      phases: await prisma.phase.count(),
      jalons: await prisma.milestone.count(),
      sprints: await prisma.sprint.count(),
      pointages: await prisma.timeEntry.count(),
      documents: await prisma.document.count(),
      difficultes: await prisma.projectIssue.count(),
      messages: await prisma.chatMessage.count(),
      disponibilites: await prisma.absence.count(),
      appels: await prisma.call.count(),
      notifications: await prisma.notification.count(),
      audit: await prisma.auditLog.count(),
    };

    console.log('\n✅ Base de démonstration prête.\n');
    for (const [label, value] of Object.entries(counts)) {
      console.log(`   ${label.padEnd(16)} ${value}`);
    }
    console.log(`\n   Mot de passe commun : ${DEMO_PASSWORD}`);
    console.log('   admin@forge.dev · chef@forge.dev · employe@forge.dev\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Échec du seed :', error);
  process.exit(1);
});
