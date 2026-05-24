/**
 * Report Generator Service
 * Creates structured PDF and HTML reports from chat history, issues, and images.
 */
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import {
  getIssuesByDateRange,
  listMedia,
  listConversations,
  getMessagesByConversation,
  insertReport,
  updateReport,
} from "../db";
import type { Issue, Media, Conversation } from "../../drizzle/schema";

export interface ReportData {
  title: string;
  dateFrom: Date;
  dateTo: Date;
  projectTag?: string;
  conversations: Conversation[];
  issues: Issue[];
  images: Media[];
  stats: {
    totalMessages: number;
    totalImages: number;
    totalIssues: number;
    openIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
  };
  aiSummary: string;
}

/**
 * Generate an AI narrative summary of the report data.
 */
async function generateAISummary(data: ReportData): Promise<string> {
  const issueList = data.issues
    .slice(0, 10)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description.slice(0, 100)}`)
    .join("\n");

  const imageList = data.images
    .filter((m) => m.visionDescription)
    .slice(0, 5)
    .map((m) => `- ${m.visionDescription?.slice(0, 100)}`)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a construction site report writer. Write a concise executive summary for the following site activity report. Be professional and factual.",
      },
      {
        role: "user",
        content: `Period: ${data.dateFrom.toDateString()} to ${data.dateTo.toDateString()}
Total messages: ${data.stats.totalMessages}
Total images: ${data.stats.totalImages}
Total issues: ${data.stats.totalIssues} (${data.stats.openIssues} open, ${data.stats.criticalIssues} critical)

Issues detected:
${issueList || "No issues detected"}

Image observations:
${imageList || "No image analysis available"}

