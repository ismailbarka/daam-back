import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Daam Platform" <noreply@daam.com>',
        to,
        subject: 'Vérifiez votre adresse email — Daam',
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 16px;">
              Bienvenue sur Daam 🎓
            </h1>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              Merci de vous être inscrit ! Cliquez sur le bouton ci-dessous pour vérifier votre adresse email et activer votre compte.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verificationUrl}"
                 style="background: #6c5ce7; color: #fff; padding: 14px 32px; border-radius: 8px;
                        text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Vérifier mon email
              </a>
            </div>
            <p style="color: #888; font-size: 13px; line-height: 1.5;">
              Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #aaa; font-size: 12px;">
              © ${new Date().getFullYear()} Daam — Plateforme d'apprentissage guidée
            </p>
          </div>
        `,
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not send email via SMTP (${errorMessage}). Logging verification URL for dev:`);
      this.logger.warn(`>>> VERIFICATION LINK FOR ${to}: ${verificationUrl} <<<`);
    }
  }
}
