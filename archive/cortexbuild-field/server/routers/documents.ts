/**
 * Documents router — generators (RAMS, toolbox talk, invoice, timesheet,
 * signed timesheet, daily report) plus list / save persistence.
 *
 * Extracted from `server/routers/index.ts` to keep the monolith file
 * smaller without changing any procedure shape. Re-imported and mounted
 * unchanged into `appRouter` as `documents: documentsRouter`.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { assertLlmQuotaAllowed, consumeLlmQuota } from "../_core/llm-quota";
import { companyScopedProcedure, router } from "../_core/trpc";
import { dbUnavailable } from "../_core/errors";
import { getDb } from "../db";
import {
  cisRateForStatus,
  computeCisDeduction,
  labourSubtotal,
} from "../../shared/cis";
import {
  documents as dbDocuments,
  projects as dbProjects,
} from "../../drizzle/schema";

export const documentsRouter = router({
  /**
   * Generate a RAMS (Risk Assessment & Method Statement) document
   */
  generateRAMS: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectName: z.string(),
        projectAddress: z.string(),
        companyName: z.string(),
        activity: z.string(),
        scope: z.string(),
        personnel: z.array(z.string()).optional(),
        equipment: z.array(z.string()).optional(),
        startDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertLlmQuotaAllowed(ctx.user.id);
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a UK construction safety expert specialising in RAMS (Risk Assessment and Method Statement) preparation. Create comprehensive, professional RAMS documents that comply with CDM 2015, HSE guidance, and industry best practice. Always include specific control measures, responsible persons, and emergency procedures.`,
          },
          {
            role: "user",
            content: `Generate a comprehensive RAMS document for the following:

**Project:** ${input.projectName}
**Address:** ${input.projectAddress}
**Company:** ${input.companyName}
**Activity:** ${input.activity}
**Scope of Work:** ${input.scope}
${input.personnel?.length ? `**Personnel:** ${input.personnel.join(", ")}` : ""}
${input.equipment?.length ? `**Equipment/Plant:** ${input.equipment.join(", ")}` : ""}
${input.startDate ? `**Start Date:** ${input.startDate}` : ""}

Please generate a full RAMS document including:
1. Document header and project details
2. Scope of works description
3. Sequence of operations (step-by-step method statement)
4. Risk assessment table (hazard, who is at risk, likelihood, severity, risk rating, control measures, residual risk)
5. PPE requirements
6. Emergency procedures and first aid
7. Environmental considerations
8. Competency and training requirements
9. Supervision arrangements
10. Review and sign-off section

