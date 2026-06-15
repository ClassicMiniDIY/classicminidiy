import tailwindcss from '@tailwindcss/vite';
import { ArchiveItems, ToolboxItems } from './data/models/generic';
import { AI_ANSWER_BOTS, AI_TRAINING_BOTS, PRIVATE_DISALLOW } from './server/utils/aiBots';

const parsedArchive = ArchiveItems.map((item) => {
  return { title: item.title, description: item.description, href: `https://www.classicminidiy.com${item.to}` };
});
const parsedToolbox = ToolboxItems.map((item) => {
  return { title: item.titleKey, description: item.titleKey, href: `https://www.classicminidiy.com${item.to}` };
});

export default defineNuxtConfig({
  /*
   ** Headers of the page
   */
  ssr: true,
  app: {
    head: {
      title: 'Classic Mini DIY',
      htmlAttrs: {
        lang: 'en',
        prefix: 'og: https://ogp.me/ns#',
        'data-theme': 'cmdiy',
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com',
        },
        // Open Graph metadata for better social sharing
        {
          property: 'og:title',
          content: 'Classic Mini DIY',
        },
        {
          property: 'og:description',
          content: 'Technical information, tools, and resources for Classic Mini owners and enthusiasts.',
        },
        {
          property: 'og:type',
          content: 'website',
        },
        {
          property: 'og:url',
          content: 'https://www.classicminidiy.com',
        },
        {
          property: 'og:image',
          content: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
        },
        // Twitter Card metadata
        {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          name: 'twitter:title',
          content: 'Classic Mini DIY',
        },
        {
          name: 'twitter:description',
          content: 'Technical information, tools, and resources for Classic Mini owners and enthusiasts.',
        },
        {
          name: 'twitter:image',
          content: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
        },
        // Facebook metadata
        {
          property: 'fb:pages',
          content: '615159745295369',
        },
        {
          name: 'facebook-domain-verification',
          content: 'hiuvhh3rwnxby3zewibo4t94tapz6u',
        },
        // Additional SEO metadata
        {
          name: 'theme-color',
          content: '#ffffff',
        },
        // Mobile optimization
        {
          name: 'apple-mobile-web-app-capable',
          content: 'yes',
        },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
        // NOTE: the `robots` meta is now emitted by @nuxtjs/robots, whose default
        // `robotsEnabledValue` is already
        // `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`
        // (identical to the old static tag). Per-route noindex is handled by the
        // module + page-level useSeoMeta. Don't re-add a static one here (duplicates).
        {
          name: 'keywords',
          content:
            'classic mini, mini cooper, mini restoration, car repair, DIY, automotive, classic cars, british cars, mini parts',
        },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/png',
          href: '/favicon-32x32.png',
          sizes: '32x32',
        },
        {
          rel: 'icon',
          type: 'image/png',
          href: '/favicon-16x16.png',
          sizes: '16x16',
        },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // Performance optimizations for resource loading
        { rel: 'preconnect', href: 'https://use.typekit.net', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://use.typekit.net' },
        { rel: 'preconnect', href: 'https://classicminidiy.s3.us-east-1.amazonaws.com', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://classicminidiy.s3.us-east-1.amazonaws.com' },
        { rel: 'preconnect', href: 'https://kit.fontawesome.com', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://kit.fontawesome.com' },
        { rel: 'preconnect', href: 'https://ka-f.fontawesome.com', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://ka-f.fontawesome.com' },
        { rel: 'preconnect', href: 'https://us-assets.i.posthog.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://use.typekit.net/fgm1hlg.css',
          media: 'print',
          onload: 'this.media="all"',
        },
        // Canonical is now auto-emitted per-route (self-referencing) by
        // @nuxtjs/seo / nuxt-seo-utils from `site.url` + the current path. The old
        // hardcoded homepage canonical here leaked onto every interior page that
        // didn't override it (~37 pages declared themselves homepage duplicates).
        // hreflang removed: i18n `strategy:'no_prefix'` has one URL per page, so
        // there are no per-locale URLs to point at — the old en/x-default tags both
        // pointed at the bare homepage and signalled nothing. `<html lang>` stays.
      ],
      script: [
        // Set initial theme before hydration to prevent FOUC
        {
          innerHTML: `(function(){try{var t=localStorage.getItem('cmdiy-theme');var d=t==='cmdiy-dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'cmdiy-dark':'cmdiy')}catch(e){document.documentElement.setAttribute('data-theme','cmdiy')}})()`,
          type: 'text/javascript',
          tagPosition: 'head',
        },
        // Disable FA auto-SVG-replace BEFORE the kit loads. Replacing <i>→<svg>
        // during/before Vue hydration produces mismatches that cause Vue to tear
        // down and re-patch the affected subtrees (visible as page "flashing").
        // A client plugin triggers replacement after hydration is complete.
        {
          innerHTML: `window.FontAwesomeConfig={autoReplaceSvg:false,observeMutations:false};`,
          type: 'text/javascript',
          tagPosition: 'head',
        },
        {
          src: 'https://kit.fontawesome.com/4e4435c885.js',
          crossorigin: 'anonymous',
          defer: true,
        },
        // Site-wide WebSite + Organization JSON-LD now lives in the nuxt-schema-org
        // base graph (see app/app.vue → useSchemaOrg). That gives @id-linked nodes
        // and merges a per-route WebPage automatically. The old SearchAction was
        // dropped: it targeted /search?q= which has never existed (404).
      ],
    },
  },

  // Read by nuxt-site-config and consumed across @nuxtjs/seo (sitemap, robots,
  // schema-org, og-image, canonicals). `name` must be the brand (used in the
  // title template + WebSite/Organization schema) — NOT a paragraph.
  site: {
    url: 'https://www.classicminidiy.com',
    name: 'Classic Mini DIY',
    description:
      'One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com',
  },

  // nuxt-link-checker (bundled with @nuxtjs/seo) crawl-checks internal links at
  // build via a prerender:generate hook. It false-positives on the archive DETAIL
  // pages — they're SSR and 500 during build (no Supabase public env), flooding
  // the log with [HEAD] 500s. It's a dev/lint aid, not needed for prod or GEO, so
  // the build-time crawl is off. Re-enable with path excludes if link audit is wanted.
  linkChecker: { enabled: false },

  sitemap: {
    // Dynamic sources for SSR/DB-backed routes the module can't auto-discover:
    // 3D Model Library listings + the archive detail pages (colours, wheels,
    // documents + collections). Each filters to published/approved rows.
    // See server/api/__sitemap__/*.ts.
    sources: [
      '/api/__sitemap__/urls',
      '/api/__sitemap__/colors',
      '/api/__sitemap__/wheels',
      '/api/__sitemap__/documents',
    ],
    xslColumns: [
      { label: 'URL', width: '50%' },
      { label: 'Last Modified', width: '25%' },
      { label: 'Priority', width: '12.5%' },
      { label: 'Change Frequency', width: '12.5%' },
    ],
    defaults: {
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    },
    exclude: [
      '/admin',
      '/admin/registry/review',
      '/admin/wheels/review',
      '/login',
      '/auth/callback',
      '/logout',
      '/readme',
      '/readme-tools',
      '/archive/registry/pending',
      '/contribute/**',
      '/welcome',
      '/profile/**',
      // Transient claim-chain pages (noindex via useHead, which the sitemap
      // module can't see — exclude them here too to avoid mixed signals).
      '/membership/claim',
      '/discord/connect',
    ],
  },

  /*
   ** Global CSS
   */
  // Global CSS files
  css: ['@/assets/css/main.css'],

  // Performance optimization
  experimental: {
    // Enable view transitions for smoother page navigation
    viewTransition: true,
    // Improve performance with component islands
    componentIslands: true,
    // Disable payload extraction to prevent serialization errors with functions
    payloadExtraction: false,
    // Optimize page load with renderJsonPayloads
    renderJsonPayloads: true,
    // Enable async context for server composables (required for MCP tools)
    asyncContext: true,
  },

  /*
   ** Plugins to load before mounting the App
   */
  modules: [
    '@nuxtjs/fontaine',
    '@vite-pwa/nuxt',
    // @nuxtjs/seo umbrella — bundles @nuxtjs/sitemap, @nuxtjs/robots, nuxt-og-image,
    // nuxt-schema-org, nuxt-seo-utils, nuxt-link-checker over shared nuxt-site-config.
    // Do NOT also list those sub-modules here (double-registration / version skew).
    '@nuxtjs/seo',
    '@nuxt/image',
    'nuxt-llms',
    '@nuxtjs/i18n',
    '@nuxtjs/mcp-toolkit',
    '@nuxtjs/turnstile',
    // Vercel BotID — sets up the challenge proxy rewrites. Client init lives in
    // app/plugins/botid.client.ts; server enforcement via checkBotId() in the
    // protected handlers. Only active in production (local dev = always human).
    'botid/nuxt',
  ],

  // @nuxtjs/turnstile auto-populates runtimeConfig.public.turnstile.siteKey.
  // Dev mode uses Cloudflare's always-pass test key by default. In production,
  // set NUXT_PUBLIC_TURNSTILE_SITE_KEY — Nuxt env-overrides the runtimeConfig
  // entry at runtime, so the same build artifact works across Preview and Prod.

  // MCP (Model Context Protocol) Configuration
  mcp: {
    name: 'classic-mini-calculators',
  },

  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'it', name: 'Italian' },
      { code: 'de', name: 'German' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ko', name: 'Korean' },
    ],
    // Keep i18n.config.ts at the project root (legacy layout) rather than the
    // v10 default i18n/ dir, so the vueI18n path resolves without a warning.
    restructureDir: '.',
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  // Image optimization configuration
  image: {
    // Provider options
    provider: 'ipx',
    // Domains allowed for external images
    domains: ['classicminidiy.s3.us-east-1.amazonaws.com', 'psoqirvbujwohemmwplv.supabase.co'],
    // Image formats to generate
    format: ['webp', 'avif', 'jpg', 'png'],
    // Default image quality
    quality: 80,
    // Responsive image sizes
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
  },

  llms: {
    domain: 'https://www.classicminidiy.com',
    title: 'Classic Mini DIY',
    description:
      'One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com',
    // Enables /llms-full.txt (linked from /llms.txt) and lets a Nitro plugin push
    // the generated technical Q&A into it — see server/plugins/llms-faq.ts. This is
    // the legitimate machine-only content surface (not cloaking — it isn't the page).
    full: {
      title: 'Classic Mini DIY — Full Technical Reference',
      description:
        'Answer-first technical reference for the Classic Mini: torque specs, clearances, engine codes, and chassis/VIN decoding.',
    },
    sections: [
      {
        title: 'Archive',
        description:
          'Complete data protected repository of Classic Mini related documents, registries, libraries and more. Secured across multiple cloud locations to provide a permanent home for historical info for the Classic Mini',
        links: parsedArchive,
      },
      {
        title: 'Technical Toolbox',
        description:
          'The classic mini online toolbox, offering detailed information from a range of topics. Anything from torque specs to SU needle comparison can be found right here.',
        links: parsedToolbox,
      },
      {
        title: 'Document Archive',
        description:
          'Unified archive of Classic Mini documentation including workshop manuals, advertisements, catalogues, tuning guides, and electrical diagrams.',
        links: [
          {
            title: 'Workshop Manuals',
            description: 'Factory workshop manuals for Classic Mini',
            href: 'https://www.classicminidiy.com/archive/documents?type=manual',
          },
          {
            title: 'Adverts Archive',
            description: 'Historical Classic Mini advertisements',
            href: 'https://www.classicminidiy.com/archive/documents?type=advert',
          },
          {
            title: 'Tuning Archive',
            description: 'Classic Mini tuning documentation',
            href: 'https://www.classicminidiy.com/archive/documents?type=tuning',
          },
          {
            title: 'Catalogues Archive',
            description: 'Classic Mini vendor catalogues',
            href: 'https://www.classicminidiy.com/archive/documents?type=catalogue',
          },
        ],
      },
      {
        title: '3D Model Library',
        description:
          'Community 3D-printable parts for the Classic Mini — a marketplace of downloadable model files (STL and more) for restoration, repair, and upgrades.',
        links: [
          {
            title: '3D Model Library',
            description: 'Browse all 3D-printable Classic Mini parts',
            href: 'https://www.classicminidiy.com/models',
          },
        ],
      },
    ],
  },

  routeRules: {
    '/': { prerender: true },
    '/about': { prerender: true },
    '/archive': { prerender: true },
    '/archive/engines': { prerender: true },
    '/archive/colors': { prerender: true },
    '/privacy': { prerender: true },
    '/technical/parts': { prerender: true },
    '/technical/torque': { prerender: true },
    '/technical/calculators/needles': { prerender: false },
    '/technical/calculators/gearbox': { prerender: false },
    '/admin/**': { prerender: false },
    // /auth/callback must never be prerendered or CDN-cached: each request
    // carries a single-use ?code= that the page reads on mount. If the page
    // is served from a static file or stale CDN cache, the JS bundle may run
    // with no code in the URL (Supabase 302 → query loss in static handling
    // edge cases, or PWA navigateFallback serving '/' shell).
    '/auth/callback': {
      prerender: false,
      headers: { 'cache-control': 'no-store, must-revalidate' },
    },
    // Same single-use-?code= contract as /auth/callback: the membership claim
    // page and the Discord claim proxy are reached from emailed one-time
    // links. Prerendering/CDN-caching them serves a static copy whose JS can
    // boot with no code in the URL ("That link is missing its claim code"
    // for every recipient — 2026-06-12 incident).
    '/membership/claim': {
      prerender: false,
      headers: { 'cache-control': 'no-store, must-revalidate' },
    },
    '/discord/claim': {
      prerender: false,
      headers: { 'cache-control': 'no-store, must-revalidate' },
    },
    // Session-dependent claim-chain page (self-serve Discord connect for the
    // mobile apps' bare /discord/claim hits) — same no-static treatment.
    '/discord/connect': {
      prerender: false,
      headers: { 'cache-control': 'no-store, must-revalidate' },
    },
    '/archive/manuals': { redirect: { to: '/archive/documents?type=manual', statusCode: 301 } },
    '/archive/adverts': { redirect: { to: '/archive/documents?type=advert', statusCode: 301 } },
    '/archive/catalogues': { redirect: { to: '/archive/documents?type=catalogue', statusCode: 301 } },
    '/archive/tuning': { redirect: { to: '/archive/documents?type=tuning', statusCode: 301 } },
    '/archive/documents/submit': { redirect: { to: '/contribute/document', statusCode: 301 } },
    '/archive/colors/contribute': { redirect: { to: '/contribute/color', statusCode: 301 } },
    '/archive/wheels/submit': { redirect: { to: '/contribute/wheel', statusCode: 301 } },
    '/submissions': { redirect: { to: '/dashboard', statusCode: 301 } },
    '/submissions/**': { redirect: { to: '/dashboard', statusCode: 301 } },
  },

  // AI crawler policy (GEO): allow the live answer/search bots that drive
  // citations + referral traffic; block the bulk training crawlers. UA lists live
  // in server/utils/aiBots.ts (single source of truth). robots is advisory — the
  // training-bot block is additionally enforced at the edge via Vercel WAF (Phase 3).
  // Named groups take precedence over `*`, so standard search engines (Googlebot,
  // Bingbot, …) keep the unchanged `*` rules below.
  robots: {
    sitemap: ['/sitemap.xml'],
    groups: [
      {
        userAgent: [...AI_ANSWER_BOTS],
        allow: ['/'],
        disallow: [...PRIVATE_DISALLOW],
      },
      {
        userAgent: [...AI_TRAINING_BOTS],
        disallow: ['/'],
      },
      {
        userAgent: ['*'],
        disallow: ['/assets/', '/data/', '/server/', '/store/', '/plugins/'],
      },
    ],
  },

  plugins: [
    { src: '~/plugins/highcharts.ts', mode: 'client' },
    { src: '~/plugins/posthog.ts', mode: 'client' },
  ],

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://www.classicminidiy.com',
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.NODE_ENV === 'production' ? '/t' : 'https://us.i.posthog.com',
      posthogUiHost: 'https://us.posthog.com',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
      mapboxAccessToken: process.env.NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
      // Ghost "Pro access to the blog" target for Sustaining Members. Empty
      // until the Substack -> Ghost migration finalizes the URL (web design
      // doc open question 3); the /membership member area hides the link when unset.
      blogUrl: process.env.NUXT_PUBLIC_BLOG_URL || '',
      // Stripe Customer Portal no-code login link for membership self-management.
      // The /membership "Manage membership" button links here (with the member's
      // email pre-filled). Hidden when unset.
      stripePortalUrl: process.env.NUXT_PUBLIC_STRIPE_PORTAL_URL || '',
    },
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    // 3D Model Library private S3 bucket (keystone §5/§10). Dedicated IAM user
    // scoped to `classicminidiy-models` ONLY — never the static-assets creds.
    // Used by server/utils/s3Models.ts for presigned upload POSTs and download
    // GETs. All four values are server-only; never expose in runtimeConfig.public.
    S3_MODELS_BUCKET: process.env.S3_MODELS_BUCKET || '',
    S3_MODELS_REGION: process.env.S3_MODELS_REGION || 'us-east-1',
    S3_MODELS_ACCESS_KEY_ID: process.env.S3_MODELS_ACCESS_KEY_ID || '',
    S3_MODELS_SECRET_ACCESS_KEY: process.env.S3_MODELS_SECRET_ACCESS_KEY || '',
    githubAPIKey: process.env.githubAPIKey,
    GITLAB: process.env.GITLAB,
    youtubeAPIKey: process.env.youtubeAPIKey,
    validation_key: process.env.validation_key,
    NUXT_LANGGRAPH_API_URL: process.env.NUXT_LANGGRAPH_API_URL,
    NUXT_LANGSMITH_API_KEY: process.env.NUXT_LANGSMITH_API_KEY,
    // MCP API Keys — no hardcoded fallback: an unset MCP_API_KEY must resolve to
    // empty so the /mcp middleware fails closed rather than accepting a baked-in
    // default. Set MCP_API_KEY (or MCP_API_KEYS) in .env for local development.
    MCP_API_KEY: process.env.MCP_API_KEY || '',
    MCP_API_KEYS: process.env.MCP_API_KEYS || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
  },

  // Add custom reviver/replacer for functions that can't be serialized
  hooks: {
    'vite:extendConfig': (config) => {
      // Ensure Highcharts is properly handled during SSR
      if (config.optimizeDeps?.include && Array.isArray(config.optimizeDeps.include)) {
        config.optimizeDeps.include.push('highcharts', 'highcharts-vue');
      }
    },
  },

  // Optimize HTML output
  nitro: {
    prerender: {
      crawlLinks: true,
      failOnError: false,
      // The archive DETAIL pages are intentionally SSR (DB-backed, Supabase at
      // runtime) — they're discoverable via the sitemap sources, not prerender.
      // crawlLinks follows the listing pages' links into them; without these
      // ignores the prerenderer 500s on every one (no public Supabase env at
      // build). nitro matches ignore patterns with String.startsWith, so these
      // are PREFIXES (trailing slash) — they catch `/archive/colors/<id>` but not
      // the prerendered index `/archive/colors` itself.
      ignore: [
        '/admin',
        '/raw',
        '/archive/colors/',
        '/archive/wheels/',
        '/archive/documents/',
      ],
      routes: [
        '/',
        '/privacy',
        '/archive',
        '/archive/engines',
        '/archive/colors',
        '/technical/parts',
        '/technical/torque',
      ],
    },
    // Enable compression for better performance
    compressPublicAssets: {
      gzip: true,
      brotli: true,
    },
    // Cache headers for static assets
    routeRules: {
      '/images/**': { headers: { 'cache-control': 'public,max-age=31536000,immutable' } },
      '/fonts/**': { headers: { 'cache-control': 'public,max-age=31536000,immutable' } },
      '/assets/**': { headers: { 'cache-control': 'public,max-age=31536000,immutable' } },
    },
    // Minify responses
    minify: true,
  },

  vite: {
    define: {
      'process.env.DEBUG': false,
    },
    plugins: [tailwindcss()],
    // Pre-optimize dependencies to prevent reloading on route changes
    optimizeDeps: {
      include: [
        'luxon',
        'highcharts',
        'highcharts/highcharts-more',
        'highcharts-vue',
        'highcharts/modules/exporting',
        'highcharts/modules/export-data',
        'highcharts/modules/accessibility',
        'highcharts/modules/offline-exporting',
        'posthog-js',
        '@supabase/supabase-js',
        'marked',
        'marked-highlight',
        'highlight.js',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'fuse.js',
      ],
      exclude: [],
    },
    // Optimize build performance
    build: {
      // Disable sourcemaps in production to avoid Tailwind CSS warnings
      sourcemap: process.env.NODE_ENV !== 'production',
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
        },
      },
      // Split chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Chart libraries (tend to be large)
            highcharts: [
              'highcharts',
              'highcharts/highcharts-more',
              'highcharts-vue',
              'highcharts/modules/exporting',
              'highcharts/modules/export-data',
              'highcharts/modules/accessibility',
            ],

            // Utility libraries
            utilities: ['luxon'],

            // Analytics and tracking
            analytics: ['posthog-js'],
          },
        },
      },
      // Increase chunk size warning limit to reduce noise for intentionally large chunks
      chunkSizeWarningLimit: 600,
    },
    // Optimize dev experience
    server: {
      hmr: {
        overlay: true,
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Classic Mini Toolbox',
      short_name: 'CMDIY Toolbox',
      theme_color: '#ffffff',
      background_color: '#ffffff',
      description: 'Technical information and tools for Classic Mini owners and enthusiasts',
      categories: ['automotive', 'tools', 'reference'],
      lang: 'en',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: 'icon.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'icon.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    selfDestroying: true,
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      // Exclude Highcharts routes from service worker caching
      // to prevent issues with client-side rendering
      // /auth/callback is denylisted so the SW never serves the precached '/'
      // shell when Supabase redirects there with a single-use ?code= — the
      // shell HTML has no callback markup and the URL/code can be lost.
      navigateFallbackDenylist: [
        /\/technical\/calculators\/needles/,
        /\/technical\/calculators\/gearbox/,
        /^\/t\//,
        /^\/auth\/callback/,
        // Single-use emailed claim links — the precached '/' shell must never
        // swallow their ?code=/?token= (see /auth/callback note above).
        /^\/membership\/claim/,
        // Also covers /discord/connect (the session-dependent self-serve page
        // bare app hits redirect to) — keep the whole claim chain SW-free.
        /^\/discord\//,
      ],
      // Customize caching strategies
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/classicminidiy\.s3\.us-east-1\.amazonaws\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 's3-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
        {
          urlPattern: /^https:\/\/psoqirvbujwohemmwplv\.supabase\.co\/storage\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'supabase-storage',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
        {
          urlPattern: /\.(?:js|css)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-resources',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts',
            expiration: {
              maxEntries: 30,
              maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
  },
  compatibilityDate: '2024-08-29',
});
