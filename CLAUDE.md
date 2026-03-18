# CLAUDE.md

This file provides guidance to Claude Code when working with the Classic Mini DIY project.

## CMDIY Ecosystem Context

This repo is part of the Classic Mini DIY property ecosystem. See `/Users/colegentry/Development/CLAUDE.md` for the full cross-repo architecture. Key related repos:
- **classicminidiy-supabase** — Shared Supabase backend (PostgreSQL, Auth, Edge Functions, RLS)
- **TheMiniExchange** — Classic Mini marketplace (Nuxt 4, daisyUI, Stripe)
- **Native CMDIY Apps** — iOS (Swift) and Android (Kotlin) mobile apps

This site shares the Supabase auth and profiles with the other properties. Database schema lives in `classicminidiy-supabase`.

## Project Overview

**Classic Mini DIY** is a comprehensive web application serving as both a toolkit and permanent archive for Classic Mini enthusiasts. It provides technical information, calculators, historical documents, and interactive tools for Classic Mini owners and mechanics.

- **Framework**: Nuxt 4.1.2 (Vue.js) with TypeScript
- **Purpose**: Classic Mini car enthusiast website and knowledgebase
- **URL**: https://classicminidiy.com
- **Repository**: https://github.com/somethingnew71/classicminidiy
- **License**: GPL-3.0

## Architecture

### Frontend

- **Framework**: Nuxt 4.1.2 with TypeScript
- **UI Components**: Nuxt UI for form controls, modals, accordions, and other UI elements
- **Styling**: TailwindCSS 4.1.13 with @tailwindcss/vite
- **Icons**: Font Awesome 6 (exclusive icon library - no Heroicons or Lucide)
- **Search**: Fuse.js for advanced fuzzy search functionality
- **Charts**: Highcharts for data visualization
- **PWA**: Configured with @vite-pwa/nuxt for offline functionality
- **SEO**: Comprehensive meta tags, structured data, sitemap generation

### Backend & Infrastructure

- **Hosting**: Vercel with serverless deployment
- **Database**:
  - DynamoDB for primary data storage
  - PostgreSQL for Nuxt Content
- **Storage**: AWS S3 with intelligent tiering and versioning
- **CDN**: S3 static assets with custom domain
- **Analytics**: Google Analytics, Vercel Analytics & Speed Insights

### AI Integration

- **LangGraph SDK**: AI-powered chat functionality
- **Nuxt-LLMs**: Content integration for AI responses
- **MCP Server**: Model Context Protocol server for structured data access

## Development Environment

### Package Management

- **Primary**: bun (Node.js v24+)
- **Current Version**: 3.5.4
- **Scripts**:
  - `bun run dev` - Start development server (using `nuxi dev`)
  - `bun run build` - Build for production (using `nuxi build`)
  - `bun run start` - Preview production build (using `nuxi preview`)
  - `bun run format` - Format code with Prettier

**Note**: A `postinstall` script handles native module compilation for `better-sqlite3` across platforms.

### Key Technologies

- **Nuxt 4.1.2** with Vue 3 Composition API
- **TypeScript** for type safety
- **Nuxt UI** for UI components (buttons, forms, modals, accordions, etc.)
- **TailwindCSS 4.1.13** with @tailwindcss/vite for styling
- **Font Awesome 6** for all icons (exclusive - no Heroicons/Lucide)
- **Nuxt Content** for content management
- **AWS SDK v3** (v3.894.0) for cloud services
- **LangChain/LangGraph** (v0.1.6) for AI functionality
- **Highcharts** (v12.4.0) for interactive data visualization
- **Fuse.js** (v7.1.0) for advanced search functionality

## Project Structure

### Core Directories

- `app/` - Main application code
  - `components/` - Vue components organized by feature
  - `pages/` - File-based routing structure
  - `composables/` - Reusable composition functions
  - `middleware/` - Route middleware
  - `plugins/` - Nuxt plugins