Format as a professional document with clear sections and headings. Use markdown formatting.`,
          },
        ],
      });
      consumeLlmQuota(ctx.user.id);

      const content = response.choices?.[0]?.message?.content ?? "";
      return {
        type: "RAMS",
        title: `RAMS - ${input.activity} - ${input.projectName}`,
        content,
        projectName: input.projectName,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate a Toolbox Talk document
   */
  generateToolboxTalk: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        topic: z.string(),
        projectName: z.string(),
        companyName: z.string(),
        presenter: z.string().optional(),
        duration: z.number().optional(),
        audience: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertLlmQuotaAllowed(ctx.user.id);
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a UK construction safety trainer specialising in toolbox talks. Create engaging, practical toolbox talks that are relevant to construction workers, easy to understand, and cover all key safety points. Include discussion questions and key takeaways.`,
          },
          {
            role: "user",
            content: `Generate a comprehensive toolbox talk on the topic: **${input.topic}**

**Project:** ${input.projectName}
**Company:** ${input.companyName}
${input.presenter ? `**Presenter:** ${input.presenter}` : ""}
${input.duration ? `**Duration:** ${input.duration} minutes` : "**Duration:** 10-15 minutes"}
${input.audience ? `**Audience:** ${input.audience}` : "**Audience:** All site operatives"}

Please include:
1. Title and header information
2. Introduction / why this topic matters
3. Key points (5-8 main safety points)
4. Common mistakes and how to avoid them
5. Legal requirements and regulations
6. Discussion questions (3-5 questions to engage the team)
7. Key takeaways / summary
8. Attendance record section (table with name, trade, signature, date)

Format as a professional toolbox talk document. Use clear, plain English suitable for all reading levels. Use markdown formatting.`,
          },
        ],
      });
      consumeLlmQuota(ctx.user.id);

      const content = response.choices?.[0]?.message?.content ?? "";
      return {
        type: "Toolbox Talk",
        title: `Toolbox Talk - ${input.topic}`,
        content,
        projectName: input.projectName,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate an Invoice document
   */
  generateInvoice: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        invoiceNumber: z.string(),
        companyName: z.string(),
        companyAddress: z.string(),
        clientName: z.string(),
        clientAddress: z.string(),
        projectName: z.string(),
        lineItems: z.array(
          z.object({
            description: z.string(),
            quantity: z.number(),
            unit: z.string(),
            unitRate: z.number(),
            // HMRC CIS applies to labour only, never to materials. Defaults to
            // `true` so callers that don't yet split labour/materials retain
            // the existing behaviour (CIS over the whole subtotal). New code
            // should pass `isLabour: false` for material-only line items.
            isLabour: z.boolean().optional(),
          }),
        ),
        cisDeduction: z.boolean().optional(),
        cisRate: z.number().optional(),
        vatRate: z.number().optional(),
        invoiceDate: z.string(),
        dueDate: z.string(),
        paymentTerms: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const subtotal = input.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitRate,
        0,
      );
      // HMRC CIS rules: deduction applies to LABOUR subtotal only — never VAT,
      // never materials. Helper preserves the undefined-as-labour back-compat
      // default for callers that don't yet thread isLabour through.
      const labour = labourSubtotal(input.lineItems);
      const vatAmount = input.vatRate ? subtotal * (input.vatRate / 100) : 0;
      const grossTotal = subtotal + vatAmount;
      const cisDeductionAmount = input.cisDeduction
        ? computeCisDeduction({
            labourSubtotal: labour,
            status: "registered_20", // back-compat: legacy API uses cisRate override
            overrideRate: input.cisRate ?? 20,
          })
        : 0;
      const netPayable = grossTotal - cisDeductionAmount;

      const lineItemsText = input.lineItems
        .map(
          (item) =>
            `| ${item.description} | ${item.quantity} ${item.unit} | £${item.unitRate.toFixed(2)} | £${(item.quantity * item.unitRate).toFixed(2)} |`,
        )
        .join("\n");

      const content = `# INVOICE

---

**${input.companyName}**
${input.companyAddress}

---

**Invoice Number:** ${input.invoiceNumber}
**Invoice Date:** ${input.invoiceDate}
**Due Date:** ${input.dueDate}
**Payment Terms:** ${input.paymentTerms ?? "30 days net"}

---

**Bill To:**
${input.clientName}
${input.clientAddress}

**Project:** ${input.projectName}

---

## Line Items

| Description | Quantity | Unit Rate | Amount |
|-------------|----------|-----------|--------|
${lineItemsText}

---

## Summary

| | |
|---|---|
| **Subtotal** | **£${subtotal.toFixed(2)}** |
${input.vatRate ? `| VAT @ ${input.vatRate}% | £${vatAmount.toFixed(2)} |` : ""}
| **Gross Total** | **£${grossTotal.toFixed(2)}** |
${input.cisDeduction ? `| CIS Deduction @ ${input.cisRate ?? 20}% | -£${cisDeductionAmount.toFixed(2)} |` : ""}
| **Net Amount Payable** | **£${netPayable.toFixed(2)}** |

${input.cisDeduction ? `\n> **CIS Note:** This invoice is subject to CIS deduction under the Construction Industry Scheme. The contractor should deduct ${input.cisRate ?? 20}% from the labour element before making payment.\n` : ""}

---

## Payment Details

Please make payment to:
- **Bank:** [Your Bank Name]
- **Sort Code:** [XX-XX-XX]
- **Account Number:** [XXXXXXXX]
- **Reference:** ${input.invoiceNumber}

${input.notes ? `## Notes\n\n${input.notes}` : ""}

