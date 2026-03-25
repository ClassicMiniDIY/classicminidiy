<a id="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/ClassicMiniDIY/classicminidiy">
    <img src="https://classicminidiy.s3.us-east-1.amazonaws.com/misc/CMDIY-Green.jpg" alt="Logo" width="150" height="150">
  </a>

  <h3 align="center">Classic Mini DIY</h3>

  <p align="center">
    The most comprehensive digital archive and technical resource for Classic Mini enthusiasts worldwide (1959-2000). Free, open source, and designed to be permanently accessible.
    <br />
    <br />
    <a href="https://classicminidiy.com"><strong>Explore the website &raquo;</strong></a>
    <br />
    <br />
    <a href="https://github.com/ClassicMiniDIY/classicminidiy/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/ClassicMiniDIY/classicminidiy/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
    &middot;
    <a href="https://patreon.com/classicminidiy">Support Server Costs</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#key-features">Key Features</a></li>
        <li><a href="#cmdiy-ecosystem">CMDIY Ecosystem</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#environment-setup">Environment Setup</a></li>
      </ul>
    </li>
    <li><a href="#features-overview">Features Overview</a></li>
    <li><a href="#technical-toolbox">Technical Toolbox</a></li>
    <li><a href="#archive-system">Archive System</a></li>
    <li><a href="#user-dashboard--profiles">User Dashboard & Profiles</a></li>
    <li><a href="#contribution-system">Contribution System</a></li>
    <li><a href="#ai-powered-features">AI-Powered Features</a></li>
    <li><a href="#admin--moderation">Admin & Moderation</a></li>
    <li><a href="#api-documentation">API Documentation</a></li>
    <li><a href="#internationalization">Internationalization</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#support">Support</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