- `server/` - API routes and server utilities
- `data/` - Static data files and TypeScript models
- `public/` - Static assets

### Key Features

#### Technical Toolbox (`app/technical`)

- **Compression Ratio Calculator** (`/technical/compression`) - Engine compression calculations with piston, crankshaft, head gasket configurations
- **Gearbox Calculator** (`/technical/gearing`) - Gear ratio calculations and speed computations
- **SU Carb Needle Configurator** (`/technical/needles`) - Interactive needle comparison with Highcharts visualization
- **Chassis Number Decoder** (`/technical/chassis-decoder`) - Historical chassis number database and identification
- **Engine Number Decoder** (`/technical/engine-decoder`) - Engine code interpretation and specifications
- **Common Clearances Reference** (`/technical/clearance`) - Comprehensive clearance specifications by system
- **Parts Equivalency Database** (`/technical/parts`) - Cross-reference part numbers between brands
- **Torque Specifications Chart** (`/technical/torque`) - Complete torque specification database

#### Archive System (`app/archive`)

- **Workshop Manuals** (`/archive/manuals`) - Complete digitized workshop manuals with search
- **Electrical Wiring Diagrams** (`/archive/electrical`) - Positive/negative ground systems by year and model
- **Historical Advertisements** (`/archive/adverts`) - Period advertising materials and brochures
- **Vendor Catalogues** (`/archive/catalogues`) - Historical parts catalogs and documentation
- **Tuning & Modifications** (`/archive/tuning`) - Performance modification guides and specs
- **Registry System** (`/archive/registry`) - User-submitted Classic Mini registrations with admin approval
- **Wheel Fitment Library** (`/archive/wheels`) - Comprehensive wheel database with user photos
- **Color Database** (`/archive/colors`) - Historical paint colors with hex values and user contributions
- **Engine Specifications** (`/archive/engines`) - Complete engine database with performance specs
- **Vehicle Weights Reference** (`/archive/weights`) - Weight specifications by model and year

#### AI-Powered Features (`app/chat`)

- **CMDIY Assistant** - LangGraph-powered conversational AI with context awareness
- **Model Context Protocol (MCP) Server** - AI integration with calculators and tools
- **Streaming Responses** - Real-time AI chat with persistent conversation threads

#### Administrative Features (`app/admin`)

- **Registry Review System** (`/admin/registry/review`) - Approve/reject user submissions
- **Wheel Review System** (`/admin/wheels/review`) - Review user-submitted wheel data
- **Authentication System** - Secure admin login and session management

#### E-commerce Integration (`/maps`)

- **ECU Maps Store** - Multi-ECU support (Haltech, Speeduino, MegaSquirt, etc.)
- **GitHub Integration** - Real-time repository updates and release management
- **Feature Matrix** - Ignition maps, fuel maps, VE tables, target AFR configurations

#### Internationalization (i18n)

- **Multi-Language Support** - 10 languages with comprehensive translations
- **Browser Detection** - Automatic language detection and SEO optimization
- **Nuxt i18n Module** - @nuxtjs/i18n for full internationalization support
- **Language Switching** - Dynamic locale switching with persistent user preferences

## API Structure

### Core APIs (51+ endpoints)

#### Technical Tools APIs

- `/api/decoders/chassis` - Chassis number decoding by year ranges
- `/api/decoders/engine` - Engine code interpretation and identification
- `/api/mcp/compression` - MCP integration for compression calculator
- `/api/mcp/gearbox` - MCP integration for gearbox calculator
- `/api/mcp/chassis-decoder` - MCP integration for chassis decoding

#### Database APIs

- `/api/wheels/` - Wheel fitment database with image handling
- `/api/registry/` - User registration system with approval workflow
- `/api/colors/` - Paint color database with user contributions
- `/api/engines/` - Engine specifications and performance data
- `/api/weights/` - Vehicle weight specifications

#### AI & Chat APIs