---

*This invoice was generated by CortexBuild Field on ${new Date().toLocaleDateString("en-GB")}*`;

      return {
        type: "Invoice",
        title: `Invoice ${input.invoiceNumber} - ${input.projectName}`,
        content,
        projectName: input.projectName,
        invoiceNumber: input.invoiceNumber,
        totals: {
          subtotal,
          vatAmount,
          grossTotal,
          cisDeductionAmount,
          netPayable,
        },
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate a Timesheet document
   */
  generateTimesheet: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        workerName: z.string(),
        workerTrade: z.string(),
        companyName: z.string(),
        projectName: z.string(),
        weekEnding: z.string(),
        entries: z.array(
          z.object({
            date: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            breakMinutes: z.number(),
            projectCode: z.string().optional(),
            description: z.string().optional(),
          }),
        ),
        dayRate: z.number().optional(),
        hourlyRate: z.number().optional(),
        cisStatus: z
          .enum(["none", "registered_20", "registered_30", "gross_payment"])
          .default("none"),
      }),
    )
    .mutation(async ({ input }) => {
      const entries = input.entries.map((entry) => {
        const start = new Date(`2000-01-01T${entry.startTime}`);
        const end = new Date(`2000-01-01T${entry.endTime}`);
        const totalMins =
          (end.getTime() - start.getTime()) / 60000 - entry.breakMinutes;
        const hours = Math.max(0, totalMins / 60);
        return { ...entry, hours };
      });

      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
      const regularHours = Math.min(totalHours, 40);
      const overtimeHours = Math.max(0, totalHours - 40);
      const grossPay = input.hourlyRate
        ? regularHours * input.hourlyRate +
          overtimeHours * input.hourlyRate * 1.5
        : input.dayRate
          ? entries.filter((e) => e.hours > 0).length * input.dayRate
          : 0;

      const rowsText = entries
        .map(
          (e) =>
            `| ${e.date} | ${e.startTime} | ${e.endTime} | ${e.breakMinutes}min | **${e.hours.toFixed(1)}h** | ${e.description ?? ""} |`,
        )
        .join("\n");

      const content = `# TIMESHEET

---

**Worker:** ${input.workerName}
**Trade:** ${input.workerTrade}
**Company:** ${input.companyName}
**Project:** ${input.projectName}
**Week Ending:** ${input.weekEnding}

---

## Hours Record

| Date | Start | Finish | Break | Hours | Description |
|------|-------|--------|-------|-------|-------------|
${rowsText}

---

## Summary

| | |
|---|---|
| **Total Hours Worked** | **${totalHours.toFixed(1)}h** |
| Regular Hours (up to 40h) | ${regularHours.toFixed(1)}h |
| Overtime Hours | ${overtimeHours.toFixed(1)}h |
${grossPay > 0 ? `| **Gross Pay** | **£${grossPay.toFixed(2)}** |` : ""}
${(() => {
  const cisDeduction = computeCisDeduction({
    labourSubtotal: grossPay,
    status: input.cisStatus,
  });
  if (cisDeduction === 0) return "";
  const rate = cisRateForStatus(input.cisStatus);
  return `| CIS Deduction (${rate}%) | -£${cisDeduction.toFixed(2)} |
| **Net Pay** | **£${(grossPay - cisDeduction).toFixed(2)}** |`;
})()}

---

## Authorisation

| | |
|---|---|
| **Worker Signature:** | __________________ |
| **Date:** | __________________ |
| **Supervisor Signature:** | __________________ |
| **Date:** | __________________ |
| **Approved By:** | __________________ |
| **Date:** | __________________ |

---

