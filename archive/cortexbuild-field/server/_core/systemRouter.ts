import { z } from "zod";
import { notifyOwner } from "./notification";
import { publicProcedure, router, superAdminProcedure } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),

  // Platform-level admin endpoint. superAdminProcedure currently aliases
  // adminProcedure — the historical TOTP-required gate was removed when
  // 2FA was taken out of the product.
  notifyOwner: superAdminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
