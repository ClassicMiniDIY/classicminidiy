<script lang="ts" setup>
  /**
   * Model Variants archive — one variant (design R2, "Model detail").
   *
   * The structured spec sheet. Every value carries a source chip that maps to
   * the sources card; spec groups cross-link into the Toolbox (compression
   * calculator, engine decoder), the Wheel Library and the Colour archive so
   * the registry is the connective data layer, not a dead end. "I own one"
   * sends people to the existing car register rather than duplicating it.
   */
  import { HERO_TYPES } from '../../../../data/models/generic';
  import {
    FUEL_SYSTEM_LABELS,
    MARKET_LABELS,
    MARQUE_LABELS,
    SPEC_ROW_COUNT,
    countSourcedSpecs,
    markLabel,
    toKmh,
    toLb,
    toNm,
    toPs,
    yearsLabel,
    type ModelVariantCard,
  } from '../../../../data/models/variants';

  const { t } = useI18n();
  const { track } = useAnalytics();
  const { openWizard } = useContributeWizard();
  const route = useRoute();
  const slug = String(route.params.slug ?? '');

  const { getVariant } = useModelVariants();
  const { data, error } = await getVariant(slug);

  // A miss is a real 404, not a blank 200 (images-seo rule). The API route
  // already answered 404; propagate it so crawlers stop re-requesting.
  if (error.value || !data.value?.variant) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found', fatal: true });
  }

  const variant = computed(() => data.value!.variant);
  const related = computed<ModelVariantCard[]>(() => data.value?.related ?? []);

  const years = computed(() => yearsLabel(variant.value.year_start, variant.value.year_end));
  const specsSourced = computed(() => countSourcedSpecs(variant.value));
  const photos = computed(() => variant.value.images.filter((i) => i.url));
  const hasPhotos = computed(() => photos.value.length > 0);

  // ---- Source chips ---------------------------------------------------------
  // Every row from the seed cites source 1 (the archived page). Contributions
  // add sources in order; the chip index is 1-based to read like a footnote.
  const sources = computed(() => variant.value.sources ?? []);
  const seedChip = 'S1';

  const fmt = (n: number, digits = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: digits });

  interface SpecRow {
    key: string;
    label: string;
    value: string;
    link?: { to: string; label: string; icon: string };
  }

  const engineRows = computed<SpecRow[]>(() => {
    const v = variant.value;
    const rows: SpecRow[] = [];
    if (v.engine_cc)
      rows.push({
        key: 'engine',
        label: t('rows.engine'),
        value: `A-series ${fmt(v.engine_cc)} cc${v.engine_note ? ` · ${v.engine_note}` : ''}`,
        link: { to: '/technical/engine-decoder', label: t('links.engine_decoder'), icon: 'fas fa-engine' },
      });
    if (v.compression_ratio !== null)
      rows.push({
        key: 'compression',
        label: t('rows.compression'),
        value: `${v.compression_ratio} : 1`,
        link: { to: '/technical/compression', label: t('links.cr_calculator'), icon: 'fas fa-calculator' },
      });
    if (v.carburettor || v.fuel_system)
      rows.push({
        key: 'carb',
        label: t('rows.carburation'),
        value: [v.carburettor, v.fuel_system ? FUEL_SYSTEM_LABELS[v.fuel_system] : null].filter(Boolean).join(' · '),
        link: v.fuel_system?.startsWith('carb')
          ? { to: '/technical/needles', label: t('links.needles'), icon: 'fas fa-syringe' }
          : undefined,
      });
    if (v.power_bhp !== null)
      rows.push({
        key: 'power',
        label: t('rows.power'),
        value:
          `${fmt(v.power_bhp, 1)} bhp (${toPs(v.power_bhp)} PS)` +
          (v.power_rpm ? ` @ ${fmt(v.power_rpm)} rpm` : '') +
          (v.power_standard ? ` · ${v.power_standard}` : ''),
      });
    if (v.torque_lbft !== null)
      rows.push({
        key: 'torque',
        label: t('rows.torque'),
        value:
          `${fmt(v.torque_lbft, 1)} lb-ft (${toNm(v.torque_lbft)} Nm)` +
          (v.torque_rpm ? ` @ ${fmt(v.torque_rpm)} rpm` : ''),
      });
    return rows;
  });

  const drivetrainRows = computed<SpecRow[]>(() => {
    const v = variant.value;
    const rows: SpecRow[] = [];
    if (v.final_drive !== null) rows.push({ key: 'fd', label: t('rows.final_drive'), value: `${v.final_drive} : 1` });
    if (v.wheels)
      rows.push({
        key: 'wheels',
        label: t('rows.wheels'),
        value: v.wheels,
        link: { to: '/archive/wheels', label: t('links.wheel_library'), icon: 'fas fa-ring' },
      });
    if (v.tyres) rows.push({ key: 'tyres', label: t('rows.tyres'), value: v.tyres });
    if (v.kerb_weight_kg !== null)
      rows.push({
        key: 'weight',
        label: t('rows.kerb_weight'),
        value: `${fmt(v.kerb_weight_kg)} kg (${fmt(toLb(v.kerb_weight_kg))} lb)`,
        link: { to: '/archive/weights', label: t('links.weights'), icon: 'fas fa-weight-hanging' },
      });
    if (v.top_speed_mph !== null)
      rows.push({
        key: 'speed',
        label: t('rows.top_speed'),
        value: `${fmt(v.top_speed_mph)} mph (${toKmh(v.top_speed_mph)} km/h)`,
      });
    return rows;
  });

  const productionRows = computed<SpecRow[]>(() => {
    const v = variant.value;
    const rows: SpecRow[] = [];
    if (years.value) rows.push({ key: 'run', label: t('rows.production_run'), value: years.value });
    if (v.production_total !== null) {
      const split = v.production
        .filter((p) => p.marque)
        .map((p) => `${MARQUE_LABELS[p.marque as keyof typeof MARQUE_LABELS] ?? p.marque}: ${fmt(p.count)}`)
        .join(' · ');
      rows.push({
        key: 'built',
        label: t('rows.units_built'),
        value: `${fmt(v.production_total)}${split ? ` (${split})` : ''}`,
      });
    }
    if (v.edition_size !== null && v.edition_size !== v.production_total)
      rows.push({ key: 'edition', label: t('rows.edition_size'), value: fmt(v.edition_size) });
    rows.push({ key: 'market', label: t('rows.market'), value: MARKET_LABELS[v.market] });
    if (v.mark)
      rows.push({
        key: 'mark',
        label: t('rows.mark'),
        value: markLabel(v.mark),
        link: { to: '/technical/chassis-decoder', label: t('links.chassis_decoder'), icon: 'fas fa-id-card' },
      });
    return rows;
  });

  const colourLink = (name: string) => `/archive/colors?q=${encodeURIComponent(name)}`;

  const eyebrow = computed(() =>
    [MARQUE_LABELS[variant.value.marque], markLabel(variant.value.mark), MARKET_LABELS[variant.value.market]]
      .filter(Boolean)
      .join(' · ')
  );

  // ---- Actions --------------------------------------------------------------
  const submitUpdate = (area: string) => {
    track('contribute_cta_clicked', { type: 'variant_fix', location: `variant_detail_${area}` });
    openWizard({ kind: 'fix', origin: `variant_detail_${area}`, targetTitle: `${variant.value.name} (${slug})` });
  };

  // ---- SEO ------------------------------------------------------------------
  const title = computed(() => t('seo.title', { name: variant.value.name, years: years.value || '1959–2000' }));
  const description = computed(() => {
    const v = variant.value;
    const bits = [
      v.engine_cc ? `${v.engine_cc} cc` : null,
      v.power_bhp !== null ? `${fmt(v.power_bhp)} bhp` : null,
      v.kerb_weight_kg !== null ? `${fmt(v.kerb_weight_kg)} kg` : null,
      v.production_total !== null ? t('seo.built', { n: fmt(v.production_total) }) : null,
    ].filter(Boolean);
    return t('seo.description', { name: v.name, years: years.value || '', specs: bits.join(', ') });
  });
  // A constant fallback, never '' — an empty string is coerced to `true` by
  // unhead and nuxt-og-image 500s SSR (docs/invariants/seo.md).
  const shareImage = computed(
    () => photos.value[0]?.url ?? 'https://classicminidiy.s3.amazonaws.com/social-share/archive.png'
  );
  const canonical = `https://www.classicminidiy.com/archive/variants/${slug}`;

  useHead({
    title,
    meta: [
      { key: 'description', name: 'description', content: description },
      { key: 'keywords', name: 'keywords', content: () => t('seo.keywords', { name: variant.value.name }) },
    ],
    link: [
      { rel: 'canonical', href: canonical },
      { rel: 'preconnect', href: 'https://classicminidiy.s3.amazonaws.com' },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title.value,
          description: description.value,
          url: canonical,
          about: {
            '@type': 'Car',
            name: variant.value.name,
            brand: { '@type': 'Brand', name: MARQUE_LABELS[variant.value.marque] },
            model: variant.value.name,
            productionDate: variant.value.year_start ? String(variant.value.year_start) : undefined,
            vehicleEngine: variant.value.engine_cc
              ? {
                  '@type': 'EngineSpecification',
                  engineDisplacement: { '@type': 'QuantitativeValue', value: variant.value.engine_cc, unitCode: 'CMQ' },
                }
              : undefined,
          },
          publisher: { '@type': 'Organization', name: 'Classic Mini DIY', url: 'https://www.classicminidiy.com' },
        }),
      },
    ],
  });

  useSeoMeta({
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonical,
    ogImage: shareImage,
    ogType: 'article',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: shareImage,
  });
