/**
 * Email Service
 * Sends report summaries and notifications to the company owner via email.
 * Uses the built-in Forge notification API as the primary channel.
 */
import { notifyOwner } from "../_core/notification";

/**
 * Send a report summary notification to the owner via the built-in notification system.
 */
export async function sendReportNotification(opts: {
  reportTitle: string;
  stats: {
    totalMessages: number;
    totalImages: number;
    totalIssues: number;
    openIssues: number;
    criticalIssues: number;
  };
  htmlUrl?: string | null;
  pdfUrl?: string | null;
  period: string;
}): Promise<boolean> {
  const { reportTitle, stats, htmlUrl, pdfUrl, period } = opts;

  const content = `
**${reportTitle}**
Period: ${period}

📊 **Statistics**
- Messages: ${stats.totalMessages}
- Images: ${stats.totalImages}
- Total Issues: ${stats.totalIssues}
- Open Issues: ${stats.openIssues}
- Critical Issues: ${stats.criticalIssues}

${htmlUrl ? `📄 [View HTML Report](${htmlUrl})` : ""}
${pdfUrl ? `📥 [Download PDF Report](${pdfUrl})` : ""}
  `.trim();

  return notifyOwner({ title: `📋 ${reportTitle}`, content });
}

/**
 * Send a critical issue alert notification to the owner.
 */
export async function sendCriticalIssueAlert(opts: {
  issueTitle: string;
  description: string;
  severity: string;
  location?: string;
  contactName?: string;
}): Promise<boolean> {
  const { issueTitle, description, severity, location, contactName } = opts;

  const content = `
⚠️ **Critical Issue Detected**

**Issue:** ${issueTitle}
**Severity:** ${severity.toUpperCase()}
${location ? `**Location:** ${location}` : ""}
${contactName ? `**Reported by:** ${contactName}` : ""}

**Description:**
${description}

Please review this issue immediately in the CortexBuild dashboard.
  `.trim();

  return notifyOwner({ title: `🚨 Critical Issue: ${issueTitle}`, content });
}