- `/api/langgraph/` - AI chat integration with streaming responses
- `/api/mcp/` - Model Context Protocol server for tool integration

#### Administrative APIs

- `/api/admin/registry/review` - Registry submission review and approval
- `/api/admin/wheels/review` - Wheel submission review and management
- `/api/admin/auth` - Authentication and session management

#### Content & Media APIs

- `/api/github/` - Repository statistics, commits, and release data
- `/api/youtube/` - Channel statistics and video integration
- `/api/maps/` - ECU maps store with GitHub integration

### External Integrations

- **GitHub API**: Repository statistics, commits, releases, and automated content updates
- **YouTube API**: Channel statistics, video feeds, and content synchronization
- **AWS Services**: S3 storage with intelligent tiering, DynamoDB queries and operations

## Development Guidelines

### Code Standards

- **TypeScript**: Strict type checking enabled
- **Vue 3**: Composition API preferred over Options API
- **Prettier**: Code formatting with 2-space indentation
- **ESLint**: Linting rules for code quality

### Component Patterns

- **Single File Components**: .vue files with `<script setup>` syntax
- **Composables**: Reusable logic in `/composables/` directory
- **Type Safety**: All components properly typed with TypeScript interfaces
- **CSS**: TailwindCSS classes preferred

### Icons (Font Awesome 6 - EXCLUSIVE)

**IMPORTANT**: This project uses Font Awesome 6 as the ONLY icon library. Do NOT use Heroicons, Lucide, or any other icon libraries.

Font Awesome is loaded via a **Font Awesome Kit** (CDN script configured in `nuxt.config.ts`), not via an npm package.

#### Nuxt UI Component Icons

When using Nuxt UI components with `icon` props (UButton, UAccordion, UAlert, etc.), use the Iconify format:

```vue
<!-- Solid icons (most common) -->
<UButton icon="i-fa6-solid-house" />
<UAccordion :items="[{ label: 'Item', icon: 'i-fa6-solid-gear' }]" />
<UAlert icon="i-fa6-solid-circle-info" />

<!-- Regular icons -->
<UButton icon="i-fa6-regular-heart" />

<!-- Brand icons -->
<UButton icon="i-fa6-brands-github" />
```

**Format**: `i-fa6-{style}-{icon-name}`

- `i-fa6-solid-*` - Solid style (fas)
- `i-fa6-regular-*` - Regular style (far)
- `i-fa6-brands-*` - Brand icons (fab)

#### Inline Icons

For inline icons in templates, use the traditional Font Awesome class syntax:

```vue
<i class="fas fa-house"></i>
<!-- Solid -->
<i class="far fa-heart"></i>
<!-- Regular -->
<i class="fab fa-github"></i>
<!-- Brands -->
<i class="fad fa-spinner"></i>
<!-- Duotone -->
```

#### Common Icon Mappings

| Purpose     | Iconify Format                     | Class Format                  |
| ----------- | ---------------------------------- | ----------------------------- |
| Home        | `i-fa6-solid-house`                | `fas fa-house`                |
| Search      | `i-fa6-solid-magnifying-glass`     | `fas fa-magnifying-glass`     |
| Settings    | `i-fa6-solid-gear`                 | `fas fa-gear`                 |
| User        | `i-fa6-solid-user`                 | `fas fa-user`                 |
| Info        | `i-fa6-solid-circle-info`          | `fas fa-circle-info`          |
| Warning     | `i-fa6-solid-triangle-exclamation` | `fas fa-triangle-exclamation` |
| Error       | `i-fa6-solid-circle-xmark`         | `fas fa-circle-xmark`         |
| Plus        | `i-fa6-solid-plus`                 | `fas fa-plus`                 |
| Close       | `i-fa6-solid-xmark`                | `fas fa-xmark`                |
| Arrow Right | `i-fa6-solid-arrow-right`          | `fas fa-arrow-right`          |
| File        | `i-fa6-solid-file-lines`           | `fas fa-file-lines`           |
| Car         | `i-fa6-solid-car`                  | `fas fa-car`                  |

