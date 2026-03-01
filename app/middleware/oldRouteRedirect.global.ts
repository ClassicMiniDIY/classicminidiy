export default defineNuxtRouteMiddleware((to: any, from: any) => {
  if (to.path.includes('technical/colors')) {
    return navigateTo('/archive/colors');
  }
  if (to.path.includes('technical/manuals')) {
    return navigateTo('/archive/documents?type=manual');
  }
  if (to.path.includes('technical/wheels')) {
    return navigateTo('/archive/wheels');
  }
  if (to.path.includes('technical/electrical')) {
    return navigateTo('/archive/electrical');
  }
  if (to.path.includes('technical/engines')) {
    return navigateTo('/archive/engines');
  }
  if (to.path.includes('technical/chassisDecoder') || to.path.includes('technical/chasisDecoder')) {
    return navigateTo('/technical/chassis-decoder');
  }
  if (to.path.includes('technical/engineDecoder')) {
    return navigateTo('/technical/engine-decoder');
  }
  if (to.path.includes('registry') && !to.path.includes('archive') && !to.path.includes('admin')) {
    return navigateTo('/archive/registry');
  }
  if (to.path.includes('archive/carbs')) {
    return navigateTo('/archive/documents?type=tuning');
  }
});
