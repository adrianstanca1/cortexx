import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, whatsappContacts, whatsappMessages } from '@cortexbuild/db';
import { authMiddleware, requireRole } from '../middleware/auth';
const router: Router = Router();
router.use(authMiddleware);

// SECURITY: The whatsapp_contacts / whatsapp_conversations / whatsapp_messages
// tables have NO company_id column (see packages/db/src/schema.ts:731-767 and
// drizzle/0000_calm_gorgon.sql:694-739). Before this commit, GET /contacts and
// GET /contacts/:id/messages returned every WhatsApp record in the DB to any
// authenticated user from any tenant — a cross-tenant data leak.
//
// The audit prescription ("filter by req.user.companyId") cannot be applied
// without a schema migration to add company_id and backfill ownership for
// existing rows. Until that migration lands, the only safe defensive posture
// is to restrict these endpoints to platform operators (admin / super_admin)
// who already have legitimate access to all tenants' data. Regular users from
// individual companies must NOT see the global WhatsApp inbox.
//
// TODO(security): add company_id column to whatsapp_* tables, backfill from
// whatsapp_contacts.project_tag (or by mapping wa_id → known projects), then
// replace the role gate below with the standard companyId filter pattern used
// in routes/projects.ts.
const requirePlatformAdmin = requireRole('admin', 'super_admin');

router.get('/contacts', requirePlatformAdmin, async (req,res) => {
  const rows = await db.select().from(whatsappContacts).orderBy(whatsappContacts.createdAt);
  res.json({success:true,data:rows});
});
router.get('/contacts/:id/messages', requirePlatformAdmin, async (req,res) => {
  const rows = await db.select().from(whatsappMessages)
    .where(eq(whatsappMessages.contactId, parseInt(req.params.id as string)))
    .orderBy(whatsappMessages.createdAt);
  res.json({success:true,data:rows});
});
// Webhook endpoints — note: the parent mount in routes/index.ts applies
// authMiddleware to this whole router, so WhatsApp's external webhook
// callbacks won't reach these handlers as-is. That's a pre-existing wiring
// bug unrelated to the cross-tenant leak fix; tracked separately.
router.get('/webhook', (req,res) => {
  // WhatsApp verification
  res.json({status:'verified'});
});
router.post('/webhook', (req,res) => {
  res.status(200).json({status:'received'});
});
export default router;