[![Product Name Screen Shot][product-screenshot]](https://classicminidiy.com)

**Classic Mini DIY** is a comprehensive web application serving as both a toolkit and permanent archive for Classic Mini enthusiasts. The project combines technical calculators, historical documentation, user profiles, a community contribution system, and AI-powered assistance to create the most complete digital resource for Classic Mini owners worldwide.

### Current Version: 8.0.0

The platform is designed to be both a real-time working tool for mechanics and enthusiasts, and a permanent digital archive ensuring Classic Mini knowledge is preserved for future generations. All content is backed up across multiple cloud locations and designed to remain accessible indefinitely.

### Built With

[![Nuxt][Nuxt.js]][Nuxt-url] [![Vue][Vue.js]][Vue-url] [![TypeScript][TypeScript]][TypeScript-url] [![TailwindCSS][TailwindCSS]][TailwindCSS-url] [![Supabase][Supabase]][Supabase-url] [![AWS][AWS]][AWS-url] [![Vercel][Vercel]][Vercel-url]

**Core Technologies:**

- **Nuxt 4.1.2** - Vue.js framework with server-side rendering
- **Vue 3** - Composition API with `<script setup>` syntax
- **TypeScript** - Strict type checking throughout
- **TailwindCSS 4.1.13** - Utility-first CSS with @tailwindcss/vite
- **Nuxt UI** - Component library for forms, modals, accordions, and more
- **Font Awesome 6** - Icon library (loaded via CDN kit)
- **Supabase** - Authentication, database, and file storage
- **AWS Services** - S3 storage, DynamoDB (legacy data)
- **LangGraph SDK** - AI-powered conversational assistance
- **Highcharts** - Interactive data visualization
- **Fuse.js** - Advanced fuzzy search
- **PostHog** - Product analytics and event tracking
- **Mapbox** - Location autocomplete for user profiles

**Infrastructure:**

- **Vercel** - Serverless hosting with global edge deployment
- **Supabase** - PostgreSQL database, Auth, Edge Functions, Storage
- **AWS S3** - Intelligent tiering storage with versioning for archive assets
- **PostHog** - Analytics (replaced Google Analytics and Vercel Analytics)
- **Bun** - Package manager and script runner

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Key Features

- **User Dashboard** - Centralized hub for submissions, account settings, and activity
- **Profile System** - Avatar uploads, social links, location, privacy controls shared across the CMDIY ecosystem
- **8 Interactive Technical Calculators** - Compression ratio, gearbox, SU carburetors, and more
- **Comprehensive Digital Archive** - Workshop manuals, wiring diagrams, historical documents (powered by Supabase)
- **Community Contributions** - Submit wheels, colors, registry entries, and documents with suggest-edit modals on every detail page
- **AI-Powered Assistant** - LangGraph-based conversational AI with MCP tool integration
- **10-Language Support** - Full internationalization with browser detection
- **Progressive Web App** - Offline functionality and mobile-optimized experience
- **Admin Moderation** - Unified queue for reviewing all submission types with user management
- **ECU Maps Store** - Multi-platform tuning maps with GitHub integration
- **Advanced Search** - Fuse.js powered fuzzy search across all content

### CMDIY Ecosystem

Classic Mini DIY is part of a broader ecosystem of applications sharing a single Supabase backend:

| Property | Description | URL |
|---|---|---|
| **Classic Mini DIY** (this repo) | Knowledgebase, archive, and community site | [classicminidiy.com](https://classicminidiy.com) |
| **The Mini Exchange** | Classic Mini parts/vehicles marketplace | [theminiexchange.com](https://theminiexchange.com) |
| **Classic Mini Toolbox** | iOS and Android mobile apps | App Store / Google Play |

All properties share authentication via Supabase with custom domain `auth.classicminidiy.com`. Users sign in once and their profile, avatar, and preferences carry across all platforms. Sustaining Members ($1.99/mo via App Store / Google Play) receive premium features across all properties.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

- **Node.js** v24 or higher
- **Bun** (package manager) - [install instructions](https://bun.sh)
- **Git** for version control

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ClassicMiniDIY/classicminidiy.git
   cd classicminidiy
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start development server**

   ```bash
   bun run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000` to see the application

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# AWS Credentials (for legacy data and S3 storage)
dynamo_id=your_dynamodb_access_key
dynamo_key=your_dynamodb_secret_key
s3_id=your_s3_access_key
s3_key=your_s3_secret_key

# External APIs
githubAPIKey=your_github_api_key
youtubeAPIKey=your_youtube_api_key
validation_key=your_validation_key

# AI Services
NUXT_LANGGRAPH_API_URL=your_langgraph_api_url
NUXT_LANGSMITH_API_KEY=your_langsmith_api_key

# Database
POSTGRES_URL=your_postgresql_connection_string

# Analytics
POSTHOG_PUBLIC_KEY=your_posthog_key
POSTHOG_HOST=https://us.i.posthog.com

# Mapbox (profile location autocomplete)
NUXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# Public URLs
NUXT_PUBLIC_SITE_URL=https://classicminidiy.com
s3Base=https://classicminidiy.s3.us-east-1.amazonaws.com
```

### Available Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Preview production build
bun run format       # Format code with Prettier
bun run test         # Run unit tests with Vitest
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- FEATURES OVERVIEW -->

## Features Overview

### Technical Toolbox

The technical toolbox provides interactive calculators and reference tools essential for Classic Mini maintenance and modification:

#### Calculators & Tools

- **Compression Ratio Calculator** (`/technical/compression`)
  - Engine compression calculations with piston, crankshaft, head gasket configurations
  - Real-time calculations with visual feedback
  - Support for custom measurements and part specifications

- **Gearbox Calculator** (`/technical/gearing`)
  - Gear ratio calculations and speed computations
  - Multiple gearbox configurations
  - RPM and speed analysis tools

- **SU Carb Needle Configurator** (`/technical/needles`)
  - Interactive needle comparison with Highcharts visualization
  - Comprehensive needle database
  - Performance curve analysis

- **Chassis Number Decoder** (`/technical/chassis-decoder`)
  - Historical chassis number database and identification
  - Year and model identification
  - Production date estimation

- **Engine Number Decoder** (`/technical/engine-decoder`)
  - Engine code interpretation and specifications
  - Performance data and compatibility information

#### Reference Materials

- **Common Clearances Reference** (`/technical/clearance`) - Comprehensive clearance specifications by system
- **Parts Equivalency Database** (`/technical/parts`) - Cross-reference part numbers between brands
- **Torque Specifications Chart** (`/technical/torque`) - Complete torque specification database

### Archive System

The archive system preserves and organizes historical Classic Mini documentation. In v8.0.0, the entire archive was migrated from DynamoDB/S3/@nuxt/content to **Supabase** with unified document pages, collection support, filters, search, and sort.

#### Historical Documentation

- **Workshop Manuals** (`/archive/manuals`) - Complete digitized workshop manuals with full-text search
- **Electrical Wiring Diagrams** (`/archive/electrical`) - Positive and negative ground systems by year and model
- **Historical Advertisements** (`/archive/adverts`) - Period advertising materials and brochures
- **Vendor Catalogues** (`/archive/catalogues`) - Historical parts catalogs and documentation
- **Tuning & Modifications** (`/archive/tuning`) - Performance modification guides and specifications

#### Unified Document System

- **Document Browser** (`/archive/documents`) - Unified listing of all archive documents with filters, search, and sort
- **Collection Pages** (`/archive/documents/collection/[slug]`) - Grouped document collections
- **Document Detail Pages** (`/archive/documents/[slug]`) - Rich metadata, download links, and suggest-edit capability
- **301 Redirects** - All legacy document URLs redirect to new unified paths

#### User-Generated Content

- **Registry System** (`/archive/registry`) - User-submitted Classic Mini registrations with admin approval
- **Wheel Fitment Library** (`/archive/wheels`) - Comprehensive wheel database with user photos
- **Color Database** (`/archive/colors`) - Historical paint colors with hex values and user contributions
- **Engine Specifications** (`/archive/engines`) - Complete engine database with performance specs
- **Vehicle Weights Reference** (`/archive/weights`) - Weight specifications by model and year

### User Dashboard & Profiles

New in v8.0.0 — a centralized user experience:

#### Dashboard (`/dashboard`)

- **Submissions Management** - View, filter, and expand all your submissions (wheels, colors, registry, documents) with detailed status tracking
- **Submission Details** - Click any submission to expand and see full details inline
- **Activity Summary** - At-a-glance counts of total submissions and their statuses
- **Quick Actions** - Links to contribute, edit profile, and manage account

#### Profile System (`/profile`)

- **Public Profile** - View your public-facing profile with avatar, display name, location, and activity summary
- **Profile Editing** (`/profile/edit`) - Full profile management:
  - Avatar upload with crop and preview
  - Display name
  - Mapbox-powered location autocomplete (city, state, country format)
  - Bio / about section
  - Social links (Instagram, Facebook, YouTube, website)
  - Privacy toggles (public profile, show vehicles)
- **Shared Across Ecosystem** - Profile data is shared with The Mini Exchange and mobile apps via Supabase

#### Public User Pages (`/users/[id]`)

- Contributor profile pages showing submission activity and social links

#### Onboarding

- **Welcome Page** (`/welcome`) - First-time users are redirected here after auth callback for profile setup
- **Unified Account Messaging** - Login page explains the shared CMDIY ecosystem account

### Contribution System

New in v8.0.0 — a unified contribution hub replacing scattered submission pages:

#### Contribute Hub (`/contribute`)

- **Type Selection Grid** - Choose from wheel fitment, color, registry, or document contributions
- **Self-Contained Forms** - Each contribution type has its own page with file upload support
- **Suggest-Edit Modals** - Every archive detail page (documents, colors, wheels) has an inline suggest-edit button
- **Contribute CTAs** - Archive hub and section listing pages prominently feature contribution calls-to-action

#### Contribution Pages

- `/contribute/wheel` - Wheel fitment data with photo uploads
- `/contribute/color` - Paint color submissions with hex values
- `/contribute/registry` - Classic Mini registration with photos
- `/contribute/document` - Document submissions with file uploads and collection assignment

### AI-Powered Features

#### CMDIY Assistant (`/chat`)

- **Conversational AI** - LangGraph-powered assistant with Classic Mini expertise
- **Model Context Protocol (MCP) Server** - Direct integration with calculators (compression, gearbox, chassis decoder)
- **Streaming Responses** - Real-time AI chat with persistent conversation threads
- **Context Awareness** - Understanding of Classic Mini technical specifications and archive content

### Admin & Moderation

#### Unified Moderation (`/admin`)

- **Moderation Queue** (`/admin/queue`) - Single queue for reviewing all submission types (wheels, colors, registry, documents) with approve/reject workflows
- **User Management** (`/admin/users`) - User administration with trust levels
- **Registry Review** (`/admin/registry/review`) - Dedicated registry submission review
- **Wheel Review** (`/admin/wheels/review`) - Dedicated wheel submission review
- **Chat Threads** - Admin panel for reviewing AI chat threads
- **Dashboard** - Queue counts and quick access to all admin functions

### E-commerce Integration

#### ECU Maps Store (`/maps`)

- **Multi-ECU Support** - Haltech, Speeduino, MegaSquirt, and more
- **GitHub Integration** - Real-time repository updates and release management
- **Feature Matrix** - Ignition maps, fuel maps, VE tables, target AFR configurations

### Homepage

- **Promotional Banners** - HeroPromo component with auto-rotating promotional carousel
- **Recent Videos** - YouTube channel integration
- **Community Stats** - Live statistics from YouTube and GitHub
- **Mobile App Promotion** - Native app download CTAs

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- API DOCUMENTATION -->

## API Documentation

The Classic Mini DIY platform exposes 50+ REST API endpoints:

### Technical Tools APIs

- `GET /api/decoders/chassis` - Chassis number decoding by year ranges
- `GET /api/decoders/engine` - Engine code interpretation and identification
- `POST /api/mcp/compression` - MCP integration for compression calculator
- `POST /api/mcp/gearbox` - MCP integration for gearbox calculator
- `POST /api/mcp/chassis-decoder` - MCP integration for chassis decoding

### Database APIs

- `GET /api/wheels/` - Wheel fitment database with image handling
- `GET /api/registry/` - User registration system with approval workflow
- `GET /api/colors/` - Paint color database with user contributions
- `GET /api/engines/` - Engine specifications and performance data
- `GET /api/weights/` - Vehicle weight specifications

### AI & Chat APIs

- `POST /api/langgraph/` - AI chat integration with streaming responses
- `GET/POST /api/mcp/` - Model Context Protocol server for tool integration

### Administrative APIs

- `GET /api/admin/registry/review` - Registry submission review and approval
- `GET /api/admin/wheels/review` - Wheel submission review and management
- `GET /api/admin/queue/` - Unified moderation queue (list, approve, reject)
- `GET /api/admin/users/` - User management and trust levels
- `POST /api/admin/auth` - Authentication and session management

### Content & Media APIs

- `GET /api/github/` - Repository statistics, commits, and release data
- `GET /api/youtube/` - Channel statistics and video integration
- `GET /api/maps/` - ECU maps store with GitHub integration

### Mobile App APIs

- `GET /api/app-config.json` - Mobile app backend rollout configuration

### External Integrations

- **Supabase** - Auth, database, storage, and Edge Functions
- **GitHub API** - Repository statistics, commits, releases
- **YouTube API** - Channel statistics, video feeds
- **AWS Services** - S3 storage, DynamoDB (legacy)
- **Mapbox** - Geocoding for location autocomplete
- **PostHog** - Product analytics

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- INTERNATIONALIZATION -->

## Internationalization

Classic Mini DIY supports 10 languages with comprehensive internationalization via `@nuxtjs/i18n`:

### Supported Languages

| Language | Code | Status |
|---|---|---|
| English | `en` | Primary / Reference |
| German | `de` | Most comprehensive |
| Spanish | `es` | Complete |
| French | `fr` | Complete |
| Italian | `it` | Complete |
| Portuguese | `pt` | Complete |
| Russian | `ru` | Complete |
| Japanese | `ja` | Complete |
| Chinese | `zh` | Complete |
| Korean | `ko` | Complete |

### Features

- **Browser Detection** - Automatic language detection on first visit
- **Persistent Preferences** - Cookie-based language memory
- **Dynamic Switching** - Real-time language changes via the language switcher component
- **SEO Optimization** - Language-specific meta tags, `hreflang` attributes, and localized URLs
- **Component-Level i18n** - Each component/page uses `<i18n>` blocks for scoped translations

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

### How to Contribute

1. **Fork the Repository**

   ```bash
   git clone https://github.com/ClassicMiniDIY/classicminidiy.git
   ```

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/AmazingFeature
   ```

3. **Make Your Changes**

   - Follow the existing code style and conventions
   - Use Vue 3 Composition API with `<script setup>` syntax
   - Use Nuxt UI components for UI elements
   - Use Font Awesome 6 icons only (no Heroicons or Lucide)
   - Add translations for new text content across all 10 locales
   - Add tests for new functionality

4. **Test Your Changes**

   ```bash
   bun run build
   bun run test
   bun run format
   ```

5. **Commit Your Changes**

   ```bash
   git commit -m 'feat: add some amazing feature'
   ```

6. **Push to Your Branch**

   ```bash
   git push origin feature/AmazingFeature
   ```

7. **Open a Pull Request** into `main`

### Contribution Guidelines

- **Focus on Classic Mini Content** - Ensure contributions are relevant to Classic Mini enthusiasts
- **Document Changes** - Update relevant documentation and comments
- **Test Thoroughly** - Verify functionality across different devices and browsers
- **Follow Design Patterns** - Use Nuxt UI components, TailwindCSS, and existing patterns
- **Consider Internationalization** - Add translation keys for new text content in all 10 locales
- **Accessibility** - Follow WCAG 2.2 AA standards

### Content Contributions

You don't need to write code to contribute! Visit [classicminidiy.com/contribute](https://classicminidiy.com/contribute) to submit:

- Wheel fitment data and photos
- Paint color information
- Classic Mini registry entries
- Workshop manuals and historical documents

### Top Contributors

<a href="https://github.com/ClassicMiniDIY/classicminidiy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ClassicMiniDIY/classicminidiy" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEPLOYMENT -->

## Deployment

### Production Deployment

The application is deployed on Vercel with the following configuration:

```bash
# Build the application
bun run build

# Preview the production build locally
bun run start
```

### Environment Requirements

- **Node.js** v24+
- **Bun** package manager
- **Install Command**: `bun install --frozen-lockfile`
- **Build Command**: `bun run build`
- **Output Directory**: `.nuxt/dist`
- **Environment Variables**: See [Environment Setup](#environment-setup)

### Performance Optimizations

- **Server-Side Rendering** - Pre-rendered pages for optimal SEO and performance
- **Code Splitting** - Optimized bundle sizes with manual chunks
- **Image Optimization** - WebP and AVIF formats with responsive sizing
- **PWA Caching** - Service worker with intelligent caching strategies
- **Edge Functions** - Global distribution for API routes
- **CDN** - S3 static assets with intelligent tiering
- **Console Stripping** - `drop_console: true` in production builds

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- SUPPORT -->

## Support

### Community Support

- **Bug Reports** - [GitHub Issues](https://github.com/ClassicMiniDIY/classicminidiy/issues)
- **Feature Requests** - [GitHub Issues](https://github.com/ClassicMiniDIY/classicminidiy/issues/new?labels=enhancement)
- **Discussions** - [GitHub Discussions](https://github.com/ClassicMiniDIY/classicminidiy/discussions)

### Financial Support

Help keep the servers running and the project growing:

<a href="https://www.patreon.com/classicminidiy" target="_blank">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="150">
</a>

Your support helps cover:

- Server hosting and Supabase costs
- Database and storage fees
- CDN and bandwidth costs
- Development tools and services

### Related Projects

- **[Classic Mini DIY YouTube](https://youtube.com/c/classicminidiy)** - Video tutorials and builds
- **[The Mini Exchange](https://theminiexchange.com)** - Classic Mini marketplace
- **Classic Mini Toolbox** - iOS and Android mobile apps

## Credits & Acknowledgments

### Technical Information Sources

- **[Seven Mini Parts](https://7ent.com)** - SU needle charts and technical specifications
- **[MintyLamb](http://www.mintylamb.co.uk/suneedle/)** - Original needle configurator inspiration
- **[MiniColours.co.uk](http://mini-colours.co.uk/)** - Color reference database
- **miniweights.co.uk** - Vehicle weight specifications (archived)
- **mk1-performance.com** - Historical archive content (archived)

### Community Contributions

- **Classic Mini Forums** - Technical knowledge and specifications
- **User Submissions** - Registry entries, wheel photos, color contributions, and documents
- **Community Feedback** - Bug reports, feature requests, and improvements

### Open Source Libraries

- [Nuxt](https://nuxt.com/) - Vue.js framework
- [Nuxt UI](https://ui.nuxt.com/) - Component library
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS
- [Supabase](https://supabase.com/) - Backend-as-a-service
- [Highcharts](https://www.highcharts.com/) - Data visualization
- [Fuse.js](https://www.fusejs.io/) - Fuzzy search
- [LangGraph](https://langchain-ai.github.io/langgraph/) - AI agent framework
- [PostHog](https://posthog.com/) - Product analytics
- [Font Awesome](https://fontawesome.com/) - Icon library

## License

Distributed under the **GNU General Public License v3.0**.

This ensures that:

- The project remains free and open source
- Modifications must also be open source
- Commercial use is permitted
- The project can be freely distributed

See `LICENSE` file for more information.

---

<div align="center">

**Classic Mini DIY** - Preserving Classic Mini knowledge for future generations

Made with love by the Classic Mini community

[Back to top](#readme-top)

</div>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/ClassicMiniDIY/classicminidiy?style=for-the-badge
[contributors-url]: https://github.com/ClassicMiniDIY/classicminidiy/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/ClassicMiniDIY/classicminidiy?style=for-the-badge
[forks-url]: https://github.com/ClassicMiniDIY/classicminidiy/network/members
[stars-shield]: https://img.shields.io/github/stars/ClassicMiniDIY/classicminidiy?style=for-the-badge
[stars-url]: https://github.com/ClassicMiniDIY/classicminidiy/stargazers
[issues-shield]: https://img.shields.io/github/issues/ClassicMiniDIY/classicminidiy?style=for-the-badge
[issues-url]: https://github.com/ClassicMiniDIY/classicminidiy/issues
[license-shield]: https://img.shields.io/github/license/ClassicMiniDIY/classicminidiy?style=for-the-badge
[license-url]: https://github.com/ClassicMiniDIY/classicminidiy/blob/main/LICENSE
[product-screenshot]: https://classicminidiy.s3.us-east-1.amazonaws.com/misc/product-preview.png

<!-- Technology Badges -->

[Nuxt.js]: https://img.shields.io/badge/nuxt.js-020421?style=for-the-badge&logo=nuxt&logoColor=00dc82
[Nuxt-url]: https://nuxt.com/
[Vue.js]: https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[TypeScript]: https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[TailwindCSS]: https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[Supabase]: https://img.shields.io/badge/supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[AWS]: https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white
[AWS-url]: https://aws.amazon.com/
[Vercel]: https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white
[Vercel-url]: https://vercel.com/
