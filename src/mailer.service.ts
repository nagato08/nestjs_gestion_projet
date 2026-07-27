import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

const DEFAULT_FROM = 'Forge <noreply@tadjo.dev>';
const APP_NAME = 'Forge';

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

  async sendEmailFromRegister({
    recipient,
    firstName,
  }: {
    recipient: string;
    firstName: string;
  }) {
    try {
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: `Bienvenue sur ${APP_NAME}`,
        html: this.layout(
          `Bienvenue ${firstName} !`,
          `<p>Votre compte ${APP_NAME} a bien été créé. Vous pouvez vous connecter dès maintenant.</p>
           <p><a href="${this.frontendUrl}/login" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Se connecter</a></p>`,
        ),
      });
      this.logger.log(`Email bienvenue envoyé à ${recipient}`);
    } catch (error) {
      this.logger.error('sendEmailFromRegister', error);
      throw error;
    }
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
    try {
      const link = `${this.frontendUrl}/reset-password/${token}`;
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: 'Réinitialisation de votre mot de passe',
        html: this.layout(
          `Bonjour ${firstName}`,
          `<p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour le faire (lien valable 1h) :</p>
           <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Réinitialiser mon mot de passe</a></p>
           <p style="color:#666;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
        ),
      });
      this.logger.log(`Email reset password envoyé à ${recipient}`);
    } catch (error) {
      this.logger.error('sendRequestPasswordEmail', error);
      throw error;
    }
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
    try {
      const loginUrl = `${this.frontendUrl}/login`;
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: `Votre compte ${APP_NAME} a été créé`,
        html: this.layout(
          `Bienvenue ${firstName}`,
          `<p>Un administrateur vient de créer votre compte ${APP_NAME}. Voici vos identifiants de connexion :</p>
           <table cellpadding="8" style="border-collapse:collapse;background:#f9fafb;border-radius:6px;margin:16px 0">
             <tr><td style="color:#6b7280">Email</td><td style="font-family:monospace"><strong>${email}</strong></td></tr>
             <tr><td style="color:#6b7280">Mot de passe</td><td style="font-family:monospace"><strong>${password}</strong></td></tr>
           </table>
           <p><a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Se connecter</a></p>
           <p style="color:#b91c1c;font-size:13px"><strong>Important</strong> : pour des raisons de sécurité, modifiez ce mot de passe dès votre première connexion.</p>`,
        ),
      });
      this.logger.log(`Email credentials envoyé à ${recipient}`);
    } catch (error) {
      this.logger.error('sendAdminCreatedAccountEmail', error);
      throw error;
    }
  }

  /**
   * Invitation à rejoindre un projet.
   *
   * Le lien pointe vers la page d'accueil du projet côté front, avec le token
   * en query : le front y gère l'inscription si nécessaire puis rejoint le
   * projet automatiquement, que le destinataire ait déjà un compte ou non.
   */
  async sendProjectInviteEmail({
    recipient,
    projectName,
    inviterName,
    inviteToken,
  }: {
    recipient: string;
    projectName: string;
    inviterName: string;
    inviteToken: string;
  }) {
    try {
      const link = `${this.frontendUrl}/invite/${inviteToken}`;
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: `${inviterName} vous invite à rejoindre "${projectName}"`,
        html: this.layout(
          'Invitation à un projet',
          `<p><strong>${inviterName}</strong> vous invite à rejoindre le projet <strong>${projectName}</strong> sur ${APP_NAME}.</p>
           <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Rejoindre le projet</a></p>
           <p style="color:#666;font-size:12px">Si vous n'avez pas encore de compte, vous pourrez en créer un depuis ce lien.</p>`,
        ),
      });
      this.logger.log(`Email d'invitation projet envoyé à ${recipient}`);
    } catch (error) {
      this.logger.error('sendProjectInviteEmail', error);
      throw error;
    }
  }

  /** Confirmation envoyée à un membre ajouté ou ayant rejoint un projet. */
  async sendProjectMemberAddedEmail({
    recipient,
    firstName,
    projectName,
  }: {
    recipient: string;
    firstName: string;
    projectName: string;
  }) {
    try {
      const link = `${this.frontendUrl}/projects`;
      await this.mailer.emails.send({
        from: this.from,
        to: [recipient],
        subject: `Vous avez rejoint "${projectName}"`,
        html: this.layout(
          `Bonjour ${firstName}`,
          `<p>Vous faites maintenant partie du projet <strong>${projectName}</strong> sur ${APP_NAME}.</p>
           <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Voir le projet</a></p>`,
        ),
      });
      this.logger.log(`Email membre ajouté envoyé à ${recipient}`);
    } catch (error) {
      // Ne casse jamais l'ajout du membre : l'email est une commodité, pas
      // une condition de succès de l'action.
      this.logger.error('sendProjectMemberAddedEmail', error);
    }
  }

  private layout(title: string, body: string): string {
    return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;color:#111827">
    <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="color:#9ca3af;font-size:12px;margin:0">${APP_NAME} — gestion de projet</p>
  </div>
</body></html>`;
  }
}