### Performance Optimizations

- **SSR/ISR**: Strategic prerendering for static content
- **Image Optimization**: Multiple formats (WebP, AVIF) with responsive sizes
- **Code Splitting**: Manual chunks for better caching
- **Service Worker**: PWA caching strategies for offline functionality
- **CDN Integration**: S3 static assets with intelligent tiering
- **Bundle Optimization**: Tree shaking and dependency optimization

## Environment Variables

### Required Runtime Config

```env
# AWS Credentials
dynamo_id=
dynamo_key=
s3_id=
s3_key=

# External APIs
githubAPIKey=
youtubeAPIKey=
validation_key=

# AI Services
NUXT_LANGGRAPH_API_URL=
NUXT_LANGSMITH_API_KEY=

# Database
POSTGRES_URL=

# Public URLs
NUXT_PUBLIC_SITE_URL=
s3Base=
```

## Content Management

### Static Data

- JSON files in `/data/` directory for reference information
- TypeScript models for data structure validation
- Automated data processing for consistency

### Dynamic Content

- **Nuxt Content**: Markdown-based content with frontmatter
- **DynamoDB**: User-generated content (registry, wheels)
- **S3**: File storage for images and documents

## Deployment

### Vercel Configuration

- **Config File**: `vercel.json` with bun commands
- **Install Command**: `bun install --frozen-lockfile`
- **Build Command**: `bun run build`
- **Output Directory**: `.nuxt/dist`
- **Node Version**: 24.x
- **Environment**: Production optimizations enabled

### Performance Features

- **Prerendering**: Static pages cached at build time
- **Edge Functions**: API routes optimized for global distribution
- **Asset Optimization**: Compression, minification, tree shaking
- **Monitoring**: Vercel Analytics and Speed Insights integration

## Testing & Quality

### Code Quality

- **TypeScript**: Compile-time type checking
- **Prettier**: Consistent code formatting
- **Build Validation**: Production build testing required

### Performance

- **Lighthouse**: Regular performance auditing
- **Core Web Vitals**: Monitoring via Vercel Speed Insights
- **PWA**: Progressive web app functionality testing

## Common Tasks

### Adding New Features

1. Create TypeScript interfaces in `/data/models/`
2. Add API routes in `/server/api/`
3. Create Vue components with proper typing
4. Update navigation and routing as needed
5. Test build process: `bun run build`

### Content Updates

- Static data: Update JSON files in `/data/`
- Dynamic content: Use admin interfaces (`/admin`) or direct API calls
- Images: Upload to S3 bucket with appropriate paths and WebP optimization
- User submissions: Review via admin panel for registry and wheel database entries

### Database Management

#### User-Generated Content

- **Registry System**: Admin approval workflow for Classic Mini registrations
- **Wheel Database**: Image processing and fitment data review system
- **Color Contributions**: User-submitted paint color database with validation

#### Static Reference Data

- **Technical Specifications**: JSON-based torque values, clearances, and part equivalencies
- **Historical Data**: Chassis numbers, engine codes, and specifications by year
- **Archive Content**: Digitized manuals, wiring diagrams, and historical documents

### Performance Optimization

- Run `bun run build` to test production build
- Check bundle analysis for large dependencies
- Verify image optimization is working correctly
- Test PWA functionality and caching strategies

## Internationalization (i18n)

### Nuxt i18n Configuration

The project uses **@nuxtjs/i18n** module for comprehensive internationalization support with the following configuration:

