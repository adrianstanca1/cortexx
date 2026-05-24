/**
 * Phase 3.4 — RFI lifecycle email templates.
 *
 * Pure functions returning EmailParams-without-`to`. The router fills
 * `to` per recipient. Matches the pattern in `pin-email.ts`.
 */

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://field.cortexbuildpro.com";

type RfiCore = {
  id: number;
  number: string | null;
  subject: string;
};
type RfiWithReason = RfiCore & { rejectedReason: string };
type Named = { name: string | null };
type Project = { name: string };

type Body = { subject: string; text: string; html: string };

function deepLink(rfiId: number) {
  return `${APP_BASE_URL}/rfis?id=${rfiId}`;
}

/**
 * Escapes user-controlled strings for safe inclusion in HTML.
 * `&` must be replaced first to avoid double-escaping subsequent entities.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps a pre-escaped HTML body string in a styled email shell.
 * Caller is responsible for escaping all user-controlled segments before
 * passing them in — `htmlBody` is treated as already-safe HTML.
 * Newlines within paragraphs are converted to <br/> after splitting on \n\n.
 */
function htmlWrap(htmlBody: string, ctaUrl: string): string {
  // Simple deterministic HTML — same shape as pin-email.ts. No engine.
  const paragraphs = htmlBody
    .split("\n\n")
    .map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;">${paragraphs}<p style="margin:24px 0 0 0;"><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;">Open in CortexBuild Field</a></p></div>`;
}

export function rfiSubmittedEmail(args: {
  rfi: RfiCore; raiser: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, raiser, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] New RFI on ${project.name}: ${rfi.subject}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${raiser.name ?? "A team member"} has raised RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  const htmlBody =
    `Hi ${escapeHtml(recipient.name) || "there"},\n\n` +
    `${escapeHtml(raiser.name) || "A team member"} has raised RFI ${escapeHtml(rfi.number)} on ${escapeHtml(project.name)}.\n\n` +
    `Subject: ${escapeHtml(rfi.subject)}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(htmlBody, deepLink(rfi.id)) };
}

export function rfiAnsweredEmail(args: {
  rfi: RfiCore; answerer: Named; raiser: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, answerer, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Answered: ${rfi.subject}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${answerer.name ?? "A team member"} has answered RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  const htmlBody =
    `Hi ${escapeHtml(recipient.name) || "there"},\n\n` +
    `${escapeHtml(answerer.name) || "A team member"} has answered RFI ${escapeHtml(rfi.number)} on ${escapeHtml(project.name)}.\n\n` +
    `Subject: ${escapeHtml(rfi.subject)}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(htmlBody, deepLink(rfi.id)) };
}

export function rfiApprovedEmail(args: {
  rfi: RfiCore; approver: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, approver, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Approved on ${project.name}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${approver.name ?? "A reviewer"} has approved RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  const htmlBody =
    `Hi ${escapeHtml(recipient.name) || "there"},\n\n` +
    `${escapeHtml(approver.name) || "A reviewer"} has approved RFI ${escapeHtml(rfi.number)} on ${escapeHtml(project.name)}.\n\n` +
    `Subject: ${escapeHtml(rfi.subject)}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(htmlBody, deepLink(rfi.id)) };
}

export function rfiRejectedEmail(args: {
  rfi: RfiWithReason; rejecter: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, rejecter, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Rejected: needs revision`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${rejecter.name ?? "A reviewer"} has rejected RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n` +
    `Reason: ${rfi.rejectedReason}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  const htmlBody =
    `Hi ${escapeHtml(recipient.name) || "there"},\n\n` +
    `${escapeHtml(rejecter.name) || "A reviewer"} has rejected RFI ${escapeHtml(rfi.number)} on ${escapeHtml(project.name)}.\n\n` +
    `Subject: ${escapeHtml(rfi.subject)}\n` +
    `Reason: ${escapeHtml(rfi.rejectedReason)}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(htmlBody, deepLink(rfi.id)) };
}