*Generated by CortexBuild Field on ${new Date().toLocaleDateString("en-GB")}*`;

      return {
        type: "Timesheet",
        title: `Timesheet - ${input.workerName} - w/e ${input.weekEnding}`,
        content,
        projectName: input.projectName,
        totals: { totalHours, regularHours, overtimeHours, grossPay },
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate a signed-off timesheet with worker + manager signature blocks
   */
  generateTimesheetSignedOff: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        workerName: z.string(),
        workerTrade: z.string().optional(),
        companyName: z.string().optional(),
        projectName: z.string(),
        weekStarting: z.string(),
        totalHours: z.number(),
        overtimeHours: z.number(),
        mondayHours: z.number().optional(),
        tuesdayHours: z.number().optional(),
        wednesdayHours: z.number().optional(),
        thursdayHours: z.number().optional(),
        fridayHours: z.number().optional(),
        saturdayHours: z.number().optional(),
        sundayHours: z.number().optional(),
        hourlyRate: z.number().optional(),
        cisStatus: z
          .enum(["none", "registered_20", "registered_30", "gross_payment"])
          .default("none"),
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const weekEnd = new Date(input.weekStarting);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const weekStartStr = new Date(input.weekStarting).toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "short", year: "numeric" },
      );
      const regularHours = Math.min(input.totalHours, 40);
      const grossPay = input.hourlyRate
        ? regularHours * input.hourlyRate +
          input.overtimeHours * input.hourlyRate * 1.5
        : 0;
      const dayNames = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const dayHoursArr = [
        input.mondayHours ?? 0,
        input.tuesdayHours ?? 0,
        input.wednesdayHours ?? 0,
        input.thursdayHours ?? 0,
        input.fridayHours ?? 0,
        input.saturdayHours ?? 0,
        input.sundayHours ?? 0,
      ];
      const dayRows = dayNames
        .map((day, i) => {
          const h = dayHoursArr[i];
          const d = new Date(input.weekStarting);
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          });
          return `| ${dateStr} (${day}) | ${h > 0 ? h.toFixed(1) + "h" : "-"} | ${h > 8 ? (h - 8).toFixed(1) + "h OT" : "-"} |`;
        })
        .join("\n");
      const approvalStatus = input.approvedBy
        ? `| **Approved By:** | ${input.approvedBy} |\n| **Approval Date:** | ${input.approvedAt ? new Date(input.approvedAt).toLocaleDateString("en-GB") : weekEndStr} |\n| **Status:** | APPROVED |${input.notes ? `\n| **Notes:** | ${input.notes} |` : ""}`
        : `| **Status:** | PENDING APPROVAL |`;
      const content = [
        "# TIMESHEET — SIGNED OFF COPY",
        "---",
        `**Worker:** ${input.workerName}`,
        `**Trade:** ${input.workerTrade ?? "N/A"}`,
        `**Company:** ${input.companyName ?? "N/A"}`,
        `**Project:** ${input.projectName}`,
        `**Period:** ${weekStartStr} to ${weekEndStr}`,
        "---",
        "## Hours Record",
        "| Date | Hours | Overtime |",
        "|------|-------|----------|",
        dayRows,
        "---",
        "## Summary",
        "| | |",
        "|---|---|",
        `| **Total Hours Worked** | **${input.totalHours.toFixed(1)}h** |`,
        `| Regular Hours (up to 40h) | ${regularHours.toFixed(1)}h |`,
        `| Overtime Hours | ${input.overtimeHours.toFixed(1)}h |`,
        ...(grossPay > 0
          ? [`| **Gross Pay** | **£${grossPay.toFixed(2)}** |`]
          : []),
        ...(() => {
          const cisDeduction = computeCisDeduction({
            labourSubtotal: grossPay,
            status: input.cisStatus,
          });
          if (cisDeduction === 0 || grossPay <= 0) return [];
          const rate = cisRateForStatus(input.cisStatus);
          return [
            `| CIS Deduction (${rate}%) | -£${cisDeduction.toFixed(2)} |`,
            `| **Net Pay** | **£${(grossPay - cisDeduction).toFixed(2)}** |`,
          ];
        })(),
        "---",
        "## Approval Record",
        "| | |",
        "|---|---|",
        approvalStatus,
        "---",
        "## Worker Declaration",
        "*I confirm that the hours recorded above are accurate and complete.*",
        "",
        "| | |",
        "|---|---|",
        "| **Worker Signature:** | __________________ |",
        `| **Print Name:** | ${input.workerName} |`,
        "| **Date:** | __________________ |",
        "",
        "---",
        "## Manager / Supervisor Sign-Off",
        "",
        "| | |",
        "|---|---|",
        "| **Manager Signature:** | __________________ |",
        "| **Print Name:** | __________________ |",
        "| **Position:** | __________________ |",
        "| **Date:** | __________________ |",
        "| **Company Stamp:** | __________________ |",
        "",
        "---",
        `*Generated by CortexBuild Field on ${new Date().toLocaleDateString("en-GB")}. Retain for payroll records.*`,
      ].join("\n");
      return {
        type: "Timesheet",
        title: `Signed Timesheet — ${input.workerName} — w/e ${weekEndStr}`,
        content,
        projectName: input.projectName,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate a Daily Site Report
   */
  generateDailyReport: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectName: z.string(),
        projectAddress: z.string(),
        reportDate: z.string(),
        reportedBy: z.string(),
        weather: z.string(),
        temperature: z.number().optional(),
        workersOnSite: z.number(),
        workCompleted: z.string(),
        workPlanned: z.string(),
        issues: z.string().optional(),
        materialsDelivered: z.string().optional(),
        visitors: z.string().optional(),
        safetyObservations: z.string().optional(),
        photos: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const content = `# DAILY SITE REPORT

