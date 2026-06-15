<script setup lang="ts">
  import { HERO_TYPES } from '../../data/models/generic';

  // English-only by design (like /legal/*): this is authoritative identity / E-E-A-T
  // content for the founder entity, so it isn't run through the per-locale <i18n>
  // machinery. NOTE for Cole: personalize the bio below — kept factual + modest.

  const canonical = 'https://classicminidiy.com/about';
  const description =
    'About Classic Mini DIY — a knowledgebase, toolkit, and archive for Classic Mini Cooper owners, founded by Cole Gentry to help enthusiasts work on their own cars.';

    // Title is just "About" — nuxt-seo-utils appends " | Classic Mini DIY" via the
    // site-name template (including the brand here would double it).
  useSeoMeta({
    title: 'About',
    description,
    ogTitle: 'About Classic Mini DIY',
    ogDescription: description,
    ogUrl: canonical,
    ogType: 'profile',
    ogImage: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
    twitterCard: 'summary_large_image',
    twitterTitle: 'About Classic Mini DIY',
    twitterDescription: description,
    twitterImage: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
  });

  useHead({ link: [{ rel: 'canonical', href: canonical }] });

  // Mark this WebPage as the AboutPage about the founder Person (#founder is defined
  // in the site-wide base graph, app/app.vue). This is the canonical home of the
  // author entity — the page Google/LLMs resolve E-E-A-T authorship against.
  useSchemaOrg([
    defineWebPage({
      '@type': 'AboutPage',
      about: { '@id': 'https://classicminidiy.com/#founder' },
    }),
  ]);
</script>

<template>
  <div>
    <Hero title="About Classic Mini DIY" :heroType="HERO_TYPES.CONTACT" textSize="text-4xl" class="pb-7" />

    <div class="container mx-auto px-4 pt-10">
      <div class="breadcrumbs text-sm">
        <ul>
          <li>
            <NuxtLink to="/" class="text-primary hover:underline">
              <i class="fas fa-house mr-2"></i>
              Home
            </NuxtLink>
          </li>
          <li><span class="opacity-70 font-medium">About</span></li>
        </ul>
      </div>
    </div>

    <div class="container mx-auto px-4 pt-8">
      <PageIntro
        eyebrow="ABOUT"
        title="Made by an enthusiast, for enthusiasts"
        description="Classic Mini DIY is a knowledgebase, toolkit, and permanent archive for Classic Mini Cooper owners — built to help you get out and work on your own car."
        as="h1"
      />
    </div>

    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <!-- Founder card -->
        <div class="lg:col-span-1">
          <div class="card bg-base-100 shadow-md">
            <div class="card-body items-center text-center">
              <NuxtImg
                src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg"
                alt="Cole Gentry, founder of Classic Mini DIY"
                width="120"
                height="120"
                class="rounded-full w-30 h-30 object-cover mb-2"
                loading="lazy"
              />
              <h2 class="font-semibold text-xl">Cole Gentry</h2>
              <p class="text-sm opacity-70">Founder, Classic Mini DIY</p>
              <a
                href="https://www.youtube.com/c/ClassicMiniDIY"
                target="_blank"
                rel="noopener"
                class="btn btn-sm btn-primary mt-3"
              >
                <i class="fab fa-youtube mr-2"></i>
                YouTube channel
              </a>
            </div>
          </div>
        </div>

        <!-- Bio + expertise -->
        <div class="lg:col-span-2 space-y-6">
          <div class="card bg-base-100 shadow-md">
            <div class="card-body">
              <h2 class="font-semibold text-2xl mb-2">Who's behind it</h2>
              <p class="opacity-80 leading-relaxed">
                I'm Cole Gentry, the founder of Classic Mini DIY. I build the calculators, decoders, and
                reference data on this site and share Classic Mini repair and restoration know-how on
                YouTube. The goal is simple: pull technical information from across the Classic Mini
                community into one place and keep it free, accurate, and easy to use.
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-md">
            <div class="card-body">
              <h2 class="font-semibold text-2xl mb-3">What you'll find here</h2>
              <p class="opacity-80 leading-relaxed mb-4">
                Everything here is focused on the A-series Classic Mini (1959–2000) — the cars, the
                engines, and the people who keep them on the road.
              </p>
              <ul class="space-y-2">
                <li class="flex items-start gap-3">
                  <i class="fas fa-wrench text-primary mt-1"></i>
                  <span class="opacity-80">
                    <NuxtLink to="/technical" class="text-primary hover:underline">Technical toolbox</NuxtLink>
                    — torque and clearance specs, SU needle and gearing calculators, compression maths.
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <i class="fas fa-magnifying-glass text-primary mt-1"></i>
                  <span class="opacity-80">
                    <NuxtLink to="/technical/chassis-decoder" class="text-primary hover:underline"
                      >Chassis</NuxtLink
                    >
                    and
                    <NuxtLink to="/technical/engine-decoder" class="text-primary hover:underline"
                      >engine</NuxtLink
                    >
                    number decoders to identify your car.
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <i class="fas fa-box-archive text-primary mt-1"></i>
                  <span class="opacity-80">
                    A digitized
                    <NuxtLink to="/archive" class="text-primary hover:underline">document archive</NuxtLink>
                    — workshop manuals, adverts, catalogues, and wiring diagrams.
                  </span>
                </li>
                <li class="flex items-start gap-3">
                  <i class="fas fa-cube text-primary mt-1"></i>
                  <span class="opacity-80">
                    A community
                    <NuxtLink to="/models" class="text-primary hover:underline">3D model library</NuxtLink>
                    of printable parts for restoration and upgrades.
                  </span>
                </li>
              </ul>
              <div class="mt-6">
                <NuxtLink to="/technical" class="btn btn-primary">
                  <i class="fas fa-screwdriver-wrench mr-2"></i>
                  Explore the toolbox
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
