/**
 * Scheduled Reports Service
 * Runs daily/weekly report generation and delivery.
 * Called by a cron-like interval in the server.
 */
import { generateReport } from "./reportGenerator";
import { sendDocumentMessage, sendTextMessage } from "./whatsappClient";
import { sendReportNotification } from "./emailService";
import {
  listScheduledReports,
  updateScheduledReport,
  updateReport,
} from "../db";

/**
 * Run all due scheduled reports.
 * Should be called every hour by a setInterval in the server.
 */
export async function runDueScheduledReports(): Promise<void> {
  const schedules = await listScheduledReports();
  const now = new Date();

  for (const schedule of schedules) {
    if (!schedule.isActive) continue;
    if (schedule.nextRunAt && schedule.nextRunAt > now) continue;

    try {
      console.log(`[ScheduledReports] Running: ${schedule.name}`);

      const dateTo = new Date();
      const dateFrom = new Date();
      if (schedule.frequency === "daily") {
        dateFrom.setDate(dateFrom.getDate() - 1);
      } else {
        dateFrom.setDate(dateFrom.getDate() - 7);
      }

      const title = `${schedule.name} — ${dateTo.toLocaleDateString()}`;
      const { reportId, htmlUrl, pdfUrl } = await generateReport({
        title,
        reportType: schedule.reportType,
        dateFrom,
        dateTo,
        projectTag: schedule.projectTag ?? undefined,
      });

      // Send to WhatsApp if configured
      if (schedule.sendToWhatsapp && schedule.whatsappRecipient) {
        const summaryText = `📋 *${title}*\nYour ${schedule.frequency} construction site report is ready.\n${htmlUrl ? `View: ${htmlUrl}` : ""}`;
        await sendTextMessage(schedule.whatsappRecipient, summaryText);

        if (pdfUrl) {
          await sendDocumentMessage(
            schedule.whatsappRecipient,
            pdfUrl,
            `${title.replace(/\s+/g, "_")}.pdf`,
            title
          );
        }

        await updateReport(reportId, { sentToWhatsapp: true, sentAt: new Date() });
      }

      // Send email notification if configured
      if (schedule.sendToEmail) {
        await sendReportNotification({
          reportTitle: title,
          stats: { totalMessages: 0, totalImages: 0, totalIssues: 0, openIssues: 0, criticalIssues: 0 },
          htmlUrl,
          pdfUrl,
          period: `${dateFrom.toDateString()} — ${dateTo.toDateString()}`,
        });
        await updateReport(reportId, { sentToEmail: true });
      }

      // Update next run time
      const nextRun = new Date();
      if (schedule.frequency === "daily") {
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(8, 0, 0, 0); // 8 AM next day
      } else {
        nextRun.setDate(nextRun.getDate() + 7);
        nextRun.setHours(8, 0, 0, 0); // 8 AM next week
      }

      await updateScheduledReport(schedule.id, {
        lastRunAt: now,
        nextRunAt: nextRun,
      });

      console.log(`[ScheduledReports] Completed: ${schedule.name}`);
    } catch (err) {
      console.error(`[ScheduledReports] Failed for ${schedule.name}:`, err);
    }
  }
}
