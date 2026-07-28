import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, ProjectRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import { MailerService } from 'src/mailer.service';
import {
  PROJECT_ROLE_RANK,
  ProjectAccessService,
} from 'src/common/access/project-access.service';
import { NotificationHelperService } from 'src/notification/notification-helper.service';

/** Durée de validité d'une invitation. */
const EXPIRES_IN_DAYS = 7;

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    private readonly projectAccess: ProjectAccessService,
    private readonly notificationHelper: NotificationHelperService,
  ) {}

  /**
   * Le token en clair ne vit que dans l'email ; la base n'en garde que le
   * hash. Une fuite de la table ne permet donc pas de rejoindre un projet.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Normalise l'email : la comparaison destinataire/compte doit être fiable. */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Crée une invitation nominative et l'envoie par email.
   *
   * Contrairement au `inviteToken` du projet — un lien partagé valable pour
   * tout le monde — ce token est lié à une adresse précise, expire, et se
   * révoque sans impacter les autres invitations.
   */
  async invite(
    projectId: string,
    actorId: string,
    email: string,
    role: ProjectRole = ProjectRole.MEMBER,
  ) {
    const actorRole = await this.projectAccess.requireManager(
      projectId,
      actorId,
    );

    if (role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Utiliser le transfert de propriété pour désigner un propriétaire',
      );
    }
    // Même garde-fou anti-escalade que l'ajout direct : on n'invite pas
    // quelqu'un à un rang supérieur ou égal au sien.
    if (PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[actorRole]) {
      throw new ForbiddenException(
        'Vous ne pouvez pas attribuer un rôle supérieur ou égal au vôtre',
      );
    }

    const normalizedEmail = this.normalizeEmail(email);

    const [project, actor, existingUser] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { name: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
    ]);

    if (existingUser) {
      const alreadyMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: existingUser.id } },
      });
      if (alreadyMember) {
        throw new ConflictException('Cette personne est déjà membre du projet');
      }
    }

    // Une invitation en attente pour cette adresse est remplacée : on ne
    // laisse pas s'accumuler plusieurs liens valides pour le même destinataire.
    await this.prisma.projectInvitation.updateMany({
      where: {
        projectId,
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRES_IN_DAYS);

    const invitation = await this.prisma.projectInvitation.create({
      data: {
        projectId,
        email: normalizedEmail,
        role,
        tokenHash: this.hashToken(token),
        expiresAt,
        invitedById: actorId,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    await this.mailerService.sendProjectInviteEmail({
      recipient: normalizedEmail,
      projectName: project.name,
      inviterName: `${actor.firstName} ${actor.lastName}`,
      inviteToken: token,
      expiresInDays: EXPIRES_IN_DAYS,
    });

    return invitation;
  }

  /**
   * Consultation d'une invitation par son token, sans authentification.
   *
   * Sert à la page d'atterrissage : elle doit pouvoir annoncer « vous êtes
   * invité au projet X, connectez-vous avec telle adresse » avant même que
   * le visiteur ait un compte. On ne renvoie donc que l'indispensable.
   */
  async preview(token: string) {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        email: true,
        status: true,
        expiresAt: true,
        project: { select: { name: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }

    return {
      projectName: invitation.project.name,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      isExpired: invitation.expiresAt.getTime() <= Date.now(),
    };
  }

  /**
   * Accepte une invitation : ajoute l'utilisateur connecté au projet.
   *
   * L'adresse du compte doit correspondre à celle invitée — c'est ce qui
   * distingue une invitation nominative d'un lien partagé. Sans ce contrôle,
   * transférer l'email suffirait à entrer dans le projet.
   */
  async accept(token: string, userId: string) {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        id: true,
        projectId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ForbiddenException('Cette invitation a été révoquée');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Cette invitation a déjà été utilisée');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Cette invitation a expiré');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    if (this.normalizeEmail(user.email) !== invitation.email) {
      throw new ForbiddenException(
        `Cette invitation est destinée à ${invitation.email}. Connectez-vous avec cette adresse.`,
      );
    }

    const alreadyMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: invitation.projectId, userId },
      },
    });
    if (alreadyMember) {
      // On solde l'invitation malgré tout : elle a rempli son office.
      await this.prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedUserId: userId,
        },
      });
      throw new ConflictException('Vous êtes déjà membre de ce projet');
    }

    // Adhésion et solde de l'invitation dans la même transaction : on ne veut
    // ni membre sans invitation soldée, ni invitation soldée sans membre.
    const [member] = await this.prisma.$transaction([
      this.prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: invitation.role,
        },
      }),
      this.prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedUserId: userId,
        },
      }),
    ]);

    // Même notification que les autres voies d'adhésion (ajout direct, code,
    // lien partagé) : l'utilisateur est prévenu quel que soit le chemin.
    void this.notificationHelper.notifyProjectMemberAdded(
      invitation.projectId,
      userId,
    );

    return member;
  }

  /** Invitations d'un projet, pour affichage dans les paramètres. */
  async list(projectId: string, actorId: string) {
    await this.projectAccess.requireManager(projectId, actorId);

    return this.prisma.projectInvitation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /** Révoque une invitation en attente : le lien envoyé cesse de fonctionner. */
  async revoke(projectId: string, invitationId: string, actorId: string) {
    await this.projectAccess.requireManager(projectId, actorId);

    const invitation = await this.prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId },
      select: { id: true, status: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        'Seule une invitation en attente peut être révoquée',
      );
    }

    return this.prisma.projectInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED },
      select: { id: true, email: true, status: true },
    });
  }
}
