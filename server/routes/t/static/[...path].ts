export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || '';
  const target = `https://us-assets.i.posthog.com/static/${path}`;
  return proxyRequest(event, target);
});
