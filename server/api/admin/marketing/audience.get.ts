/**
 * GET /api/admin/marketing/audience
 *
 * Marketing-admin only. Resolves the live marketing audience counts (digest
 * opt-ins ∪ Shopify ∪ Ghost ∪ Patreon, minus suppressions) via the
 * `marketing_audience` action. SLOW (~30-60s — four external API crawls);
 * the composer calls it only from an explicit "Refresh audience" button.
 * Returns counts only — recipient addresses never reach the browser.
 *
 *   returns: { counts: { profile, shopify, ghost, patreon, suppressed, total } }
 */
import { requireMarketingAdmin } from '../../../utils/marketingAuth';
import { callMarketingEdge } from '../../../utils/marketingEdge';

export default defineEventHandler(async (event) => {
  await requireMarketingAdmin(event);
  // Generous timeout — Ghost + Shopify + Patreon + SES suppression walks.
  return callMarketingEdge({ action: 'marketing_audience' }, { timeout: 120_000 });
});
