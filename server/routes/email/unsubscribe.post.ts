/**
 * POST /email/unsubscribe?e=<b64url email>&t=<b64url hmac>
 *
 * Performs the marketing opt-out. Serves BOTH the confirm-page form and the
 * RFC 8058 one-click POST that Gmail/Yahoo issue against the List-Unsubscribe
 * URL (body `List-Unsubscribe=One-Click`; no CSRF token — the HMAC in the URL
 * is the authorization). Upserts into email_suppressions, which every
 * marketing + newsletter send subtracts, covering recipients from all sources
 * (profiles, Shopify, Ghost, Patreon) uniformly. Duplicate opt-outs return
 * the same success page.
 */
import { getServiceClient } from '../../utils/supabase';
import { unsubConfigured, unsubPage, verifyUnsubToken } from '../../utils/marketingUnsub';

export default defineEventHandler(async (event) => {
  setHeader(event, 'X-Robots-Tag', 'noindex');
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8');

  if (!unsubConfigured()) {
    setResponseStatus(event, 503);
    return unsubPage('Unavailable', `<h1>Temporarily unavailable</h1><p>Please try again later.</p>`);
  }

  const query = getQuery(event);
  const email = verifyUnsubToken(query.e, query.t);
  if (!email) {
    setResponseStatus(event, 400);
    return unsubPage(
      'Invalid link',
      `<h1>This link isn't valid</h1>
       <p>This unsubscribe link is invalid or was modified. Please use the link from a
       recent Classic Mini DIY email.</p>`
    );
  }

  const db = getServiceClient();
  const { error } = await db.from('email_suppressions').upsert(
    {
      email,
      reason: 'unsubscribe',
      source: 'marketing_unsub',
      details: 'Marketing unsubscribe (one-click or confirm page)',
    },
    { onConflict: 'email', ignoreDuplicates: true }
  );
  if (error) {
    console.error('[email/unsubscribe] suppression insert failed:', error.message);
    setResponseStatus(event, 500);
    return unsubPage(
      'Something went wrong',
      `<h1>Something went wrong</h1>
       <p>We couldn't process the unsubscribe. Please try again, or email
       <a href="mailto:classicminidiy@gmail.com" style="color:#435231">classicminidiy@gmail.com</a>.</p>`
    );
  }

  return unsubPage(
    'Unsubscribed',
    `<h1>You're unsubscribed</h1>
     <p>You won't receive marketing emails from Classic Mini DIY anymore.
     Transactional emails (receipts, account notifications) are unaffected.</p>`
  );
});