```typescript
// nuxt.config.ts
i18n: {
  defaultLocale: 'en',
  locales: [
    { code: 'en', name: 'English', file: 'en.json' },
    { code: 'es', name: 'Spanish', file: 'es.json' },
    { code: 'fr', name: 'French', file: 'fr.json' },
    { code: 'de', name: 'German', file: 'de.json' },
    { code: 'it', name: 'Italian', file: 'it.json' },
    { code: 'pt', name: 'Portuguese', file: 'pt.json' },
    { code: 'ru', name: 'Russian', file: 'ru.json' },
    { code: 'ja', name: 'Japanese', file: 'ja.json' },
    { code: 'zh', name: 'Chinese', file: 'zh.json' },
    { code: 'ko', name: 'Korean', file: 'ko.json' },
  ],
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_redirected',
    redirectOn: 'root',
    alwaysRedirect: false,
    fallbackLocale: 'en',
  },
}
```

### Locale Files Structure

All translation files are located in `/i18n/locales/` directory:

```
i18n/
└── locales/
    ├── en.json (240 lines - Master/Reference)
    ├── de.json (348 lines - Most Complete)
    ├── es.json (224 lines)
    ├── fr.json (178 lines)
    ├── it.json (179 lines)
    ├── ja.json (179 lines)
    ├── ko.json (179 lines)
    ├── pt.json (179 lines)
    ├── ru.json (179 lines)
    └── zh.json (179 lines)
```

### Translation Structure

Each locale file follows a hierarchical JSON structure:

```json
{
  "common": {
    "home": "Home",
    "archive": "Archive",
    "technical": "Technical"
    // ... common UI elements
  },
  "navigation": {
    "main_menu": "Main Menu",
    "breadcrumb": "Breadcrumb"
  },
  "hero": {
    "home_title": "Classic Mini DIY",
    "home_subtitle": "YOUR FRIENDLY NEIGHBORHOOD"
  },
  "components": {
    "stats": {
      /* ... */
    },
    "recent_videos": {
      /* ... */
    }
  },
  "pages": {
    "home": {
      /* ... */
    },
    "about": {
      /* ... */
    },
    "error": {
      /* ... */
    }
    // ... page-specific translations
  }
}
```

### Usage in Components

#### Composition API (Recommended)

```vue
<script setup>
  const { t, locale, locales } = useI18n();

  // Use translations
  const title = $t('pages.home.title');
  const description = $t('pages.home.description');
</script>

<template>
  <h1>{{ $t('pages.home.title') }}</h1>
  <p>{{ $t('pages.home.description') }}</p>
</template>
```

#### Language Switcher Component

The `LanguageSwitcher.vue` component (`/app/components/LanguageSwitcher.vue`) provides:

- Dropdown interface for language selection
- Persistent language preference via cookies
- Automatic route switching with `switchLocalePath()`
- Mobile-friendly design with responsive labels

### Browser Language Detection

**Automatic Detection Features:**

- **Cookie Persistence**: User language preference stored in `i18n_redirected` cookie
- **Fallback Logic**: Defaults to English (`en`) if browser language not supported
- **Root Redirect**: Only redirects on root path to avoid breaking deep links
- **Smart Redirect**: Avoids infinite redirect loops with `alwaysRedirect: false`

### SEO & Multi-Language Support

**SEO Optimization:**

- Language-specific meta tags and content
- Automatic `hreflang` attribute generation
- Localized URLs and routing
- Social media meta tags in appropriate languages

### Implementation Guidelines

#### Adding New Translations

1. **Add new locale** to `nuxt.config.ts` locales array
2. **Create new JSON file** in `/i18n/locales/` directory
3. **Copy structure** from `en.json` as template
4. **Translate all keys** maintaining JSON hierarchy
5. **Test language switcher** functionality

#### Translation Key Naming Convention

- Use **nested structure** for organization (`pages.home.title`)
- **Descriptive keys** rather than generic ones
- **Consistent naming** across all locale files
- **Group by feature/page** for better maintenance

#### Components Using i18n

Current implementation includes:

- `LanguageSwitcher.vue` - Language selection dropdown
- `Hero.vue` - Home page hero section
- `Stats.vue` - YouTube statistics
- `RecentVideos.vue` - Video listings
- `error.vue` - Error pages
- `index.vue` - Home page
- `contact.vue` - Contact page
- `privacy.vue` - Privacy policy
- `maps.vue` - ECU maps page

