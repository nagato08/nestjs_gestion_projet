import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { RenderedEmail, emailTemplates } from './mail/templates';

const DEFAULT_FROM = 'Forge <noreply@tadjo.dev>';

/**
 * Transport d'emails.
 *
 * Ne contient plus aucun HTML : le rendu vit dans `mail/templates.ts`. Ce
 * service ne fait que résoudre les URLs de l'application, appeler le gabarit
 * voulu et l'expédier via Resend.
 */
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly mailer: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor() {
    this.mailer = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.MAIL_FROM ?? DEFAULT_FROM;
    this.frontendUrl =
      process.env.FRONTEND_BASE_URL ?? 'https://forge.tadjo.dev';
  }

  /**
   * Envoi générique.
   *
   * `critical` distingue les emails dont l'échec doit remonter (un mot de
   * passe généré qui n'arrive pas rend le compte inutilisable) de ceux qui
   * sont une commodité (confirmation d'ajout à un projet) et ne doivent
   * jamais faire échouer l'action métier qui les a déclenchés.
   */
  private async send(
    recipient: string,
    email: RenderedEmail,
    { critical = true }: { critical?: boolean } = {},
  ): Promise<void> {
    try {
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: email.subject,
        html: email.html,
      });
      this.logger.log(`Email "${email.subject}" envoyé à ${recipient}`);
    } catch (error) {
      this.logger.error(`Échec d'envoi à ${recipient}`, error);
      if (critical) throw error;
    }
  }

  async sendEmailFromRegister({
    recipient,
    firstName,
  }: {
    recipient: string;
    firstName: string;
  }) {
    await this.send(
      recipient,
      emailTemplates.welcome({
        firstName,
        loginUrl: `${this.frontendUrl}/login`,
      }),
    );
  }

  async sendRequestPasswordEmail({
    recipient,
    firstName,
    token,
  }: {
    recipient: string;
    firstName: string;
    token: string;
  }) {
    await this.send(
      recipient,
      emailTemplates.passwordReset({
        firstName,
        resetUrl: `${this.frontendUrl}/reset-password/${token}`,
      }),
    );
  }

  async sendAdminCreatedAccountEmail({
    recipient,
    firstName,
    email,
    password,
  }: {
    recipient: string;
    firstName: string;
    email: string;
    password: string;
  }) {
    await this.send(
      recipient,
      emailTemplates.accountCreatedByAdmin({
        firstName,
        email,
        password,
        loginUrl: `${this.frontendUrl}/login`,
      }),
    );
  }

  /**
   * Invitation nominative. Le token est propre à cette invitation et à cette
   * adresse : il n'ouvre pas le projet à quiconque récupérerait le lien.
   */
  async sendProjectInviteEmail({
    recipient,
    projectName,
    inviterName,
    inviteToken,
    expiresInDays,
  }: {
    recipient: string;
    projectName: string;
    inviterName: string;
    inviteToken: string;
    expiresInDays: number;
  }) {
    await this.send(
      recipient,
      emailTemplates.projectInvite({
        projectName,
        inviterName,
        inviteUrl: `${this.frontendUrl}/invite/${inviteToken}`,
        expiresInDays,
      }),
    );
  }

  /** Confirmation d'ajout à un projet — commodité, jamais bloquante. */
  async sendProjectMemberAddedEmail({
    recipient,
    firstName,
    projectName,
  }: {
    recipient: string;
    firstName: string;
    projectName: string;
  }) {
    await this.send(
      recipient,
      emailTemplates.projectMemberAdded({
        firstName,
        projectName,
        projectUrl: `${this.frontendUrl}/projects`,
      }),
      { critical: false },
    );
  }

  /**
   * Avis d'assignation de tâche — jamais bloquant.
   *
   * Une panne du fournisseur d'email ne doit pas faire échouer l'assignation
   * elle-même : le travail est attribué en base, la notification in-app reste
   * disponible, seul l'avis par email est perdu.
   */
  async sendTaskAssignedEmail({
    recipient,
    firstName,
    taskTitle,
    projectName,
    projectId,
    taskId,
    assignedByName,
    deadline,
  }: {
    recipient: string;
    firstName: string;
    taskTitle: string;
    projectName: string;
    projectId: string;
    taskId: string;
    assignedByName: string;
    deadline: Date | null;
  }) {
    await this.send(
      recipient,
      emailTemplates.taskAssigned({
        firstName,
        taskTitle,
        projectName,
        taskUrl: `${this.frontendUrl}/projects/${projectId}/tasks/${taskId}`,
        assignedByName,
        deadline: deadline
          ? deadline.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : null,
      }),
      { critical: false },
    );
  }
}
