import "server-only";
import { db } from "./db";

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

interface Outgoing {
  to: string;
  subject: string;
  body: string; // plain text
  kind: "invitation" | "decision_approved" | "decision_rejected";
  projectId?: string;
}

/**
 * Every email goes through here: checks the do-not-contact list, sends via Resend when
 * RESEND_API_KEY is set, and always records the message in EmailLog (audit trail + /dev/outbox).
 */
export async function sendEmail(m: Outgoing): Promise<"sent" | "logged_only" | "suppressed" | "failed"> {
  const to = m.to.trim().toLowerCase();
  let status: "sent" | "logged_only" | "suppressed" | "failed";
  if (await db.suppression.findUnique({ where: { email: to } })) {
    status = "suppressed";
  } else if (!process.env.RESEND_API_KEY) {
    status = "logged_only";
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: m.subject, text: m.body }),
      });
      status = res.ok ? "sent" : "failed";
    } catch {
      status = "failed";
    }
  }
  await db.emailLog.create({ data: { ...m, to, status } });
  return status;
}

/** Footer required on every outreach email: who we are, why they got it, how to stop it. */
export function complianceFooter(optOutUrl: string): string {
  return [
    "",
    "Solera · Plataforma de viabilidad de ensayos clínicos · Madrid",
    "Ha recibido este mensaje porque su dirección figura como contacto institucional de investigación de su centro.",
    "You received this because your address is listed as your site's institutional research contact.",
    `Darse de baja / Unsubscribe: ${optOutUrl}`,
  ].join("\n");
}
