/**
 * Password-reset email template — pure function returning a {subject, text,
 * html} body. Matches the shape of `rfi.ts` and `pin-email.ts`. The router
 * fills `to` per recipient.
 *
 * Tokens are minted by `server/_core/auth-tokens.ts` and embedded as
 * `?token=<jwt>` on the `/reset-password` route. Tokens are signed with
 * JWT_SECRET, valid for 30 minutes, and become single-use the moment the
 * password rotates (the verifier compares a passwordHash-prefix claim).
 */

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://field.cortexbuildpro.com";

type Body = { subject: string; text: string; html: string };

function resetLink(token: string): string {
  return `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlWrap(htmlBody: string, ctaUrl: string): string {
  const paragraphs = htmlBody
    .split("\n\n")
    .map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;">${paragraphs}<p style="margin:24px 0 0 0;"><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p><p style="margin:24px 0 0 0;font-size:12px;color:#6B7280;">If the button doesn't work, copy this link into your browser:<br/><span style="word-break:break-all;">${ctaUrl}</span></p></div>`;
}

export function passwordResetEmail(args: {
  recipientName: string | null;
  token: string;
}): Body {
  const { recipientName, token } = args;
  const link = resetLink(token);
  const subject = "Reset your CortexBuild Field password";
  const text =
    `Hi ${recipientName ?? "there"},\n\n` +
    `Someone — hopefully you — asked to reset the password for your CortexBuild Field account.\n\n` +
    `Open this link within the next 30 minutes to choose a new one:\n${link}\n\n` +
    `If you didn't request this, you can safely ignore the email — your password won't change.\n\n` +
    `— CortexBuild Field`;
  const htmlBody =
    `Hi ${escapeHtml(recipientName) || "there"},\n\n` +
    `Someone — hopefully you — asked to reset the password for your CortexBuild Field account.\n\n` +
    `The button below is valid for 30 minutes.\n\n` +
    `If you didn't request this, you can safely ignore the email — your password won't change.\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(htmlBody, link) };
}