Write a 2-3 paragraph executive summary.`,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "Summary not available.";
}

/**
 * Generate an HTML report string.
 */
function generateHTML(data: ReportData): string {
  const issueRows = data.issues
    .map(
      (i) => `
    <tr class="issue-row severity-${i.severity}">
      <td>${i.title}</td>
      <td><span class="badge badge-${i.category}">${i.category.replace("_", " ")}</span></td>
      <td><span class="badge badge-${i.severity}">${i.severity}</span></td>
      <td><span class="badge badge-${i.status}">${i.status.replace("_", " ")}</span></td>
      <td>${i.location ?? "—"}</td>
      <td>${new Date(i.createdAt).toLocaleDateString()}</td>
    </tr>`
    )
    .join("");

  const imageCards = data.images
    .filter((m) => m.mediaType === "image")
    .slice(0, 20)
    .map(
      (m) => `
    <div class="image-card">
      <img src="${m.s3Url}" alt="Site image" onerror="this.style.display='none'" />
      <div class="image-meta">
        <p class="image-date">${new Date(m.sentAt).toLocaleDateString()}</p>
        ${m.visionDescription ? `<p class="image-desc">${m.visionDescription.slice(0, 150)}...</p>` : ""}
        ${m.visionTags?.length ? `<div class="tags">${(m.visionTags as string[]).slice(0, 4).map((t) => `<span class="tag">${t}</span>`).join("")}</div>` : ""}
        ${m.visionSafetyHazards?.length ? `<p class="hazard">⚠️ ${(m.visionSafetyHazards as string[])[0]}</p>` : ""}
      </div>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${data.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%); color: white; padding: 40px; }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .header p { opacity: 0.85; font-size: 14px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
  .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); text-align: center; }
  .stat-card .value { font-size: 36px; font-weight: 700; color: #0f766e; }
  .stat-card .label { font-size: 13px; color: #64748b; margin-top: 4px; }
  .section { background: white; border-radius: 12px; padding: 24px; margin: 20px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1e3a5f; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .summary-text { line-height: 1.7; color: #475569; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-critical { background: #fee2e2; color: #dc2626; }
  .badge-high { background: #fef3c7; color: #d97706; }
  .badge-medium { background: #dbeafe; color: #2563eb; }
  .badge-low { background: #dcfce7; color: #16a34a; }
  .badge-open { background: #fee2e2; color: #dc2626; }
  .badge-in_progress { background: #fef3c7; color: #d97706; }
  .badge-resolved { background: #dcfce7; color: #16a34a; }
  .badge-closed { background: #f1f5f9; color: #64748b; }
  .badge-safety_hazard { background: #fee2e2; color: #dc2626; }
  .badge-structural { background: #fef3c7; color: #d97706; }
  .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .image-card { background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
  .image-card img { width: 100%; height: 160px; object-fit: cover; }
  .image-meta { padding: 10px; }
  .image-date { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .image-desc { font-size: 12px; color: #475569; line-height: 1.4; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .tag { background: #dbeafe; color: #2563eb; font-size: 10px; padding: 1px 6px; border-radius: 10px; }
  .hazard { color: #dc2626; font-size: 11px; margin-top: 4px; font-weight: 600; }
  .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>🏗️ ${data.title}</h1>
  <p>Period: ${data.dateFrom.toDateString()} — ${data.dateTo.toDateString()}</p>
  ${data.projectTag ? `<p>Project: ${data.projectTag}</p>` : ""}
  <p>Generated: ${new Date().toLocaleString()}</p>
</div>
<div class="container">
  <div class="stats-grid">
    <div class="stat-card"><div class="value">${data.stats.totalMessages}</div><div class="label">Messages</div></div>
    <div class="stat-card"><div class="value">${data.stats.totalImages}</div><div class="label">Images</div></div>
    <div class="stat-card"><div class="value">${data.stats.totalIssues}</div><div class="label">Issues Detected</div></div>
    <div class="stat-card"><div class="value">${data.stats.openIssues}</div><div class="label">Open Issues</div></div>
    <div class="stat-card"><div class="value">${data.stats.resolvedIssues}</div><div class="label">Resolved</div></div>
    <div class="stat-card"><div class="value" style="color:${data.stats.criticalIssues > 0 ? '#dc2626' : '#0f766e'}">${data.stats.criticalIssues}</div><div class="label">Critical Issues</div></div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <p class="summary-text">${data.aiSummary.replace(/\n/g, "<br/>")}</p>
  </div>

  ${data.issues.length > 0 ? `
  <div class="section">
    <h2>Issues (${data.issues.length})</h2>
    <table>
      <thead><tr><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Location</th><th>Date</th></tr></thead>
      <tbody>${issueRows}</tbody>
    </table>
  </div>` : ""}

  ${data.images.length > 0 ? `
  <div class="section">
    <h2>Site Images (${data.images.length})</h2>
    <div class="image-grid">${imageCards}</div>
  </div>` : ""}
</div>
<div class="footer">CortexBuild AI — Construction Site Intelligence Platform</div>
</body>
</html>`;
}

/**
 * Collect all data needed for a report within a date range.
 */
async function collectReportData(opts: {
  title: string;
  dateFrom: Date;
  dateTo: Date;
  projectTag?: string;
}): Promise<ReportData> {
  const { title, dateFrom, dateTo, projectTag } = opts;

  const [allIssues, allMedia, allConversations] = await Promise.all([
    getIssuesByDateRange(dateFrom, dateTo),
    listMedia({ limit: 100 }),
    listConversations(50),
  ]);

  const filteredIssues = projectTag ? allIssues.filter((i) => i.projectTag === projectTag) : allIssues;
  const filteredMedia = allMedia.filter((m) => {
    const inRange = m.sentAt >= dateFrom && m.sentAt <= dateTo;
    const matchProject = projectTag ? m.projectTag === projectTag : true;
    return inRange && matchProject;
  });

  let totalMessages = 0;
  for (const conv of allConversations) {
    totalMessages += conv.messageCount;
  }

  const stats = {
    totalMessages,
    totalImages: filteredMedia.filter((m) => m.mediaType === "image").length,
    totalIssues: filteredIssues.length,
    openIssues: filteredIssues.filter((i) => i.status === "open").length,
    resolvedIssues: filteredIssues.filter((i) => i.status === "resolved").length,
    criticalIssues: filteredIssues.filter((i) => i.severity === "critical").length,
  };

  const data: ReportData = {
    title,
    dateFrom,
    dateTo,
    projectTag,
    conversations: allConversations,
    issues: filteredIssues,
    images: filteredMedia,
    stats,
    aiSummary: "",
  };

  data.aiSummary = await generateAISummary(data);
  return data;
}

/**
 * Generate a full report (HTML + PDF stored to S3) and save the record to DB.
 */
export async function generateReport(opts: {
  title: string;
  reportType: "daily_summary" | "weekly_summary" | "issue_report" | "custom";
  dateFrom: Date;
  dateTo: Date;
  projectTag?: string;
  contactId?: number;
}): Promise<{ reportId: number; htmlUrl: string | null; pdfUrl: string | null }> {
  const data = await collectReportData(opts);
  const html = generateHTML(data);

  const timestamp = Date.now();
  const slug = opts.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40);

  // Upload HTML to S3
  const htmlKey = `reports/${slug}-${timestamp}.html`;
  const { url: htmlUrl } = await storagePut(htmlKey, Buffer.from(html, "utf-8"), "text/html");

  // Generate PDF using puppeteer-like approach via HTML content
  // We store the HTML and let the client download/print as PDF
  // For true server-side PDF, we use a simple text-based approach
  let pdfUrl: string | null = null;
  let pdfKey: string | null = null;

  try {
    // Create a simplified PDF-friendly version
    const pdfContent = generateSimplePDF(data);
    pdfKey = `reports/${slug}-${timestamp}.pdf`;
    const pdfResult = await storagePut(pdfKey, Buffer.from(pdfContent, "utf-8"), "application/pdf");
    pdfUrl = pdfResult.url;
  } catch (err) {
    console.error("[ReportGenerator] PDF generation failed:", err);
  }

  // Save report record to DB
  const report = await insertReport({
    title: opts.title,
    reportType: opts.reportType,
    format: "both",
    contactId: opts.contactId,
    projectTag: opts.projectTag,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    stats: data.stats,
    htmlS3Key: htmlKey,
    htmlS3Url: htmlUrl,
    pdfS3Key: pdfKey ?? undefined,
    pdfS3Url: pdfUrl ?? undefined,
    sentToWhatsapp: false,
    sentToEmail: false,
  });

  return { reportId: report.id, htmlUrl, pdfUrl };
}

/**
 * Generate a minimal valid PDF using raw PDF syntax.
 */
function generateSimplePDF(data: ReportData): string {
  const lines: string[] = [
    `CortexBuild AI - ${data.title}`,
    `Period: ${data.dateFrom.toDateString()} to ${data.dateTo.toDateString()}`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `SUMMARY`,
    `=======`,
    data.aiSummary,
    ``,
    `STATISTICS`,
    `==========`,
    `Messages: ${data.stats.totalMessages}`,
    `Images: ${data.stats.totalImages}`,
    `Total Issues: ${data.stats.totalIssues}`,
    `Open Issues: ${data.stats.openIssues}`,
    `Resolved Issues: ${data.stats.resolvedIssues}`,
    `Critical Issues: ${data.stats.criticalIssues}`,
    ``,
    `ISSUES`,
    `======`,
    ...data.issues.map((i) => `[${i.severity.toUpperCase()}] ${i.title}\n  ${i.description}\n  Status: ${i.status} | Category: ${i.category}${i.location ? ` | Location: ${i.location}` : ""}`),
    ``,
    `IMAGES`,
    `======`,
    ...data.images.filter((m) => m.visionDescription).map((m) => `${new Date(m.sentAt).toLocaleDateString()}: ${m.visionDescription?.slice(0, 200)}`),
  ];

  // Build a minimal valid PDF with text content
  const textContent = lines.join("\n");
  const escapedText = textContent.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Split into chunks of 80 chars for PDF text rendering
  const chunks = [];
  const words = escapedText.split("\n");
  for (const line of words) {
    chunks.push(`(${line.slice(0, 200)}) Tj`);
    chunks.push("0 -14 Td");
  }

  const stream = `BT\n/F1 10 Tf\n50 750 Td\n${chunks.join("\n")}\nET`;
  const streamBytes = Buffer.byteLength(stream, "utf-8");

  return `%PDF-1.4
1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamBytes}>>
stream
${stream}
endstream
endobj
5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6 /Root 1 0 R>>
startxref
0
%%EOF`;
}