---

**Project:** ${input.projectName}
**Site Address:** ${input.projectAddress}
**Report Date:** ${input.reportDate}
**Reported By:** ${input.reportedBy}
**Report Reference:** DSR-${input.reportDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}

---

## Site Conditions

| | |
|---|---|
| **Weather** | ${input.weather} |
${input.temperature !== undefined ? `| **Temperature** | ${input.temperature}°C |` : ""}
| **Workers on Site** | ${input.workersOnSite} |

---

## Work Completed Today

${input.workCompleted}

---

## Work Planned for Tomorrow

${input.workPlanned}

${input.issues ? `## Issues / Delays / Incidents\n\n${input.issues}\n\n---\n` : ""}
${input.materialsDelivered ? `## Materials Delivered\n\n${input.materialsDelivered}\n\n---\n` : ""}
${input.visitors ? `## Site Visitors\n\n${input.visitors}\n\n---\n` : ""}
${input.safetyObservations ? `## Safety Observations\n\n${input.safetyObservations}\n\n---\n` : ""}

## Authorisation

| | |
|---|---|
| **Site Manager Signature:** | __________________ |
| **Date:** | ${input.reportDate} |
| **Time:** | __________________ |

---

*Generated by CortexBuild Field on ${new Date().toLocaleDateString("en-GB")}*`;

      return {
        type: "Daily Report",
        title: `Daily Report - ${input.projectName} - ${input.reportDate}`,
        content,
        projectName: input.projectName,
        generatedAt: new Date().toISOString(),
      };
    }),
  listGenerated: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dbDocuments.companyId, input.companyId)];
      if (input.projectId)
        conditions.push(eq(dbDocuments.projectId, input.projectId));
      return db
        .select()
        .from(dbDocuments)
        .where(and(...conditions))
        .orderBy(desc(dbDocuments.createdAt))
        .limit(input.limit);
    }),
  saveGenerated: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.number().optional(),
        type: z.enum([
          "rams",
          "toolbox_talk",
          "daily_report",
          "invoice",
          "timesheet",
          "other",
        ]),
        title: z.string(),
        content: z.string(),
        generatedBy: z.string().optional(),
        status: z.enum(["draft", "final", "sent"]).default("draft"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      // If a projectId is supplied, verify it belongs to the requested
      // company before inserting. Without this, a member of company A
      // could attach a generated document to company B's project.
      if (input.projectId !== undefined) {
        const [project] = await db
          .select()
          .from(dbProjects)
          .where(
            and(
              eq(dbProjects.id, input.projectId),
              eq(dbProjects.companyId, input.companyId),
            ),
          )
          .limit(1);
        if (!project)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Project not found for this company.",
          });
      }
      const rows = await db.insert(dbDocuments).values(input).returning();
      return rows[0];
    }),
});
