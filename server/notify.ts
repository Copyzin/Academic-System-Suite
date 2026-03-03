interface PasswordResetEmailPayload {
  to: string;
  userName: string;
  token: string;
  expiresInMinutes: number;
  cancelUrl: string;
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload) {
  const subject = "Recuperacao de senha - Sistema Academico";
  const text = [
    `Ola, ${payload.userName}.`,
    "Recebemos uma solicitacao para redefinir sua senha.",
    `Token numerico (5 digitos): ${payload.token}`,
    `Validade: ${payload.expiresInMinutes} minutos.`,
    "Se voce nao reconhece essa acao, cancele agora pelo link abaixo:",
    payload.cancelUrl,
  ].join("\n\n");

  const webhook = process.env.MAIL_WEBHOOK_URL;

  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payload.to,
          subject,
          text,
        }),
      });

      if (response.ok) {
        return;
      }
    } catch (error) {
      console.error("Falha no envio de e-mail via webhook:", error);
    }
  }

  console.log("[EMAIL_SIMULADO]");
  console.log(`Para: ${payload.to}`);
  console.log(`Assunto: ${subject}`);
  console.log(text);
}
