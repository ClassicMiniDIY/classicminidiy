# CLAUDE.md

This file provides guidance to Claude Code when working with the Classic Mini DIY project.

## CMDIY Ecosystem Context

This repo is part of the Classic Mini DIY property ecosystem. For the full cross-repo architecture, please refer to the central documentation. Key related repos:

- **classicminidiy-supabase** — Shared Supabase backend (PostgreSQL, Auth, Edge Functions, RLS)
- **TheMiniExchange** — Classic Mini marketplace (Nuxt 4, daisyUI, Stripe)
- **Native CMDIY Apps** — iOS (Swift) and Android (Kotlin) mobile apps

This site shares the Supabase auth and profiles with the other properties. Database schema lives in `classicminidiy-supabase`.

## Cross-Property Feature Tracking

Features that span multiple CMDIY properties (Web / Supabase / iOS / Android / TME) are tracked in the org-level GitHub Project: **[CMDIY Platform #9](https://github.com/orgs/ClassicMiniDIY/projects/9)**.

**Before starting work on a new feature, check if it has a card on the board.** If not, create one:

```bash
gh project item-create 9 --owner ClassicMiniDIY \
  --title "<feature name>" \
  --body "<short description>"
```

Then set the per-property status fields via the project UI or `gh project item-edit`:
- **Not Started** — feature could exist here but hasn't shipped
- **In Progress** — actively being built
- **Shipped** — live in production
- **N/A** — feature doesn't apply to this property

Also set **Priority** (Low/Medium/High) and **Cascade Notes** for porting reminders.

**Skip card creation for:** bug fixes, refactors, dependency bumps, or work scoped to one repo with no cross-property cascade potential.

A weekly remote agent updates the rolling [Weekly Cascade Report](https://github.com/ClassicMiniDIY/classicminidiy-supabase/issues?q=Weekly+Cascade+Report) issue listing features shipped on one property but not yet ported elsewhere.

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

### Security Invariants

Load-bearing contracts — don't "fix" these without understanding why they're this way:

- **`/api/langgraph/**` is intentionally UNAUTHENTICATED.** The AI chat must work for every anonymous site visitor (no login). Do NOT add `requireUserAuth`/login to this proxy — it would break public chat. Abuse is mitigated by per-IP rate limiting in `server/middleware/rate-limit.ts` (default 40 req/60s, tune via `LANGGRAPH_RATELIMIT_MAX` / `LANGGRAPH_RATELIMIT_WINDOW_MS`), not by auth. The privileged `NUXT_LANGSMITH_API_KEY` stays server-only (private `runtimeConfig`).
- **`/mcp` auth fails closed.** Valid keys come ONLY from `MCP_API_KEY` / `MCP_API_KEYS` env vars — there is no hardcoded/default key. The old `dev-mcp-key-classic-mini-diy` default is in public git history and must never be re-accepted in any environment. For local dev, set `MCP_API_KEY` in `.env`.
- **`SUPABASE_SERVICE_KEY` is server-only.** It lives in private `runtimeConfig` and is read only via `server/utils/supabase.ts#getServiceClient`. Never import that into `app/` or move the key to `runtimeConfig.public`.

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

**@nuxtjs/i18n v10**, `strategy: 'no_prefix'` (clean URLs — no `/de/` path prefix),
`defaultLocale: 'en'`, 10 locales: `en, es, fr, de, it, pt, ru, ja, zh, ko`. Locale
is chosen by the `i18n_redirected` cookie (browser detection on root only); SSR
honors the cookie.

### How translations actually work (read this before touching i18n)

Translations live in **per-component `<i18n lang="json">` SFC blocks** — each page or
component carries its own block with all 10 locales inline. There are **NO global
locale JSON files** (`i18n/locales/*.json` does not exist) and no `langDir`. The root
`i18n.config.ts` is plumbing only (`legacy: false`, empty `messages`); it does not
hold strings. `nuxt.config.ts` sets `i18n.restructureDir: '.'` so the root
`i18n.config.ts` resolves without a warning (v10 defaults the i18n dir to `i18n/`).

```vue
<script setup lang="ts">
  const { t } = useI18n(); // auto-imported — no import statement
</script>

<template>
  <h1>{{ t('hero.title') }}</h1>
  <p>{{ t('intro.body', { count }) }}</p>
</template>

<i18n lang="json">
{
  "en": { "hero": { "title": "..." }, "intro": { "body": "{count} models" } },
  "es": { "hero": { "title": "..." }, "intro": { "body": "{count} modelos" } }
  // ...fr, de, it, pt, ru, ja, zh, ko — all 10 required
}
</i18n>
```

### Rules

- **Add a new translatable surface** by adding `const { t } = useI18n()`, using `t('key')`
  in template/script, and appending an `<i18n lang="json">` block with **all 10 locales**.
  Do not create files under `i18n/locales/` — that pattern is not used here.
- **No HTML inside message values.** `unplugin-vue-i18n` hard-fails the build with
  "Detected HTML in '…' message" if a string contains tags like `<strong>`. Keep markup
  in the template wrapping `{{ t() }}`, or split the sentence into keyed segments. Do not
  put HTML in messages + render with `v-html`.
- Use named interpolation params (`t('x', { count })` ↔ `"{count} models"`) for dynamic text.
- The block is parsed at build time — invalid JSON breaks the build.
- `LanguageSwitcher.vue` (`/app/components/LanguageSwitcher.vue`) is the locale dropdown
  (persists the cookie; no route switching needed under `no_prefix`).

### Localization coverage

Most of the site is localized via these blocks. The **3D Model Library** user-facing UI
(browse, detail, the upload wizard, the dashboard `models`/`selling`/`purchases` tabs, and
the `app/components/models/*` components) is fully translated. **`/legal/*`, `/about`, and
`/admin/models` are intentionally English-only** — legal text is kept authoritative in one
language (translating it creates per-language liability), `/about` is authoritative founder
E-E-A-T identity content (same rationale), and admin is internal tooling.

## 3D Model Library (marketplace)

A community 3D-printable parts library with a Stripe Connect marketplace. Backend lives in
`classicminidiy-supabase` (migrations `20260611*`, edge functions, RLS). Keystone contract:
`classicminidiy-supabase/docs/plans/2026-06-11-3d-model-library.md`. Built on the long-lived
`feature/3d-models` branch (no `modelsEnabled` flag — "launch" = merge to main).

**Load-bearing contracts:**

- **Supabase session is in localStorage, not a cookie.** Any `/api/*` route that needs the
  user must receive an explicit `Authorization: Bearer <access_token>` header (get it from
  `supabase.auth.getSession()`). Direct `useSupabase()` → PostgREST/RPC calls are auto-authed
  and need no Bearer.
- **Payments are thin web proxies → edge functions.** `POST /api/models/[id]/checkout`,
  `/verify-purchase`, and `/api/models/seller/onboard` forward the Bearer token to
  `create-model-checkout` / `verify-model-purchase` / `create-seller-onboarding`. The web
  never calls Stripe directly. Redirect URLs are built from the browser origin and validated
  by the edge functions' allowlist (localhost is allowed for dev).
- **Stripe Connect (model sales) is separate from membership Stripe.** Direct charges on the
  seller's Standard connected account + platform commission via `application_fee_amount`;
  metadata `cmdiy_kind` starts `model_`. Its webhook endpoint + `STRIPE_CONNECT_WEBHOOK_SECRET`
  are distinct from the membership webhook. Do not conflate with the `$1.99/mo` membership.
- **Entitlement is the download gate.** `has_model_entitlement(model_id)` RPC: free/tips and
  owner/admin always true; paid needs a purchase row; `removed`/`flagged` revokes everyone.
  The download route (`/api/models/[modelId]/files/[fileId]/download`) enforces it server-side;
  the detail page reads the RPC client-side to choose download vs. PriceBox.
- **Admin moderation** (`/admin/models`): approve/reject call the `is_admin()`-guarded RPCs
  client-side (admin JWT). Report-resolution (takedown + reporter notification + audit) and
  the seller kill-switch are service-role routes under `server/api/admin/models/`.
- **Contribution management is unified under `/dashboard`** (tabbed: models, gear-configs,
  submissions, selling, purchases). `/models/mine` redirects to `/dashboard/models`.
- New web env: `S3_MODELS_BUCKET`, `S3_MODELS_ACCESS_KEY_ID`, `S3_MODELS_SECRET_ACCESS_KEY`
  (dedicated IAM user, separate bucket from static assets). Launch steps:
  `docs/runbooks/2026-06-12-model-library-launch-checklist.md`.

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
