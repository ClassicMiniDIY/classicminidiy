export default defineNuxtRouteMiddleware((to: any, from: any) => {
  if (to.path.includes('technical/colors')) {
    return navigateTo('/archive/colors', { redirectCode: 301 });
  }
  if (to.path.includes('technical/manuals')) {
    return navigateTo('/archive/documents?type=manual', { redirectCode: 301 });
  }
  if (to.path.includes('technical/wheels')) {
    return navigateTo('/archive/wheels', { redirectCode: 301 });
  }
  if (to.path.includes('technical/electrical')) {
    return navigateTo('/archive/electrical', { redirectCode: 301 });
  }
  if (to.path.includes('technical/engines')) {
    return navigateTo('/archive/engines', { redirectCode: 301 });
  }
  if (to.path.includes('technical/chassisDecoder') || to.path.includes('technical/chasisDecoder')) {
    return navigateTo('/technical/chassis-decoder', { redirectCode: 301 });
  }
  if (to.path.includes('technical/engineDecoder')) {
    return navigateTo('/technical/engine-decoder', { redirectCode: 301 });
  }
  if (
    to.path.includes('registry') &&
    !to.path.includes('archive') &&
    !to.path.includes('admin') &&
    !to.path.includes('contribute')
  ) {
    return navigateTo('/archive/registry', { redirectCode: 301 });
  }
  if (to.path.includes('archive/carbs')) {
    return navigateTo('/archive/documents?type=tuning', { redirectCode: 301 });
  }
  // Redirects for removed archive pages consolidated into /archive/documents
  if (to.path.includes('archive/manuals')) {
    return navigateTo('/archive/documents?type=manual', { redirectCode: 301 });
  }
  if (to.path.includes('archive/adverts')) {
    return navigateTo('/archive/documents?type=advert', { redirectCode: 301 });
  }
  if (to.path.includes('archive/catalogues')) {
    return navigateTo('/archive/documents?type=catalogue', { redirectCode: 301 });
  }
  if (to.path.includes('archive/tuning')) {
    return navigateTo('/archive/documents?type=tuning', { redirectCode: 301 });
  }
});
