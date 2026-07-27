/**
 * GET /api/admin/marketing/access
 *
 * Cheap allowlist probe: 200 { allowed: true } iff the caller passes
 * requireMarketingAdmin (admin + MARKETING_ADMIN_EMAILS). The allowlist is
 * server-only config, so the admin dashboard / sidebar call this to decide
 * whether to surface the Marketing Email entry points at all — non-allowlisted
 * admins simply never see them (and would 403 on every action anyway).
 */
import { requireMarketingAdmin } from '../../../utils/marketingAuth';

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);
  return { allowed: true };
});
