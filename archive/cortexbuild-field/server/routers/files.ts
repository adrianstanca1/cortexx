/**
 * Files router — presigned-upload flow, base64 fallback, list, delete.
 *
 * Presigned flow (recommended):
 *   1. Client calls `files.getUploadUrl` → receives `{ presignedUrl, key, publicUrl }`
 *   2. Client PUTs bytes directly to `presignedUrl` (MinIO / S3)
 *   3. Client calls `files.confirmUpload` with the same key + metadata
 *      → row written to `files` table
 *
 * Base64 fallback (legacy / local-fs only):
 *   - `files.upload` still works; it receives base64, decodes, writes via
 *     `storagePut`, and inserts the DB row in one shot.
 *
 * Download:
 *   - `files.getDownloadUrl` returns a short-lived presigned GET URL when S3
 *     is configured, or a local `/manus-storage/…` path otherwise.
 *
 * RBAC:
 *   - `companyScopedProcedure` gates by active company membership.
 *   - `projectId` is verified against `projects.companyId` before writes.
 *   - `list` / `delete` scope by `companyId`; `delete` also removes the
 *     object from storage.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { companyScopedProcedure, router } from "../_core/trpc";
import { dbUnavailable } from "../_core/errors";
import { getDb } from "../db";
import {
  storagePut,
  storageDelete,
  storageGetPresignedPutUrl,
  storageGetSignedUrl,
} from "../storage";
import { files as dbFiles, projects as dbProjects } from "../../drizzle/schema";
import { log } from "../_core/logger";

// ── Mime-type whitelist ──────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
] as const;

function validateMimeType(v: string): boolean {
  return ALLOWED_MIME_TYPES.includes(v as any);
}

// ── Size limits ──────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;          // 50 MB raw
const MAX_BASE64_CHARS = 14 * 1024 * 1024;        // ~10 MB decoded (legacy)

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStorageKey(category: string, fileName: string): string {
  return `${category}/${Date.now()}_${safeFileName(fileName)}`;
}

async function assertProjectBelongsToCompany(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number | undefined,
  companyId: number,
): Promise<void> {
  if (projectId === undefined || !Number.isFinite(projectId)) return;
  const [project] = await db
    .select()
    .from(dbProjects)
    .where(and(eq(dbProjects.id, projectId), eq(dbProjects.companyId, companyId)))
    .limit(1);
  if (!project) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Project not found for this company.",
    });
  }
}

// ── Router ───────────────────────────────────────────────────────────────────
export const filesRouter = router({
  /**
   * Step 1 of presigned upload: get a short-lived PUT URL.
   *
   * When S3 is configured this returns a presigned URL the client can PUT
   * to directly. When running local-fs only, `presignedUrl` is empty and
   * the caller should fall back to `files.upload` (base64).
   */
  getUploadUrl: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().refine(validateMimeType, {
          message: "mimeType not in allowed list",
        }),
        category: z.enum([
          "photo",
          "certificate",
          "payslip",
          "document",
          "report",
          "invoice",
        ]),
        projectId: z.coerce.number().optional(),
        sizeBytes: z.number().min(1).max(MAX_FILE_BYTES).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (db) {
        await assertProjectBelongsToCompany(
          db,
          input.projectId ? Number(input.projectId) : undefined,
          input.companyId,
        );
      }

      const effectiveCategory = input.category === "invoice" ? "document" : input.category;
      const key = buildStorageKey(input.category, input.fileName);

      const { presignedUrl, publicUrl } = await storageGetPresignedPutUrl(
        key,
        input.mimeType,
        {
          maxBytes: input.sizeBytes ?? MAX_FILE_BYTES,
          expiresInSeconds: 300,
        },
      );

      return {
        key,
        presignedUrl,
        publicUrl,
        mimeType: input.mimeType,
        category: effectiveCategory,
        maxBytes: input.sizeBytes ?? MAX_FILE_BYTES,
        expiresInSeconds: 300,
      };
    }),

  /**
   * Step 2 of presigned upload: confirm the direct upload and write metadata.
   *
   * Call this after the client has successfully PUT the object to the
   * presigned URL. If the object is missing from storage the call still
   * succeeds (we trust the client in the happy path; a future integrity
   * check could HEAD the object).
   */
  confirmUpload: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        key: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().refine(validateMimeType, {
          message: "mimeType not in allowed list",
        }),
        sizeBytes: z.number().min(1).max(MAX_FILE_BYTES),
        category: z.enum([
          "photo",
          "certificate",
          "payslip",
          "document",
          "report",
          "invoice",
        ]),
        projectId: z.coerce.number().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const projectId = input.projectId ? Number(input.projectId) : undefined;
      await assertProjectBelongsToCompany(db, projectId, input.companyId);

      const dbCategory = input.category === "invoice" ? "document" : input.category;
      const effectiveTags =
        input.category === "invoice"
          ? Array.from(new Set([...(input.tags ?? []), "invoice"]))
          : (input.tags ?? []);

      const rows = await db
        .insert(dbFiles)
        .values({
          companyId: input.companyId,
          projectId: Number.isFinite(projectId) ? projectId : null,
          uploadedBy: ctx.user?.id ?? null,
          name: input.fileName,
          category: dbCategory,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.key,
          storageUrl: `/storage/${input.key}`,
          tags: JSON.stringify(effectiveTags),
        })
        .returning();

      const fileId = rows[0]?.id ?? null;

      return {
        id: fileId,
        key: input.key,
        url: `/storage/${input.key}`,
        fileName: input.fileName,
        mimeType: input.mimeType,
        category: dbCategory,
        projectId: input.projectId,
        tags: effectiveTags,
        uploadedAt: new Date().toISOString(),
        size: input.sizeBytes,
      };
    }),

  /**
   * Legacy base64 upload — single-shot upload + metadata.
   * Still used by field-app photo capture when presigned flow isn't
   * available (local-fs dev, or legacy clients).
   */
  upload: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().refine(validateMimeType, {
          message: "mimeType not in allowed list",
        }),
        base64Data: z.string().min(1).max(MAX_BASE64_CHARS),
        category: z.enum([
          "photo",
          "certificate",
          "payslip",
          "document",
          "report",
          "invoice",
        ]),
        projectId: z.coerce.number().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const requestedCategory = input.category;
      const dbCategory =
        requestedCategory === "invoice" ? "document" : requestedCategory;
      const buffer = Buffer.from(input.base64Data, "base64");
      const key = buildStorageKey(requestedCategory, input.fileName);

      const projectId = input.projectId ? Number(input.projectId) : undefined;
      const db = await getDb();

      if (db && projectId !== undefined && Number.isFinite(projectId)) {
        await assertProjectBelongsToCompany(db, projectId, input.companyId);
      }

      const { url } = await storagePut(key, buffer, input.mimeType);
      let fileId: number | null = null;

      if (db) {
        const rows = await db
          .insert(dbFiles)
          .values({
            companyId: input.companyId,
            projectId: Number.isFinite(projectId) ? projectId : null,
            uploadedBy: ctx.user?.id ?? null,
            name: input.fileName,
            category: dbCategory,
            mimeType: input.mimeType,
            sizeBytes: buffer.length,
            storageKey: key,
            storageUrl: url,
            tags: JSON.stringify(
              requestedCategory === "invoice"
                ? Array.from(new Set([...(input.tags ?? []), "invoice"]))
                : (input.tags ?? []),
            ),
          })
          .returning();
        fileId = rows[0]?.id ?? null;
      }

      return {
        id: fileId,
        key,
        url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        category: dbCategory,
        projectId: input.projectId,
        tags:
          requestedCategory === "invoice"
            ? Array.from(new Set([...(input.tags ?? []), "invoice"]))
            : (input.tags ?? []),
        uploadedAt: new Date().toISOString(),
        size: buffer.length,
      };
    }),

  /**
   * Get a short-lived download URL for a file.
   *
   * Returns a presigned S3 GET URL when S3 is configured, otherwise the
   * local `/manus-storage/…` path (served by `registerStorageProxy`).
   *
   * The file row must exist and belong to the caller's company.
   */
  getDownloadUrl: companyScopedProcedure
    .input(z.object({ companyId: z.number(), id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const [row] = await db
        .select()
        .from(dbFiles)
        .where(
          and(
            eq(dbFiles.id, input.id),
            eq(dbFiles.companyId, input.companyId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found.",
        });
      }

      const url = await storageGetSignedUrl(row.storageKey);
      return {
        id: row.id,
        url,
        fileName: row.name,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        expiresInSeconds: 300,
      };
    }),

  list: companyScopedProcedure
    .input(
      z.object({
        companyId: z.number(),
        projectId: z.coerce.number().optional(),
        category: z
          .enum([
            "photo",
            "certificate",
            "payslip",
            "drawing",
            "report",
            "document",
            "other",
          ])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(dbFiles.companyId, input.companyId)];
      if (input.projectId !== undefined)
        conditions.push(eq(dbFiles.projectId, input.projectId));
      if (input.category) conditions.push(eq(dbFiles.category, input.category));
      return db
        .select()
        .from(dbFiles)
        .where(and(...conditions))
        .orderBy(desc(dbFiles.createdAt))
        .limit(input.limit);
    }),

  /**
   * Delete a file row AND its backing storage object.
   *
   * `companyId` in the WHERE prevents cross-tenant deletion by id
   * guessing. Storage deletion is best-effort — if the S3 delete fails
   * the DB row is still removed (orphan object is acceptable; a future
   * garbage-collector can sweep unreferenced keys).
   */
  delete: companyScopedProcedure
    .input(z.object({ companyId: z.number(), id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const [row] = await db
        .select()
        .from(dbFiles)
        .where(
          and(
            eq(dbFiles.id, input.id),
            eq(dbFiles.companyId, input.companyId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found.",
        });
      }

      // Best-effort storage cleanup
      try {
        await storageDelete(row.storageKey);
      } catch (err) {
        log.warn(`[files.delete] storageDelete failed for key ${row.storageKey}:`, err);
      }

      await db
        .delete(dbFiles)
        .where(
          and(eq(dbFiles.id, input.id), eq(dbFiles.companyId, input.companyId)),
        );

      return { success: true, deletedId: row.id, storageKey: row.storageKey };
    }),
});
