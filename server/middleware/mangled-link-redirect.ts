/**
 * Gmail (and some mail clients) occasionally rewrite bare URLs in sent mail by
 * gluing Google-redirector params onto the path with '&' instead of '?', e.g.
 *   /discord/connect&source=gmail&ust=17840...&sa=E
 * That path matches no route, so a member following an emailed support link
 * lands on the 404 catch-all instead of the claim flow (observed in the wild —
 * a member looped on exactly this). Strip the mangled tail and redirect to the
 * clean route for the handful of paths we send in emails.
 */
const EMAILED_PATHS = ['/discord/connect', '/discord/claim', '/membership', '/login'];

export default defineEventHandler((event) => {
  const path = event.path;
  const amp = path.indexOf('&');
  if (amp === -1) return;
  const base = path.slice(0, amp);
  if (EMAILED_PATHS.includes(base)) {
    return sendRedirect(event, base, 302);
  }
});
