/**
 * Route guard for the 3D Model Library (keystone §10). The whole feature ships
 * dark behind `public.modelsEnabled`; until launch every /models page renders a
 * 404, matching the server routes' `assertModelsEnabled()`. Applied via
 * `definePageMeta({ middleware: 'models-enabled' })` on each models page.
 */
export default defineNuxtRouteMiddleware(() => {
  const config = useRuntimeConfig();
  if (!config.public.modelsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
});
