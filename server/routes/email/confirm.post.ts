/**
 * POST /email/confirm?e=&x=&t=  — performs the newsletter double opt-in.
 *
 * Verifies the signed confirm: token, then calls mailing_list_confirm (service
 * role), which subscribes the address and clears ONLY an 'unsubscribe'
 * suppression; bounces, complaints and manual blocks stay. Idempotent.
 */
import { getServiceClient } from '../../utils/supabase';
import { unsubConfigured, unsubPage } from '../../utils/marketingUnsub';
import { verifyConfirmToken } from '../../utils/mailingListConfirm';

export default defineEventHandler(async (event) => {
  setHeader(event, 'X-Robots-Tag', 'noindex');
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8');

  if (!unsubConfigured()) {
    setResponseStatus(event, 503);
    return unsubPage('Unavailable', `<h1>Temporarily unavailable</h1><p>Please try again later.</p>`);
  }

  const query = getQuery(event);
  const check = verifyConfirmToken(query.e, query.x, query.t);
  if (!check.ok) {
    setResponseStatus(event, check.reason === 'expired' ? 410 : 400);
    return unsubPage(
      check.reason === 'expired' ? 'Link expired' : 'Invalid link',
      `<h1>${check.reason === 'expired' ? 'This link has expired' : "This link isn't valid"}</h1>
       <p><a href="/newsletter" style="color:#435231">Sign up again</a> and we will send a new link.</p>`
    );
  }

  const { error } = await getServiceClient().rpc('mailing_list_confirm', { p_email: check.email });
  if (error) {
    console.error('[email/confirm] mailing_list_confirm failed:', error.message);
    setResponseStatus(event, 500);
    return unsubPage(
      'Something went wrong',
      `<h1>Something went wrong</h1>
       <p>We couldn't confirm your subscription. Please try the link again, or email
       <a href="mailto:classicminidiy@gmail.com" style="color:#435231">classicminidiy@gmail.com</a>.</p>`
    );
  }

  return unsubPage(
    'Subscribed',
    `<h1>You're subscribed</h1>
     <p>Thanks. The Classic Mini DIY newsletter will come to this address. Every email has a one-click unsubscribe link.</p>`
  );
});
