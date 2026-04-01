const nodemailer = require('nodemailer');

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ?{
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || ''
        }
      : undefined
  });
}

async function sendPasswordResetEmail({ to, nome, token, expiraEm }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = createTransport();
  const appUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
  const resetUrl = `${appUrl.replace(/\/$/, '')}/recuperar-senha.html`;
  const subject = 'Recupera?o de senha - Sistema de Processos';
  const expiry = new Date(expiraEm).toLocaleString('pt-BR');

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: [
      `Ol?${nome || 'usuario'},`,
      '',
      'Recebemos uma solicita?o para redefinir sua senha.',
      `Token: ${token}`,
      `Expira em: ${expiry}`,
      `Tela de redefini?o: ${resetUrl}`,
      '',
      'Se voc?n?o solicitou esta altera?o, ignore este e-mail.'
    ].join('\n'),
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#122033;">
        <h2 style="margin:0 0 16px;">Recupera?o de senha</h2>
        <p>Ol?<strong>${nome || 'usuario'}</strong>,</p>
        <p>Recebemos uma solicita?o para redefinir sua senha no Sistema de Processos.</p>
        <div style="margin:20px 0;padding:16px;border:1px solid #d7e0ea;border-radius:12px;background:#f8fbff;">
          <div style="font-size:12px;color:#61748b;margin-bottom:6px;">Token de recupera?o</div>
          <div style="font-size:24px;font-weight:700;letter-spacing:1px;">${token}</div>
          <div style="font-size:12px;color:#61748b;margin-top:8px;">Expira em ${expiry}</div>
        </div>
        <p>Abra a tela <a href="${resetUrl}">${resetUrl}</a> para concluir a redefini?o.</p>
        <p style="color:#61748b;">Se voc?n?o solicitou esta altera?o, ignore este e-mail.</p>
      </div>
    `
  });

  return { sent: true };
}

module.exports = {
  hasSmtpConfig,
  sendPasswordResetEmail
};