</script>

<template>
  <div>
    <hero :navigation="true" :title="t('hero_title')" :heroType="HERO_TYPES.ARCHIVE" title-tag="p" />
    <ArchiveSubnav active-key="variants" />
    <div class="container mx-auto px-4 py-4">
      <breadcrumb
        class="mt-2 mb-4"
        :page="variant.name"
        :subpage="t('breadcrumb_subpage')"
        subpage-href="/archive/variants"
      ></breadcrumb>

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-start gap-4 mb-6">
        <div class="flex-1 min-w-0">
          <p class="eyebrow m-0">{{ eyebrow }}</p>
          <h1 class="fancy-font-bold text-3xl md:text-4xl leading-tight my-1">{{ variant.name }}</h1>
          <p class="text-sm md:text-[15px] opacity-80 m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span v-if="years">{{ years }}</span>
            <span v-if="years" aria-hidden="true">·</span>
            <span>{{ t(`labels.body.${variant.body_style}`) }}</span>
            <template v-if="variant.production_total !== null">
              <span aria-hidden="true">·</span>
              <span>{{ t('meta.built', { n: fmt(variant.production_total) }) }}</span>
            </template>
            <template v-if="variant.is_limited_edition">
              <span aria-hidden="true">·</span>
              <span class="badge badge-sm badge-secondary badge-outline">{{ t('meta.limited') }}</span>
            </template>
            <span aria-hidden="true">·</span>
            <span class="font-semibold text-primary"
              ><i class="fas fa-box-archive" aria-hidden="true"></i> {{ t('meta.preserved') }}</span
            >
            <span aria-hidden="true">·</span>
            <span>{{ t('meta.specs_sourced', { n: specsSourced, total: SPEC_ROW_COUNT }) }}</span>
          </p>
        </div>
        <button type="button" class="btn btn-secondary shrink-0" @click="submitUpdate('header')">
          <i class="fas fa-paper-plane" aria-hidden="true"></i> {{ t('actions.submit_update') }}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <!-- Main column -->
        <div class="lg:col-span-2 flex flex-col gap-4">
          <!-- Photos -->
          <div v-if="hasPhotos" class="grid grid-cols-3 gap-2.5">
            <figure class="col-span-2 aspect-video rounded-xl overflow-hidden bg-base-200">
              <NuxtImg
                :src="photos[0]!.url"
                :alt="photos[0]!.alt || variant.name"
                format="webp"
                class="w-full h-full object-cover"
              />
            </figure>
            <div class="grid grid-rows-2 gap-2.5">
              <figure v-if="photos[1]" class="rounded-xl overflow-hidden bg-base-200">
                <NuxtImg
                  :src="photos[1]!.url"
                  :alt="photos[1]!.alt || variant.name"
                  format="webp"
                  class="w-full h-full object-cover"
                />
              </figure>
              <button
                type="button"
                class="rounded-xl bg-base-200 flex flex-col items-center justify-center gap-1 text-secondary hover:bg-base-300 transition-colors"
                @click="submitUpdate('photos')"
              >
                <i class="fas fa-camera" aria-hidden="true"></i>
                <span class="text-xs font-semibold">{{ t('actions.add_photos') }}</span>
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="aspect-video w-full rounded-xl bg-base-200 border border-dashed border-base-300 flex flex-col items-center justify-center gap-2 hover:border-secondary transition-colors"
            @click="submitUpdate('photos')"
          >
            <i class="fas fa-camera text-3xl text-secondary" aria-hidden="true"></i>
            <span class="font-semibold text-secondary">{{ t('photos.gap_title') }}</span>
            <span class="text-sm opacity-70 max-w-md px-4">{{ t('photos.gap_body') }}</span>
          </button>

          <!-- Spec groups -->
          <section
            v-for="group in [
              { key: 'engine', icon: 'fas fa-gauge', title: t('sections.engine'), rows: engineRows },
              { key: 'drivetrain', icon: 'fas fa-gears', title: t('sections.drivetrain'), rows: drivetrainRows },
              { key: 'production', icon: 'fas fa-id-card', title: t('sections.production'), rows: productionRows },
            ]"
            :key="group.key"
            class="card bg-base-100 border border-base-300 shadow-md"
          >
            <div class="card-body p-5">
              <div class="flex items-center mb-1">
                <h2 class="text-xs font-bold tracking-[0.08em] uppercase opacity-70 flex-1 m-0">
                  <i :class="group.icon" class="text-primary" aria-hidden="true"></i>&ensp;{{ group.title }}
                </h2>
                <button
                  type="button"
                  class="link link-secondary text-xs font-bold no-underline"
                  @click="submitUpdate(group.key)"
                >
                  <i class="fas fa-wrench" aria-hidden="true"></i> {{ t('actions.suggest_fix') }}
                </button>
              </div>
              <table v-if="group.rows.length" class="spec-table w-full">
                <tbody>
                  <tr v-for="row in group.rows" :key="row.key">
                    <td class="spec-label">{{ row.label }}</td>
                    <td>
                      {{ row.value }}
                      <a :href="`#source-1`" class="src-chip" :title="sources[0]?.title">{{ seedChip }}</a>
                      <NuxtLink
                        v-if="row.link"
                        :to="row.link.to"
                        class="ml-2 text-xs font-semibold text-primary whitespace-nowrap"
                      >
                        <i :class="row.link.icon" aria-hidden="true"></i> {{ row.link.label }}
                      </NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-sm opacity-60 m-0">{{ t('sections.empty') }}</p>
            </div>
          </section>

          <!-- Colours -->
          <section class="card bg-base-100 border border-base-300 shadow-md">
            <div class="card-body p-5">
              <div class="flex items-center mb-2">
                <h2 class="text-xs font-bold tracking-[0.08em] uppercase opacity-70 flex-1 m-0">
                  <i class="fas fa-palette text-primary" aria-hidden="true"></i>&ensp;{{ t('sections.colours') }}
                </h2>
                <button
                  type="button"
                  class="link link-secondary text-xs font-bold no-underline"
                  @click="submitUpdate('colours')"
                >
                  <i class="fas fa-wrench" aria-hidden="true"></i> {{ t('actions.suggest_fix') }}
                </button>
              </div>
              <div v-if="variant.colors.length" class="flex flex-wrap gap-2">
                <NuxtLink
                  v-for="colour in variant.colors"
                  :key="colour"
                  :to="colourLink(colour)"
                  class="badge badge-outline badge-lg gap-1 hover:badge-primary"
                  :title="t('links.colour_archive', { name: colour })"
                >
                  <i class="fas fa-droplet text-xs" aria-hidden="true"></i>{{ colour }}
                </NuxtLink>
                <a href="#source-1" class="src-chip self-center">{{ seedChip }}</a>
              </div>
              <p v-else class="text-sm opacity-60 m-0">{{ t('sections.no_colours') }}</p>
              <p v-if="variant.notes" class="text-sm opacity-70 mt-3 mb-0">{{ variant.notes }}</p>
            </div>
          </section>

          <!-- Related -->
          <section v-if="related.length" class="mt-2">
            <h2 class="text-xs font-bold tracking-[0.08em] uppercase opacity-70 mb-3">{{ t('sections.related') }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NuxtLink
                v-for="r in related"
                :key="r.slug"
                :to="`/archive/variants/${r.slug}`"
                class="card card-compact bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
              >
                <div class="card-body">
                  <p class="font-semibold m-0 leading-snug">{{ r.name }}</p>
                  <p class="text-xs opacity-70 m-0">
                    {{
                      [yearsLabel(r.year_start, r.year_end), r.engine_cc ? `${r.engine_cc} cc` : '']
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </p>
                </div>
              </NuxtLink>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <aside class="flex flex-col gap-4">
          <div class="card bg-primary/10 border border-primary/25">
            <div class="card-body p-5">
              <p class="text-xs font-bold tracking-[0.08em] uppercase text-primary m-0">{{ t('registry.title') }}</p>
              <p class="text-sm opacity-80 my-2">{{ t('registry.body') }}</p>
              <NuxtLink
                to="/contribute/registry"
                class="btn btn-primary btn-sm self-start"
                @click="track('contribute_cta_clicked', { type: 'registry', location: 'variant_detail' })"
              >
                <i class="fas fa-car-side" aria-hidden="true"></i> {{ t('registry.cta') }}
              </NuxtLink>
            </div>
          </div>

          <div id="source-1" class="card bg-base-100 border border-base-300 shadow-md scroll-mt-24">
            <div class="card-body p-5">
              <p class="text-xs font-bold tracking-[0.08em] uppercase opacity-70 m-0 mb-2">
                {{ t('sections.sources') }}
              </p>
              <ol class="m-0 p-0 list-none flex flex-col gap-2">
                <li v-for="(s, i) in sources" :key="i" class="text-sm leading-snug flex gap-2">
                  <span class="src-chip shrink-0">S{{ Number(i) + 1 }}</span>
                  <span>
                    <a
                      v-if="s.url"
                      :href="s.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link link-primary no-underline hover:underline"
                      >{{ s.title }}</a
                    >
                    <template v-else>{{ s.title }}</template>
                    <span v-if="s.accessed" class="block text-xs opacity-60">{{
                      t('sources.accessed', { date: s.accessed })
                    }}</span>
                  </span>
                </li>
              </ol>
              <p class="text-xs opacity-60 mt-3 mb-0">{{ t('sources.note') }}</p>
            </div>
          </div>

          <div class="card border border-dashed border-base-300">
            <div class="card-body p-4 flex-row gap-3 items-start">
              <i class="fas fa-robot text-secondary mt-0.5" aria-hidden="true"></i>
              <p class="text-sm opacity-80 m-0">
                {{ t('bot.body') }}
                <NuxtLink to="/chat" class="link link-primary font-semibold no-underline hover:underline">{{
                  t('bot.link')
                }}</NuxtLink>
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div class="divider my-8"></div>
      <NuxtLink to="/archive/variants" class="btn btn-ghost btn-sm">
        <i class="fas fa-arrow-left" aria-hidden="true"></i> {{ t('back') }}
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
  .spec-table td {
    padding: 0.45rem 0;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--color-base-300);
    vertical-align: top;
  }
  .spec-table tr:last-child td {
    border-bottom: none;
  }
  .spec-label {
    width: 40%;
    padding-right: 0.75rem;
    font-weight: 600;
    opacity: 0.75;
  }
  .src-chip {
    display: inline-block;
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 1.4;
    padding: 0.05rem 0.4rem;
    border-radius: 0.25rem;
    color: var(--color-accent);
    background: color-mix(in oklab, var(--color-primary) 14%, transparent);
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
  }
</style>

<i18n lang="json">
{
  "en": {
    "hero_title": "Classic Mini Model Variants",
    "breadcrumb_subpage": "Model Variants",
    "back": "All model variants",
    "meta": {
      "built": "{n} built",
      "limited": "Limited edition",
      "preserved": "Preserved",
      "specs_sourced": "{n} of {total} specs sourced"
    },
    "actions": {
      "submit_update": "Submit an update",
      "suggest_fix": "Suggest a fix",
      "add_photos": "+ Add photos"
    },
    "photos": {
      "gap_title": "No photos yet — add yours",
      "gap_body": "Brochure scans, period photos or your own car. Reviewed before they go live, credited to you."
    },
    "sections": {
      "engine": "Engine",
      "drivetrain": "Drivetrain, wheels & weight",
      "production": "Production & market",
      "colours": "Factory colours",
      "sources": "Sources",
      "related": "Also see",
      "empty": "Nothing recorded yet for this group.",
      "no_colours": "No factory colours recorded yet."
    },
    "rows": {
      "engine": "Engine",
      "compression": "Compression ratio",
      "carburation": "Carburation",
      "power": "Power",
      "torque": "Torque",
      "final_drive": "Final drive",
      "wheels": "Wheels",
      "tyres": "Tyres",
      "kerb_weight": "Kerb weight",
      "top_speed": "Top speed",
      "production_run": "Production run",
      "units_built": "Units built",
      "edition_size": "Edition size",
      "market": "Home market",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Decode an engine",
      "cr_calculator": "Check in CR calculator",
      "needles": "Needle charts",
      "wheel_library": "In Wheel Library",
      "weights": "Weights archive",
      "chassis_decoder": "Decode yours",
      "colour_archive": "Find {name} in the colour archive"
    },
    "registry": {
      "title": "Owners' registry",
      "body": "Own one? Add your car to the register so this model page links to the cars still on the road.",
      "cta": "I own one →"
    },
    "sources": {
      "accessed": "Accessed {date}",
      "note": "Every value on this page is cited. Spot an error? Suggest a fix with your source."
    },
    "bot": {
      "body": "This page feeds the DIY bot — ask it anything about this model in",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Saloon",
        "estate": "Estate",
        "van": "Van",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    },
    "seo": {
      "title": "{name} ({years}): Specs, Production & Colours",
      "description": "{name} {years} factory specifications: {specs}. Engine, power, torque, gearing, wheels, tyres, weight, top speed, production numbers and factory colours from the Classic Mini DIY archive.",
      "keywords": "{name}, Classic Mini specs, Mini production numbers, Mini factory colours, Mini model history",
      "built": "{n} built"
    }
  },
  "es": {
    "hero_title": "Variantes del Classic Mini",
    "breadcrumb_subpage": "Variantes de modelo",
    "back": "Todas las variantes",
    "meta": {
      "built": "{n} fabricados",
      "limited": "Edición limitada",
      "preserved": "Preservado",
      "specs_sourced": "{n} de {total} datos con fuente"
    },
    "actions": {
      "submit_update": "Enviar una actualización",
      "suggest_fix": "Sugerir una corrección",
      "add_photos": "+ Añadir fotos"
    },
    "photos": {
      "gap_title": "Aún sin fotos — añade las tuyas",
      "gap_body": "Escaneos de folletos, fotos de época o tu propio coche. Se revisan antes de publicarse y se te acreditan."
    },
    "sections": {
      "engine": "Motor",
      "drivetrain": "Transmisión, llantas y peso",
      "production": "Producción y mercado",
      "colours": "Colores de fábrica",
      "sources": "Fuentes",
      "related": "Ver también",
      "empty": "Todavía no hay datos en este grupo.",
      "no_colours": "Todavía no hay colores de fábrica registrados."
    },
    "rows": {
      "engine": "Motor",
      "compression": "Relación de compresión",
      "carburation": "Carburación",
      "power": "Potencia",
      "torque": "Par",
      "final_drive": "Relación final",
      "wheels": "Llantas",
      "tyres": "Neumáticos",
      "kerb_weight": "Peso en vacío",
      "top_speed": "Velocidad máxima",
      "production_run": "Periodo de producción",
      "units_built": "Unidades fabricadas",
      "edition_size": "Tirada de la edición",
      "market": "Mercado de origen",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Decodificar un motor",
      "cr_calculator": "Comprobar en la calculadora de RC",
      "needles": "Tablas de agujas",
      "wheel_library": "En la biblioteca de llantas",
      "weights": "Archivo de pesos",
      "chassis_decoder": "Decodifica el tuyo",
      "colour_archive": "Buscar {name} en el archivo de colores"
    },
    "registry": {
      "title": "Registro de propietarios",
      "body": "¿Tienes uno? Añade tu coche al registro para que esta página enlace con los coches que siguen en la carretera.",
      "cta": "Tengo uno →"
    },
    "sources": {
      "accessed": "Consultado el {date}",
      "note": "Cada valor de esta página está citado. ¿Ves un error? Sugiere una corrección con tu fuente."
    },
    "bot": {
      "body": "Esta página alimenta al bot DIY — pregúntale lo que quieras sobre este modelo en",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Familiar",
        "van": "Furgoneta",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabrio"
      }
    },
    "seo": {
      "title": "{name} ({years}): Especificaciones, producción y colores",
      "description": "Especificaciones de fábrica del {name} {years}: {specs}. Motor, potencia, par, desarrollo, llantas, neumáticos, peso, velocidad máxima, producción y colores de fábrica del archivo Classic Mini DIY.",
      "keywords": "{name}, especificaciones Classic Mini, producción Mini, colores de fábrica Mini, historia de modelos Mini",
      "built": "{n} fabricados"
    }
  },
  "fr": {
    "hero_title": "Variantes de la Classic Mini",
    "breadcrumb_subpage": "Variantes de modèle",
    "back": "Toutes les variantes",
    "meta": {
      "built": "{n} produits",
      "limited": "Série limitée",
      "preserved": "Préservé",
      "specs_sourced": "{n} données sur {total} sourcées"
    },
    "actions": {
      "submit_update": "Proposer une mise à jour",
      "suggest_fix": "Proposer une correction",
      "add_photos": "+ Ajouter des photos"
    },
    "photos": {
      "gap_title": "Pas encore de photos — ajoutez les vôtres",
      "gap_body": "Scans de brochures, photos d'époque ou votre propre voiture. Relues avant publication, créditées à votre nom."
    },
    "sections": {
      "engine": "Moteur",
      "drivetrain": "Transmission, jantes et poids",
      "production": "Production et marché",
      "colours": "Couleurs d'usine",
      "sources": "Sources",
      "related": "Voir aussi",
      "empty": "Rien d'enregistré pour ce groupe pour l'instant.",
      "no_colours": "Aucune couleur d'usine enregistrée pour l'instant."
    },
    "rows": {
      "engine": "Moteur",
      "compression": "Taux de compression",
      "carburation": "Alimentation",
      "power": "Puissance",
      "torque": "Couple",
      "final_drive": "Rapport de pont",
      "wheels": "Jantes",
      "tyres": "Pneus",
      "kerb_weight": "Poids à vide",
      "top_speed": "Vitesse maxi",
      "production_run": "Période de production",
      "units_built": "Exemplaires produits",
      "edition_size": "Taille de la série",
      "market": "Marché d'origine",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Décoder un moteur",
      "cr_calculator": "Vérifier dans le calculateur de taux",
      "needles": "Tables d'aiguilles",
      "wheel_library": "Dans la bibliothèque de jantes",
      "weights": "Archive des poids",
      "chassis_decoder": "Décodez le vôtre",
      "colour_archive": "Chercher {name} dans l'archive des couleurs"
    },
    "registry": {
      "title": "Registre des propriétaires",
      "body": "Vous en possédez une ? Ajoutez votre voiture au registre pour que cette page renvoie aux exemplaires encore sur la route.",
      "cta": "J'en ai une →"
    },
    "sources": {
      "accessed": "Consulté le {date}",
      "note": "Chaque valeur de cette page est sourcée. Une erreur ? Proposez une correction avec votre source."
    },
    "bot": {
      "body": "Cette page alimente le bot DIY — posez-lui vos questions sur ce modèle dans le",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Berline",
        "estate": "Break",
        "van": "Fourgonnette",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    },
    "seo": {
      "title": "{name} ({years}) : fiche technique, production et couleurs",
      "description": "Fiche technique d'usine de la {name} {years} : {specs}. Moteur, puissance, couple, pont, jantes, pneus, poids, vitesse maxi, production et couleurs d'usine, depuis l'archive Classic Mini DIY.",
      "keywords": "{name}, fiche technique Classic Mini, production Mini, couleurs d'usine Mini, histoire des modèles Mini",
      "built": "{n} produits"
    }
  },
  "de": {
    "hero_title": "Classic Mini Modellvarianten",
    "breadcrumb_subpage": "Modellvarianten",
    "back": "Alle Modellvarianten",
    "meta": {
      "built": "{n} gebaut",
      "limited": "Sondermodell",
      "preserved": "Bewahrt",
      "specs_sourced": "{n} von {total} Werten belegt"
    },
    "actions": {
      "submit_update": "Aktualisierung einreichen",
      "suggest_fix": "Korrektur vorschlagen",
      "add_photos": "+ Fotos hinzufügen"
    },
    "photos": {
      "gap_title": "Noch keine Fotos — fügen Sie Ihre hinzu",
      "gap_body": "Prospektscans, zeitgenössische Fotos oder Ihr eigenes Auto. Vor der Veröffentlichung geprüft und Ihnen gutgeschrieben."
    },
    "sections": {
      "engine": "Motor",
      "drivetrain": "Antrieb, Räder und Gewicht",
      "production": "Produktion und Markt",
      "colours": "Werksfarben",
      "sources": "Quellen",
      "related": "Siehe auch",
      "empty": "Für diese Gruppe ist noch nichts erfasst.",
      "no_colours": "Noch keine Werksfarben erfasst."
    },
    "rows": {
      "engine": "Motor",
      "compression": "Verdichtung",
      "carburation": "Gemischaufbereitung",
      "power": "Leistung",
      "torque": "Drehmoment",
      "final_drive": "Achsübersetzung",
      "wheels": "Räder",
      "tyres": "Reifen",
      "kerb_weight": "Leergewicht",
      "top_speed": "Höchstgeschwindigkeit",
      "production_run": "Bauzeit",
      "units_built": "Stückzahl",
      "edition_size": "Auflage",
      "market": "Heimatmarkt",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Motor entschlüsseln",
      "cr_calculator": "Im Verdichtungsrechner prüfen",
      "needles": "Nadeltabellen",
      "wheel_library": "In der Rad-Bibliothek",
      "weights": "Gewichtsarchiv",
      "chassis_decoder": "Ihre entschlüsseln",
      "colour_archive": "{name} im Farbarchiv suchen"
    },
    "registry": {
      "title": "Besitzerregister",
      "body": "Besitzen Sie einen? Tragen Sie Ihr Auto ins Register ein, damit diese Modellseite auf die noch fahrenden Exemplare verweist.",
      "cta": "Ich habe einen →"
    },
    "sources": {
      "accessed": "Abgerufen am {date}",
      "note": "Jeder Wert auf dieser Seite ist belegt. Fehler entdeckt? Schlagen Sie eine Korrektur mit Ihrer Quelle vor."
    },
    "bot": {
      "body": "Diese Seite speist den DIY-Bot — fragen Sie ihn alles zu diesem Modell im",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Limousine",
        "estate": "Kombi",
        "van": "Kastenwagen",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    },
    "seo": {
      "title": "{name} ({years}): Technische Daten, Produktion und Farben",
      "description": "Werksdaten des {name} {years}: {specs}. Motor, Leistung, Drehmoment, Übersetzung, Räder, Reifen, Gewicht, Höchstgeschwindigkeit, Stückzahlen und Werksfarben aus dem Classic Mini DIY Archiv.",
      "keywords": "{name}, Classic Mini technische Daten, Mini Stückzahlen, Mini Werksfarben, Mini Modellgeschichte",
      "built": "{n} gebaut"
    }
  },
  "it": {
    "hero_title": "Varianti della Classic Mini",
    "breadcrumb_subpage": "Varianti di modello",
    "back": "Tutte le varianti",
    "meta": {
      "built": "{n} prodotte",
      "limited": "Edizione limitata",
      "preserved": "Preservato",
      "specs_sourced": "{n} dati su {total} con fonte"
    },
    "actions": {
      "submit_update": "Invia un aggiornamento",
      "suggest_fix": "Suggerisci una correzione",
      "add_photos": "+ Aggiungi foto"
    },
    "photos": {
      "gap_title": "Ancora nessuna foto — aggiungi le tue",
      "gap_body": "Scansioni di depliant, foto d'epoca o la tua auto. Revisionate prima della pubblicazione e accreditate a te."
    },
    "sections": {
      "engine": "Motore",
      "drivetrain": "Trasmissione, cerchi e peso",
      "production": "Produzione e mercato",
      "colours": "Colori di fabbrica",
      "sources": "Fonti",
      "related": "Vedi anche",
      "empty": "Nessun dato registrato per questo gruppo.",
      "no_colours": "Nessun colore di fabbrica registrato."
    },
    "rows": {
      "engine": "Motore",
      "compression": "Rapporto di compressione",
      "carburation": "Alimentazione",
      "power": "Potenza",
      "torque": "Coppia",
      "final_drive": "Rapporto al ponte",
      "wheels": "Cerchi",
      "tyres": "Pneumatici",
      "kerb_weight": "Peso a vuoto",
      "top_speed": "Velocità massima",
      "production_run": "Periodo di produzione",
      "units_built": "Esemplari prodotti",
      "edition_size": "Tiratura",
      "market": "Mercato di origine",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Decodifica un motore",
      "cr_calculator": "Verifica nel calcolatore RC",
      "needles": "Tabelle spilli",
      "wheel_library": "Nella libreria cerchi",
      "weights": "Archivio pesi",
      "chassis_decoder": "Decodifica il tuo",
      "colour_archive": "Cerca {name} nell'archivio colori"
    },
    "registry": {
      "title": "Registro proprietari",
      "body": "Ne possiedi una? Aggiungi la tua auto al registro così questa pagina rimanda alle auto ancora in circolazione.",
      "cta": "Ne ho una →"
    },
    "sources": {
      "accessed": "Consultato il {date}",
      "note": "Ogni valore in questa pagina è citato. Hai notato un errore? Suggerisci una correzione con la tua fonte."
    },
    "bot": {
      "body": "Questa pagina alimenta il bot DIY — chiedigli qualsiasi cosa su questo modello in",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Giardinetta",
        "van": "Furgone",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    },
    "seo": {
      "title": "{name} ({years}): scheda tecnica, produzione e colori",
      "description": "Scheda tecnica di fabbrica della {name} {years}: {specs}. Motore, potenza, coppia, rapporti, cerchi, pneumatici, peso, velocità massima, produzione e colori di fabbrica dall'archivio Classic Mini DIY.",
      "keywords": "{name}, scheda tecnica Classic Mini, produzione Mini, colori di fabbrica Mini, storia dei modelli Mini",
      "built": "{n} prodotte"
    }
  },
  "pt": {
    "hero_title": "Variantes do Classic Mini",
    "breadcrumb_subpage": "Variantes de modelo",
    "back": "Todas as variantes",
    "meta": {
      "built": "{n} produzidos",
      "limited": "Edição limitada",
      "preserved": "Preservado",
      "specs_sourced": "{n} de {total} dados com fonte"
    },
    "actions": {
      "submit_update": "Enviar uma atualização",
      "suggest_fix": "Sugerir uma correção",
      "add_photos": "+ Adicionar fotos"
    },
    "photos": {
      "gap_title": "Ainda sem fotos — adicione as suas",
      "gap_body": "Digitalizações de folhetos, fotos de época ou o seu próprio carro. Revistas antes de publicar e creditadas a si."
    },
    "sections": {
      "engine": "Motor",
      "drivetrain": "Transmissão, jantes e peso",
      "production": "Produção e mercado",
      "colours": "Cores de fábrica",
      "sources": "Fontes",
      "related": "Ver também",
      "empty": "Ainda nada registado para este grupo.",
      "no_colours": "Ainda sem cores de fábrica registadas."
    },
    "rows": {
      "engine": "Motor",
      "compression": "Taxa de compressão",
      "carburation": "Carburação",
      "power": "Potência",
      "torque": "Binário",
      "final_drive": "Relação final",
      "wheels": "Jantes",
      "tyres": "Pneus",
      "kerb_weight": "Peso em ordem de marcha",
      "top_speed": "Velocidade máxima",
      "production_run": "Período de produção",
      "units_built": "Unidades produzidas",
      "edition_size": "Tiragem",
      "market": "Mercado de origem",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Descodificar um motor",
      "cr_calculator": "Verificar na calculadora de TC",
      "needles": "Tabelas de agulhas",
      "wheel_library": "Na biblioteca de jantes",
      "weights": "Arquivo de pesos",
      "chassis_decoder": "Descodifique o seu",
      "colour_archive": "Procurar {name} no arquivo de cores"
    },
    "registry": {
      "title": "Registo de proprietários",
      "body": "Tem um? Adicione o seu carro ao registo para que esta página ligue aos carros ainda em circulação.",
      "cta": "Tenho um →"
    },
    "sources": {
      "accessed": "Consultado em {date}",
      "note": "Todos os valores desta página têm fonte. Viu um erro? Sugira uma correção com a sua fonte."
    },
    "bot": {
      "body": "Esta página alimenta o bot DIY — pergunte-lhe o que quiser sobre este modelo no",
      "link": "Chat."
    },
    "labels": {
      "body": {
        "saloon": "Berlina",
        "estate": "Carrinha",
        "van": "Furgão",
        "pickup": "Pick-up",
        "moke": "Moke",
        "cabriolet": "Cabriolet"
      }
    },
    "seo": {
      "title": "{name} ({years}): especificações, produção e cores",
      "description": "Especificações de fábrica do {name} {years}: {specs}. Motor, potência, binário, relações, jantes, pneus, peso, velocidade máxima, produção e cores de fábrica do arquivo Classic Mini DIY.",
      "keywords": "{name}, especificações Classic Mini, produção Mini, cores de fábrica Mini, história dos modelos Mini",
      "built": "{n} produzidos"
    }
  },
  "ru": {
    "hero_title": "Модификации Classic Mini",
    "breadcrumb_subpage": "Модификации",
    "back": "Все модификации",
    "meta": {
      "built": "Выпущено: {n}",
      "limited": "Лимитированная серия",
      "preserved": "Сохранено",
      "specs_sourced": "{n} из {total} параметров с источником"
    },
    "actions": {
      "submit_update": "Предложить обновление",
      "suggest_fix": "Предложить исправление",
      "add_photos": "+ Добавить фото"
    },
    "photos": {
      "gap_title": "Фото пока нет — добавьте свои",
      "gap_body": "Сканы брошюр, фото эпохи или ваш автомобиль. Проверяются перед публикацией и указываются с вашим именем."
    },
    "sections": {
      "engine": "Двигатель",
      "drivetrain": "Трансмиссия, колёса и масса",
      "production": "Производство и рынок",
      "colours": "Заводские цвета",
      "sources": "Источники",
      "related": "См. также",
      "empty": "Для этой группы пока ничего не записано.",
      "no_colours": "Заводские цвета пока не записаны."
    },
    "rows": {
      "engine": "Двигатель",
      "compression": "Степень сжатия",
      "carburation": "Питание",
      "power": "Мощность",
      "torque": "Крутящий момент",
      "final_drive": "Главная передача",
      "wheels": "Колёса",
      "tyres": "Шины",
      "kerb_weight": "Снаряжённая масса",
      "top_speed": "Максимальная скорость",
      "production_run": "Годы выпуска",
      "units_built": "Выпущено",
      "edition_size": "Тираж серии",
      "market": "Домашний рынок",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "Расшифровать двигатель",
      "cr_calculator": "Проверить в калькуляторе СЖ",
      "needles": "Таблицы игл",
      "wheel_library": "В библиотеке колёс",
      "weights": "Архив масс",
      "chassis_decoder": "Расшифруйте свой",
      "colour_archive": "Найти {name} в архиве цветов"
    },
    "registry": {
      "title": "Реестр владельцев",
      "body": "У вас есть такой? Добавьте машину в реестр, чтобы эта страница ссылалась на автомобили, которые ещё на ходу.",
      "cta": "У меня есть →"
    },
    "sources": {
      "accessed": "Дата обращения: {date}",
      "note": "Каждое значение на этой странице подтверждено источником. Заметили ошибку? Предложите исправление со своим источником."
    },
    "bot": {
      "body": "Эта страница питает DIY-бота — спросите его о чём угодно про эту модель в",
      "link": "чате."
    },
    "labels": {
      "body": {
        "saloon": "Седан",
        "estate": "Универсал",
        "van": "Фургон",
        "pickup": "Пикап",
        "moke": "Moke",
        "cabriolet": "Кабриолет"
      }
    },
    "seo": {
      "title": "{name} ({years}): характеристики, тираж и цвета",
      "description": "Заводские характеристики {name} {years}: {specs}. Двигатель, мощность, момент, передачи, колёса, шины, масса, максимальная скорость, тираж и заводские цвета из архива Classic Mini DIY.",
      "keywords": "{name}, характеристики Classic Mini, тираж Mini, заводские цвета Mini, история моделей Mini",
      "built": "выпущено {n}"
    }
  },
  "ja": {
    "hero_title": "クラシックMiniモデルバリエーション",
    "breadcrumb_subpage": "モデルバリエーション",
    "back": "すべてのバリエーション",
    "meta": {
      "built": "{n}台生産",
      "limited": "限定車",
      "preserved": "保存済み",
      "specs_sourced": "{total}項目中{n}項目に出典あり"
    },
    "actions": {
      "submit_update": "更新を投稿",
      "suggest_fix": "修正を提案",
      "add_photos": "+ 写真を追加"
    },
    "photos": {
      "gap_title": "写真はまだありません — 追加してください",
      "gap_body": "カタログのスキャン、当時の写真、ご自身の車。公開前に審査され、あなたの名前で記載されます。"
    },
    "sections": {
      "engine": "エンジン",
      "drivetrain": "駆動系・ホイール・重量",
      "production": "生産と市場",
      "colours": "工場カラー",
      "sources": "出典",
      "related": "関連モデル",
      "empty": "このグループにはまだ記録がありません。",
      "no_colours": "工場カラーはまだ記録されていません。"
    },
    "rows": {
      "engine": "エンジン",
      "compression": "圧縮比",
      "carburation": "燃料供給",
      "power": "出力",
      "torque": "トルク",
      "final_drive": "ファイナルギア比",
      "wheels": "ホイール",
      "tyres": "タイヤ",
      "kerb_weight": "車両重量",
      "top_speed": "最高速度",
      "production_run": "生産期間",
      "units_built": "生産台数",
      "edition_size": "限定台数",
      "market": "本国市場",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "エンジン番号を解読",
      "cr_calculator": "圧縮比計算機で確認",
      "needles": "ニードル表",
      "wheel_library": "ホイールライブラリで見る",
      "weights": "重量アーカイブ",
      "chassis_decoder": "自分の車を解読",
      "colour_archive": "カラーアーカイブで{name}を探す"
    },
    "registry": {
      "title": "オーナー登録",
      "body": "お持ちですか？レジストリに登録すると、このモデルページから現役の車両にリンクされます。",
      "cta": "持っています →"
    },
    "sources": {
      "accessed": "閲覧日 {date}",
      "note": "このページのすべての値に出典があります。誤りを見つけたら、出典とともに修正を提案してください。"
    },
    "bot": {
      "body": "このページはDIYボットの情報源です — このモデルについて何でも質問できます：",
      "link": "チャット"
    },
    "labels": {
      "body": {
        "saloon": "サルーン",
        "estate": "エステート",
        "van": "バン",
        "pickup": "ピックアップ",
        "moke": "モーク",
        "cabriolet": "カブリオレ"
      }
    },
    "seo": {
      "title": "{name}（{years}）：スペック・生産台数・カラー",
      "description": "{name} {years}の工場スペック：{specs}。エンジン、出力、トルク、ギア比、ホイール、タイヤ、重量、最高速度、生産台数、工場カラーをClassic Mini DIYアーカイブから。",
      "keywords": "{name}, クラシックMini スペック, Mini 生産台数, Mini 工場カラー, Mini モデル史",
      "built": "{n}台生産"
    }
  },
  "zh": {
    "hero_title": "经典Mini车型变体",
    "breadcrumb_subpage": "车型变体",
    "back": "所有车型变体",
    "meta": {
      "built": "生产{n}辆",
      "limited": "限量版",
      "preserved": "已保存",
      "specs_sourced": "{total}项参数中{n}项有来源"
    },
    "actions": {
      "submit_update": "提交更新",
      "suggest_fix": "建议修正",
      "add_photos": "+ 添加照片"
    },
    "photos": {
      "gap_title": "暂无照片 — 添加你的",
      "gap_body": "宣传册扫描、当年的照片或你自己的车。发布前经过审核，并署上你的名字。"
    },
    "sections": {
      "engine": "发动机",
      "drivetrain": "传动、车轮与重量",
      "production": "生产与市场",
      "colours": "原厂颜色",
      "sources": "来源",
      "related": "另请参阅",
      "empty": "该组暂无记录。",
      "no_colours": "暂无原厂颜色记录。"
    },
    "rows": {
      "engine": "发动机",
      "compression": "压缩比",
      "carburation": "供油方式",
      "power": "功率",
      "torque": "扭矩",
      "final_drive": "主减速比",
      "wheels": "车轮",
      "tyres": "轮胎",
      "kerb_weight": "整备质量",
      "top_speed": "最高时速",
      "production_run": "生产年份",
      "units_built": "生产数量",
      "edition_size": "限量数量",
      "market": "本土市场",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "解码发动机",
      "cr_calculator": "在压缩比计算器中核对",
      "needles": "油针表",
      "wheel_library": "在车轮库中查看",
      "weights": "重量档案",
      "chassis_decoder": "解码你的车",
      "colour_archive": "在颜色档案中查找{name}"
    },
    "registry": {
      "title": "车主登记",
      "body": "拥有一辆？把你的车加入登记册，让本页链接到仍在路上的车。",
      "cta": "我有一辆 →"
    },
    "sources": {
      "accessed": "访问日期 {date}",
      "note": "本页每个数值均有引用。发现错误？请附来源建议修正。"
    },
    "bot": {
      "body": "本页为DIY机器人提供数据 — 在此处询问关于该车型的任何问题：",
      "link": "聊天"
    },
    "labels": {
      "body": {
        "saloon": "轿车",
        "estate": "旅行车",
        "van": "厢式车",
        "pickup": "皮卡",
        "moke": "Moke",
        "cabriolet": "敞篷车"
      }
    },
    "seo": {
      "title": "{name}（{years}）：参数、产量与颜色",
      "description": "{name} {years}原厂参数：{specs}。来自Classic Mini DIY档案的发动机、功率、扭矩、齿比、车轮、轮胎、重量、最高时速、产量和原厂颜色。",
      "keywords": "{name}, 经典Mini参数, Mini产量, Mini原厂颜色, Mini车型历史",
      "built": "生产{n}辆"
    }
  },
  "ko": {
    "hero_title": "클래식 Mini 모델 변형",
    "breadcrumb_subpage": "모델 변형",
    "back": "모든 모델 변형",
    "meta": {
      "built": "{n}대 생산",
      "limited": "한정판",
      "preserved": "보존됨",
      "specs_sourced": "{total}개 중 {n}개 제원에 출처 있음"
    },
    "actions": {
      "submit_update": "업데이트 제출",
      "suggest_fix": "수정 제안",
      "add_photos": "+ 사진 추가"
    },
    "photos": {
      "gap_title": "아직 사진 없음 — 추가해 주세요",
      "gap_body": "카탈로그 스캔, 당시 사진 또는 본인 차량. 게시 전 검토되며 여러분의 이름으로 표시됩니다."
    },
    "sections": {
      "engine": "엔진",
      "drivetrain": "구동계, 휠 및 중량",
      "production": "생산 및 시장",
      "colours": "공장 색상",
      "sources": "출처",
      "related": "함께 보기",
      "empty": "이 그룹에는 아직 기록이 없습니다.",
      "no_colours": "아직 기록된 공장 색상이 없습니다."
    },
    "rows": {
      "engine": "엔진",
      "compression": "압축비",
      "carburation": "연료 공급",
      "power": "출력",
      "torque": "토크",
      "final_drive": "종감속비",
      "wheels": "휠",
      "tyres": "타이어",
      "kerb_weight": "공차 중량",
      "top_speed": "최고 속도",
      "production_run": "생산 기간",
      "units_built": "생산 대수",
      "edition_size": "한정 수량",
      "market": "본국 시장",
      "mark": "Mark"
    },
    "links": {
      "engine_decoder": "엔진 번호 해독",
      "cr_calculator": "압축비 계산기에서 확인",
      "needles": "니들 차트",
      "wheel_library": "휠 라이브러리에서 보기",
      "weights": "중량 아카이브",
      "chassis_decoder": "내 차 해독하기",
      "colour_archive": "색상 아카이브에서 {name} 찾기"
    },
    "registry": {
      "title": "오너 등록부",
      "body": "보유하고 계신가요? 등록부에 차량을 추가하면 이 모델 페이지가 아직 달리고 있는 차량들과 연결됩니다.",
      "cta": "보유 중입니다 →"
    },
    "sources": {
      "accessed": "접근일 {date}",
      "note": "이 페이지의 모든 값에는 출처가 있습니다. 오류를 발견하셨나요? 출처와 함께 수정을 제안해 주세요."
    },
    "bot": {
      "body": "이 페이지는 DIY 봇의 데이터 소스입니다 — 이 모델에 대해 무엇이든 물어보세요:",
      "link": "채팅"
    },
    "labels": {
      "body": {
        "saloon": "살룬",
        "estate": "에스테이트",
        "van": "밴",
        "pickup": "픽업",
        "moke": "Moke",
        "cabriolet": "카브리올레"
      }
    },
    "seo": {
      "title": "{name} ({years}): 제원, 생산 대수 및 색상",
      "description": "{name} {years} 공장 제원: {specs}. Classic Mini DIY 아카이브의 엔진, 출력, 토크, 기어비, 휠, 타이어, 중량, 최고 속도, 생산 대수 및 공장 색상.",
      "keywords": "{name}, 클래식 Mini 제원, Mini 생산 대수, Mini 공장 색상, Mini 모델 역사",
      "built": "{n}대 생산"
    }
  }
}
</i18n>
