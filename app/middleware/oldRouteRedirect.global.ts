const redirects: { from: string; to: string }[] = [
  // Old technical paths moved to archive
  { from: 'technical/colors', to: '/archive/colors' },
  { from: 'technical/manuals', to: '/archive/documents?type=manual' },
  { from: 'technical/wheels', to: '/archive/wheels' },
  { from: 'technical/electrical', to: '/archive/electrical' },
  { from: 'technical/engines', to: '/archive/engines' },
  // Renamed technical paths
  { from: 'technical/chassisDecoder', to: '/technical/chassis-decoder' },
  { from: 'technical/chasisDecoder', to: '/technical/chassis-decoder' },
  { from: 'technical/engineDecoder', to: '/technical/engine-decoder' },
  // Removed archive pages consolidated into /archive/documents
  { from: 'archive/carbs', to: '/archive/documents?type=tuning' },
  { from: 'archive/manuals', to: '/archive/documents?type=manual' },
  { from: 'archive/adverts', to: '/archive/documents?type=advert' },
  { from: 'archive/catalogues', to: '/archive/documents?type=catalogue' },
  { from: 'archive/tuning', to: '/archive/documents?type=tuning' },
];

export default defineNuxtRouteMiddleware((to: any, from: any) => {
  for (const redirect of redirects) {
    if (to.path.includes(redirect.from)) {
      return navigateTo(redirect.to, { redirectCode: 301 });
    }
  }

  // Registry root path redirect (with exclusions)
  if (
    to.path.includes('registry') &&
    !to.path.includes('archive') &&
    !to.path.includes('admin') &&
    !to.path.includes('contribute')
  ) {
    return navigateTo('/archive/registry', { redirectCode: 301 });
  }
});
