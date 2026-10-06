/**
 * GET /email/confirm?e=&x=&t=  — newsletter double opt-in CONFIRM page.
 *
 * GET never subscribes: mail scanners and link prefetchers follow GETs. The page
 * shows the masked address and a POST form to the same URL (confirm.post.ts).
 * Token format: server/utils/mailingListConfirm.ts.
 */
import { escapeUnsubHtml, maskEmail, unsubConfigured, unsubPage } from '../../utils/marketingUnsub';
import { verifyConfirmToken } from '../../utils/mailingListConfirm';

export default defineEventHandler((event) => {
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
      check.reason === 'expired'
        ? `<h1>This link has expired</h1>
           <p>Confirm links work for 7 days. <a href="/newsletter" style="color:#435231">Sign up again</a> and we will send a new one.</p>`
        : `<h1>This link isn't valid</h1>
           <p>Please use the link from your confirmation email, or <a href="/newsletter" style="color:#435231">sign up again</a>.</p>`
    );
  }

  const e = encodeURIComponent(String(query.e));
  const x = encodeURIComponent(String(query.x));
  const t = encodeURIComponent(String(query.t));
  return unsubPage(
    'Confirm subscription',
    `<h1>Confirm your newsletter subscription</h1>
     <p>Send the Classic Mini DIY newsletter to <strong>${escapeUnsubHtml(maskEmail(check.email))}</strong>?</p>
     <form method="POST" action="/email/confirm?e=${e}&x=${x}&t=${t}">
       <button type="submit" class="btn">Yes, subscribe me</button>
     </form>`
  );
});