### Translation Status

- **English (en)**: Complete reference (240 lines)
- **German (de)**: Most comprehensive (348 lines)
- **Spanish (es)**: Well-developed (224 lines)
- **Other Languages**: Basic coverage (178-179 lines each)

### Development Notes

**Important Considerations:**

- **German locale** appears to have the most complete translations
- **English** serves as the master reference for new keys
- **Consistent structure** maintained across all locale files
- **Browser detection** configured for optimal UX without being intrusive
- **No routing prefixes** - clean URLs maintained across all languages

## Advanced Features

### Progressive Web App (PWA)

- **Offline Functionality**: Service worker caching for offline access
- **App-like Experience**: Installable web application
- **Mobile Optimization**: Responsive design with touch-friendly interfaces

### SEO & Social Integration

- **Comprehensive SEO**: Meta tags, structured data, XML sitemaps
- **Social Sharing**: Open Graph and Twitter cards for all pages
- **Multi-language SEO**: Language-specific meta tags and content optimization

### Developer Tools Integration

- **Recommended Tools Database**: Categorized tool lists with vendor integration
- **Amazon Affiliate Links**: Integrated product recommendations
- **Image Optimization**: WebP variants with fallback support

### Performance Monitoring

- **Analytics Integration**: Google Analytics, Vercel Analytics, Speed Insights
- **Core Web Vitals**: Real-time performance monitoring
- **Error Tracking**: Comprehensive error logging and monitoring

## Notable Technical Achievements

1. **Comprehensive Classic Mini Database**: One of the most complete digital archives for Classic Mini information worldwide
2. **Advanced AI Integration**: Sophisticated LangGraph implementation with MCP server for technical assistance
3. **Multi-language Support**: Full internationalization across 10 languages with browser detection
4. **User-Generated Content System**: Advanced submission and administrative review workflows
5. **Performance Excellence**: Extensive optimization strategies including PWA, CDN, and caching
6. **Real-time Features**: Streaming AI responses and live data synchronization

## Recent Updates & Changes

### Current Version: 3.5.4

**Major Framework Upgrades:**

- **Nuxt 4.1.2**: Upgraded from Nuxt 3 to Nuxt 4.1.2 for improved performance and new features
- **TailwindCSS v4**: Migration to TailwindCSS 4.1.13 with @tailwindcss/vite for better build performance and developer experience
- **Node.js 24**: Updated Node.js requirement to v24+ for latest performance improvements
- **Bun Package Manager**: Migrated from npm to bun for faster dependency installation and script execution

**Recent Commits and Updates:**

- **AWS Package Updates**: Updated AWS SDK packages to v3.894.0 for improved performance and security
- **Visual Normalization**: Extensive visual improvements across search and table views with new table options for archive pages
- **Wheel Submit Bugfixes**: Small improvements to the wheel submission functionality
- **Search Enhancement**: Migration to Fuse.js v7.1.0 for improved fuzzy search capabilities across the platform
- **Security Updates**: Regular package updates focusing on security improvements
- **Translation Fixes**: Ongoing improvements to internationalization support

**Key Dependencies Updated:**

- `@aws-sdk/*` packages: v3.894.0
- `nuxt`: v4.1.2
- `@nuxt/ui`: Nuxt UI component library
- `tailwindcss`: v4.1.13
- `fuse.js`: v7.1.0
- `highcharts`: v12.4.0
- `@langchain/langgraph-sdk`: v0.1.6

**Font Awesome**: Loaded via Font Awesome Kit (CDN script in nuxt.config.ts)

## Support Resources

- **Documentation**: Comprehensive README.md with setup instructions
- **Community**: GitHub Issues for bug reports and feature requests
- **Support**: Patreon for server costs and development funding
- **Related Projects**: YouTube channel and merchandise store integration
