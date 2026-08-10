/**
 * SMTP opcional. Si no hay SMTP_HOST, no envía (solo in-app).
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { sent: false, reason: "SMTP_HOST no configurado" };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS || "",
            }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "sigaf@localhost",
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[mail]", e);
    return { sent: false, reason: e instanceof Error ? e.message : "error" };
  }
}
