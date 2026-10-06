/**
 * GET /email/unsubscribe?e=<b64url email>&t=<b64url hmac>
 *
 * Marketing unsubscribe CONFIRM page. GET never performs the opt-out — mail
 * scanners and link prefetchers (Outlook SafeLinks etc.) follow GETs, and an
 * auto-unsubscribe on fetch would silently shred the audience. The page shows
 * a masked address and a POST form to the same URL; the POST (also the RFC
 * 8058 one-click target) does the actual suppression.
 */
import { escapeUnsubHtml, maskEmail, unsubConfigured, unsubPage, verifyUnsubToken } from '../../utils/marketingUnsub';

export default defineEventHandler((event) => {
  setHeader(event, 'X-Robots-Tag', 'noindex');
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8');

  const query = getQuery(event);

  // An unsubscribe link in an old Ghost newsletter email. news.classicminidiy.com
  // redirects /unsubscribe* here (Cloudflare rule, Ghost retirement Phase 6). Ghost's
  // link names a Ghost member we cannot map to an address, so explain instead of
  // answering "invalid link".
  if (query.from === 'news' && !query.e) {
    return unsubPage(
      'Old blog newsletter',
      `<h1>The old blog newsletter has stopped</h1>
       <p>We no longer send email from the old Classic Mini DIY blog. Its articles now live on
       <a href="https://community.classicminidiy.com/c/news/16" style="color:#435231">the community forum</a>.</p>
       <p>To stop Classic Mini DIY emails, use the unsubscribe link at the bottom of any email
       we send you, or email
       <a href="mailto:classicminidiy@gmail.com" style="color:#435231">classicminidiy@gmail.com</a>.</p>`
    );
  }

  if (!unsubConfigured()) {
    setResponseStatus(event, 503);
    return unsubPage(
      'Unavailable',
      `<h1>Temporarily unavailable</h1>
       <p>Unsubscribe is not available right now. Please try again later or email
       <a href="mailto:classicminidiy@gmail.com" style="color:#435231">classicminidiy@gmail.com</a>.</p>`
    );
  }

  const email = verifyUnsubToken(query.e, query.t);
  if (!email) {
    setResponseStatus(event, 400);
    return unsubPage(
      'Invalid link',
      `<h1>This link isn't valid</h1>
       <p>This unsubscribe link is invalid or was modified. Please use the link from a
       recent Classic Mini DIY email, or contact
       <a href="mailto:classicminidiy@gmail.com" style="color:#435231">classicminidiy@gmail.com</a>.</p>`
    );
  }

  const e = encodeURIComponent(String(query.e));
  const t = encodeURIComponent(String(query.t));
  return unsubPage(
    'Unsubscribe',
    `<h1>Unsubscribe from marketing emails?</h1>
     <p>Stop sending Classic Mini DIY marketing emails to <strong>${escapeUnsubHtml(maskEmail(email))}</strong>?</p>
     <form method="POST" action="/email/unsubscribe?e=${e}&t=${t}">
       <button type="submit" class="btn">Unsubscribe</button>
     </form>`
  );
});
