// TailwindCSS is now handled by @nuxt/ui module
import { ArchiveItems, ToolboxItems } from './data/models/generic';

const parsedArchive = ArchiveItems.map((item) => {
  return { title: item.title, description: item.description, href: `https://classicminidiy.com${item.to}` };
});
const parsedToolbox = ToolboxItems.map((item) => {
  return { title: item.titleKey, description: item.titleKey, href: `https://classicminidiy.com${item.to}` };
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
          content: 'https://classicminidiy.com',
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
        // SEO tags
        {
          name: 'robots',
          content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        },
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
        {
          rel: 'stylesheet',
          href: 'https://use.typekit.net/fgm1hlg.css',
          media: 'print',
          onload: 'this.media="all"',
        },
        // Canonical URL to prevent duplicate content issues
        { rel: 'canonical', href: 'https://classicminidiy.com' },
        // Alternative languages if you add them in the future
        { rel: 'alternate', href: 'https://classicminidiy.com', hreflang: 'x-default' },
        { rel: 'alternate', href: 'https://classicminidiy.com', hreflang: 'en' },
      ],
      script: [
        {
          src: 'https://kit.fontawesome.com/4e4435c885.js',
          crossorigin: 'anonymous',
        },
        // Structured data for better search results
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Classic Mini DIY',
            url: 'https://classicminidiy.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://classicminidiy.com/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        },
        // Organization schema
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Classic Mini DIY',
            url: 'https://classicminidiy.com',
            logo: 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg',
            sameAs: [
              'https://www.youtube.com/c/classicminidiy',
              'https://www.facebook.com/classicminidiy',
              'https://www.instagram.com/classicminidiy/',
            ],
          }),
        },
      ],
    },
  },

  site: {
    url: 'https://classicminidiy.com',
    name: 'One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com',
  },

  sitemap: {
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
      '/logout',
      '/readme',
      '/readme-tools',
      '/archive/registry/pending',
      '/archive/colors/contribute',
      '/archive/wheels/submit',
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
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    '@nuxt/content',
    '@nuxt/image',
    '@nuxt/ui',
    'nuxt-llms',
    ['nuxt-gtag', { id: 'G-FBH0E64HM1' }],
    '@nuxtjs/i18n',
    '@nuxtjs/mcp-toolkit',
  ],

  // Nuxt UI Configuration
  ui: {
    colorMode: true, // Enable dark/light mode
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'],
    },
  },

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
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  content: {
    database: {
      type: 'postgres',
      url: process.env.POSTGRES_POSTGRES_URL || '',
    },
  },

  // Image optimization configuration
  image: {
    // Provider options
    provider: 'ipx',
    // Domains allowed for external images
    domains: ['classicminidiy.s3.us-east-1.amazonaws.com'],
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
    domain: 'https://classicminidiy.com',
    title: 'Classic Mini DIY',
    description:
      'One of the most important parts of Classic Mini DIY is the focus on getting out and working on your own car. So to make this easier for you, I have collected technical information from various sources and consolidated it right here on classicminidiy.com',
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
        title: 'Manuals',
        description:
          'Technical documentation and guides for the classic mini. Currated and organized for easy viewing.',
        contentCollection: 'manuals',
      },
      {
        title: 'Advertisements',
        description:
          'Collection of hisorical advertisements for the classic mini. Currated and organized for easy viewing.',
        contentCollection: 'adverts',
      },
      {
        title: 'Tuning',
        description:
          'Collection of hisorical documents related to Classic Mini tuning and modifications. Currated and organized for easy viewing.',
        contentCollection: 'tuning',
      },
      {
        title: 'Catalogues',
        description:
          'Collection of hisorical documents related to Classic Mini Vendor Catalogues. Currated and organized for easy viewing.',
        contentCollection: 'catalogues',
      },
    ],
  },

  routeRules: {
    '/': { prerender: true },
    '/archive': { prerender: true },
    '/archive/engines': { prerender: true },
    '/archive/colors': { prerender: true },
    '/privacy': { prerender: true },
    '/technical/parts': { prerender: true },
    '/technical/torque': { prerender: true },
    '/technical/calculators/needles': { prerender: false },
    '/technical/calculators/gearbox': { prerender: false },
    '/admin/**': { prerender: false },
  },

  robots: {
    // provide simple disallow rules for all robots `user-agent: *`
    disallow: ['/assets/', '/data/', '/server/', '/store/', '/plugins/'],
    sitemap: ['/sitemap.xml'],
  },

  plugins: [
    { src: '~/plugins/highcharts.ts', mode: 'client' },
    { src: '~/plugins/posthog.ts', mode: 'client' },
  ],

  runtimeConfig: {
    public: {
      s3BaseURL: process.env.s3Base,
      serverlessEndpoint: process.env.serverlessEndpoint,
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://www.classicminidiy.com',
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.NODE_ENV === 'production' ? '/t' : 'https://us.i.posthog.com',
      posthogUiHost: 'https://us.posthog.com',
    },
    githubAPIKey: process.env.githubAPIKey,
    GITLAB: process.env.GITLAB,
    youtubeAPIKey: process.env.youtubeAPIKey,
    dynamo_id: process.env.dynamo_id,
    dynamo_key: process.env.dynamo_key,
    s3_id: process.env.s3_id,
    s3_key: process.env.s3_key,
    validation_key: process.env.validation_key,
    CMDIY_NAMEPSACE: process.env.CMDIY_NAMEPSACE,
    POSTGRES_POSTGRES_URL: process.env.POSTGRES_URL || '',
    NUXT_LANGGRAPH_API_URL: process.env.NUXT_LANGGRAPH_API_URL,
    NUXT_LANGSMITH_API_KEY: process.env.NUXT_LANGSMITH_API_KEY,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    // MCP API Keys
    MCP_API_KEY: process.env.MCP_API_KEY || 'dev-mcp-key-classic-mini-diy',
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
      ignore: ['/admin', '/admin/**', '/raw', '/raw/**'],
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
    plugins: [],
    // Pre-optimize dependencies to prevent reloading on route changes
    optimizeDeps: {
      include: [
        'luxon',
        'lodash',
        '@vercel/analytics',
        'highcharts',
        'highcharts-vue',
        'highcharts/modules/exporting',
        'highcharts/modules/export-data',
        'highcharts/modules/accessibility',
        'posthog-js',
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
              'highcharts-vue',
              'highcharts/modules/exporting',
              'highcharts/modules/export-data',
              'highcharts/modules/accessibility',
            ],

            // Utility libraries
            utilities: ['luxon', 'lodash'],

            // Analytics and tracking
            analytics: ['@vercel/analytics', 'posthog-js'],
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
      navigateFallbackDenylist: [/\/technical\/calculators\/needles/, /\/technical\/calculators\/gearbox/, /^\/t\//],
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
