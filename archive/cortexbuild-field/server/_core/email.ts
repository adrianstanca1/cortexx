/**
 * Transactional email via Brevo (formerly Sendinblue) HTTP API.
 *
 * Used for invitee-credential delivery (PIN emails) so the credential never
 * has to round-trip through the tRPC response body — closes SECURITY.md
 * P1-A/F.
 *
 * Design notes:
 *   - HTTP API directly, no SDK dep — keeps node_modules lean.
 *   - In production, missing BREVO_API_KEY THROWS so a misconfigured
 *     deployment can't silently let credential emails drop on the floor.
 *   - In dev, missing key logs a warning and returns success — allows
 *     `pnpm dev` without external service setup.
 *   - Caller-owned error handling: this function THROWS on send failure;
 *     each caller decides whether to roll back the originating action.
 *   - Sender address (EMAIL_FROM) MUST be verified in Brevo (single-sender
 *     verification or domain authentication) — Brevo rejects unverified
 *     senders with 400 "sender not valid".
 */

import { log } from "./logger";

export interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(params: EmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromAddr = process.env.EMAIL_FROM ?? "noreply@cortexbuildpro.com";
  const fromName = process.env.EMAIL_FROM_NAME ?? "CortexBuild Field";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "BREVO_API_KEY is not configured; cannot deliver credential emails in production.",
      );
    }
    // Dev fallback — surface what *would* have been sent so the workflow
    // isn't blocked when running locally without Brevo configured.
    log.warn(
      `[email] BREVO_API_KEY not set — email NOT sent. To: ${params.to}, Subject: ${params.subject}`,
    );
    return;
  }

  const body = {
    sender: { email: fromAddr, name: fromName },
    to: [{ email: params.to }],
    subject: params.subject,
    textContent: params.text,
    ...(params.html ? { htmlContent: params.html } : {}),
  };

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: ${res.status} ${errBody.slice(0, 200)}`);
  }
}
