import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  listContacts,
  getContactByWaId,
  getContactById,
  updateContact,
  upsertContact,
  listConversations,
  getConversation,
  getMessagesByConversation,
  updateConversation,
  listMedia,
  getMemorySections,
  listAllMemorySections,
  listIssues,
  updateIssue,
  getIssueById,
  deleteIssue,
  listReports,
  listScheduledReports,
  upsertScheduledReport,
  updateScheduledReport,
  getAllAgentConfig,
  setAgentConfig,
  listUsers,
  updateUserRole,
  deleteUser,
  listProjects,
  getProjectById,
  insertProject,
  updateProject,
  deleteProject,
  listNotifications,
  insertNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "./db";
import { generateReport } from "./services/reportGenerator";
import { sendTextMessage } from "./services/whatsappClient";
import { sendReportNotification } from "./services/emailService";
import { processInboxMessage } from "./services/inboxProcessor";

// ─── Admin guard ──────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Contacts ──────────────────────────────────────────────────────────────

  contacts: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listContacts(input.limit, input.offset)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await getContactById(input.id);
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Contact not found",
          });
        }
        return row;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          displayName: z.string().optional(),
          projectTag: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateContact(id, data);
      }),
  }),

  // ─── Conversations ─────────────────────────────────────────────────────────

  conversations: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listConversations(input.limit, input.offset)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getConversation(input.id)),

    messages: protectedProcedure
      .input(
        z.object({ conversationId: z.number(), limit: z.number().optional() })
      )
      .query(({ input }) =>
        getMessagesByConversation(input.conversationId, input.limit)
      ),

    updateTitle: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string(),
          projectTag: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateConversation(input.id, {
          title: input.title,
          projectTag: input.projectTag,
        })
      ),
  }),

  // ─── Media / Images ────────────────────────────────────────────────────────

  media: router({
    list: protectedProcedure
      .input(
        z.object({
          conversationId: z.number().optional(),
          contactId: z.number().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listMedia(input)),

    gallery: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) =>
        listMedia({ limit: input.limit ?? 50, offset: input.offset ?? 0 })
      ),
  }),

  // ─── Memory ────────────────────────────────────────────────────────────────

  memory: router({
    byContact: protectedProcedure
      .input(z.object({ contactId: z.number(), limit: z.number().optional() }))
      .query(({ input }) => getMemorySections(input.contactId, input.limit)),

    all: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listAllMemorySections(input.limit, input.offset)),
  }),

  // ─── Issues ────────────────────────────────────────────────────────────────

  issues: router({
    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          severity: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listIssues(input)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await getIssueById(input.id);
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Issue not found",
          });
        }
        return row;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z
            .enum(["open", "in_progress", "resolved", "closed"])
            .optional(),
          assignedTo: z.string().optional(),
          location: z.string().optional(),
          severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.status === "resolved") updateData.resolvedAt = new Date();
        return updateIssue(id, updateData as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIssue(input.id);
        return { success: true } as const;
      }),
  }),

  // ─── Reports ───────────────────────────────────────────────────────────────

  reports: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listReports(input.limit, input.offset)),

    generate: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          reportType: z.enum([
            "daily_summary",
            "weekly_summary",
            "issue_report",
            "custom",
          ]),
          dateFrom: z.string(),
          dateTo: z.string(),
          projectTag: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return generateReport({
          title: input.title,
          reportType: input.reportType,
          dateFrom: new Date(input.dateFrom),
          dateTo: new Date(input.dateTo),
          projectTag: input.projectTag,
        });
      }),

    sendToWhatsapp: protectedProcedure
      .input(
        z.object({
          reportId: z.number(),
          phoneNumber: z.string(),
          htmlUrl: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const text = `📋 *Construction Site Report*\nYour report is ready.\n${input.htmlUrl}`;
        await sendTextMessage(input.phoneNumber, text);
        return { success: true };
      }),

    sendNotification: protectedProcedure
      .input(
        z.object({
          reportTitle: z.string(),
          htmlUrl: z.string().optional(),
          pdfUrl: z.string().optional(),
          period: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await sendReportNotification({
          reportTitle: input.reportTitle,
          stats: {
            totalMessages: 0,
            totalImages: 0,
            totalIssues: 0,
            openIssues: 0,
            criticalIssues: 0,
          },
          htmlUrl: input.htmlUrl,
          pdfUrl: input.pdfUrl,
          period: input.period,
        });
        return { success };
      }),
  }),

  // ─── Scheduled Reports ─────────────────────────────────────────────────────

  scheduledReports: router({
    list: protectedProcedure.query(() => listScheduledReports()),

    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          frequency: z.enum(["daily", "weekly"]),
          reportType: z.enum([
            "daily_summary",
            "weekly_summary",
            "issue_report",
          ]),
          format: z.enum(["pdf", "html", "both"]).optional(),
          projectTag: z.string().optional(),
          sendToWhatsapp: z.boolean().optional(),
          whatsappRecipient: z.string().optional(),
          sendToEmail: z.boolean().optional(),
          emailRecipient: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const nextRun = new Date();
        nextRun.setDate(
          nextRun.getDate() + (input.frequency === "daily" ? 1 : 7)
        );
        nextRun.setHours(8, 0, 0, 0);
        await upsertScheduledReport({
          ...input,
          format: input.format ?? "both",
          sendToWhatsapp: input.sendToWhatsapp ?? true,
          sendToEmail: input.sendToEmail ?? false,
          isActive: true,
          nextRunAt: nextRun,
        });
        return { success: true };
      }),

    toggle: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(({ input }) =>
        updateScheduledReport(input.id, { isActive: input.isActive })
      ),
  }),

  // ─── Users (Admin Only) ────────────────────────────────────────────────────

  users: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listUsers(input.limit, input.offset)),

    updateRole: adminProcedure
      .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.id === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot change your own role",
          });
        }
        await updateUserRole(input.id, input.role);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.id === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete your own account",
          });
        }
        await deleteUser(input.id);
        return { success: true };
      }),
  }),

  // ─── Settings / Config ─────────────────────────────────────────────────────

  settings: router({
    getAll: adminProcedure.query(() => getAllAgentConfig()),

    set: adminProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        setAgentConfig(input.key, input.value, input.description)
      ),
  }),

  // ─── Inbox (In-App Chat) ────────────────────────────────────────────────────
  // Allows sending messages and images directly from the dashboard.
  // Runs the full AI pipeline: memory, vision AI, issue detection, AI reply.
  // No WhatsApp API credentials required.

  inbox: router({
    sendMessage: protectedProcedure
      .input(
        z.object({
          contactIdentifier: z.string().min(1),
          contactName: z.string().min(1),
          text: z.string().optional(),
          imageUrl: z.string().url().optional(),
          imageS3Key: z.string().optional(),
          imageMimeType: z.string().optional(),
          projectTag: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (!input.text && !input.imageUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Provide text or image",
          });
        }
        return processInboxMessage(input);
      }),

    createContact: protectedProcedure
      .input(
        z.object({
          displayName: z.string().min(1),
          phoneNumber: z.string().min(1),
          projectTag: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const contact = await upsertContact({
          waId: input.phoneNumber,
          phoneNumber: input.phoneNumber,
          displayName: input.displayName,
          profileName: input.displayName,
        });
        if (input.projectTag) {
          await updateContact(contact.id, { projectTag: input.projectTag });
        }
        return contact;
      }),
  }),

  // ─── Projects ──────────────────────────────────────────────────────────────

  projects: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input }) => listProjects(input.limit, input.offset)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProjectById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          client: z.string().optional(),
          budget: z.number().optional(),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          status: z
            .enum(["active", "planning", "on-hold", "completed"])
            .optional(),
          location: z.string().optional(),
          manager: z.string().optional(),
          progress: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { startDate, endDate, ...rest } = input;
        return insertProject({
          ...rest,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          createdById: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          client: z.string().optional(),
          budget: z.number().optional(),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          status: z
            .enum(["active", "planning", "on-hold", "completed"])
            .optional(),
          location: z.string().optional(),
          manager: z.string().optional(),
          progress: z.number().optional(),
          spent: z.number().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, startDate, endDate, ...data } = input;
        return updateProject(id, {
          ...data,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProject(input.id)),
  }),

  // ─── Notifications ─────────────────────────────────────────────────────────

  notifications: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(({ input, ctx }) =>
        listNotifications(ctx.user.id, input.limit, input.offset)
      ),

    create: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
          title: z.string().min(1),
          content: z.string().min(1),
          type: z.enum(["info", "warning", "success", "error"]).optional(),
          link: z.string().optional(),
        })
      )
      .mutation(({ input }) => insertNotification(input)),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => markNotificationRead(input.id)),

    markAllRead: protectedProcedure.mutation(({ ctx }) =>
      markAllNotificationsRead(ctx.user.id)
    ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteNotification(input.id)),
  }),

  // ─── Dashboard Stats ───────────────────────────────────────────────────────

  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const [conversations, issues, media, reports] = await Promise.all([
        listConversations(1000),
        listIssues({ limit: 1000 }),
        listMedia({ limit: 1000 }),
        listReports(1000),
      ]);

      return {
        totalConversations: conversations.length,
        totalIssues: issues.length,
        openIssues: issues.filter(i => i.status === "open").length,
        criticalIssues: issues.filter(i => i.severity === "critical").length,
        totalImages: media.filter(m => m.mediaType === "image").length,
        analyzedImages: media.filter(m => m.visionAnalyzed).length,
        totalReports: reports.length,
        recentIssues: issues.slice(0, 5),
        recentMedia: media.filter(m => m.mediaType === "image").slice(0, 6),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
