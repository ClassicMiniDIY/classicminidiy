/**
 * Giveaway / raffle registry.
 *
 * One entry per promotion. `GiveawayCard.vue` renders any of these as an image
 * carousel card; `/links` shows whichever entry `activeGiveaway()` returns.
 *
 * Adding the next giveaway:
 *   1. Drop the photos in `public/giveaways/{id}/` — they're served straight from
 *      the repo at `/giveaways/{id}/…`, same as `public/hero-promos` and
 *      `public/app-promo`. Keep them web-sized (~1600px on the long edge) —
 *      these ship in the deployment, so full-resolution phone photos bloat the
 *      build. Shoot or crop them all to the same shape and set `aspect` to match.
 *   2. Append a new `Giveaway` object to `GIVEAWAYS` with a fresh `id`.
 *   3. Set its `endsAt`. `activeGiveaway()` picks the soonest-ending entry that
 *      hasn't expired, so the old one drops off on its own — no code change
 *      needed to retire a finished raffle.
 *
 * Copy lives here (English) rather than in an <i18n> block on purpose: prize
 * names, host names, and raffle terms are legal-ish, change per promotion, and
 * aren't worth a 10-locale translation pass. The card's *chrome* (the "Giveaway"
 * badge, "Ends in", the CTA) IS translated in GiveawayCard.vue.
 */

const IMAGE_BASE = '/giveaways';

export interface GiveawayImage {
  /** Root-relative path under `public/` (e.g. `/giveaways/my-raffle/01.jpg`). */
  src: string;
  /** Descriptive alt text — these are the only description of the prize for screen readers. */
  alt: string;
}

export interface Giveaway {
  /** Stable slug. Doubles as the PostHog event id and the `public/giveaways/` folder name. */
  id: string;
  /** Prize headline. Keep it under ~60 chars so it doesn't wrap past two lines. */
  title: string;
  /** One-line supporting detail (what it is, who's providing it). */
  subtitle: string;
  /** Entry page. External raffle hosts (Raffall, Gleam, etc.) are fine. */
  href: string;
  /** Where entries are hosted, shown as fine print ("Hosted on Raffall"). */
  hostLabel: string;
  /** Button copy. Falls back to the translated default when omitted. */
  ctaLabel?: string;
  /**
   * Shape of the carousel window. Match it to how the photos were actually
   * shot — the images are `object-cover`, so a mismatch crops the prize out of
   * frame (portrait phone photos in a `landscape` window lose ~56% of their
   * height). `square` is the safe default; it costs a 25% crop on portrait
   * shots but keeps the card compact in the link stack.
   */
  aspect?: 'square' | 'portrait' | 'landscape';
  /**
   * ISO 8601 close date/time. Drives the countdown and auto-retirement.
   *
   * Always write it with an explicit offset (`Z` or `+01:00`) — a bare
   * `2026-09-30T20:11:00` is parsed in the *runtime's* zone, which means the
   * card would retire at a different moment on the server than in a visitor's
   * browser. Raffall quotes close times in UK time, which is BST (UTC+1) from
   * late March to late October and GMT (UTC+0) the rest of the year.
   */
  endsAt: string;
  images: GiveawayImage[];
}

export const GIVEAWAYS: Giveaway[] = [
  {
    id: 'bagsport-rear-mount-turbo-kit',
    title: 'Win a BagSport Fab Rear-Mount A-Series Turbo Kit',
    subtitle: 'Complete rear-mount turbo setup for your Classic Mini — intercooler, piping, and all.',
    href: 'https://raffall.com/418483/enter-raffle-to-win-bagsport-fab-rear-mount-a-series-turbo-kit-hosted-by-classicminidiy',
    hostLabel: 'Raffall',
    // All eight shots are 1200x1600 portrait phone photos.
    aspect: 'square',
    // 30 Sep 2026, 20:11 UK time — BST (UTC+1) on that date.
    endsAt: '2026-09-30T20:11:00+01:00',
    images: [
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-01.jpg`,
        alt: 'BagSport Fab turbo kit fitted to an A-series engine, viewed from above with the intercooler and charge piping in place',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-02.jpg`,
        alt: 'Side view of the A-series engine and gearbox with the BagSport front-mount intercooler and polished charge pipes',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-03.jpg`,
        alt: 'A-series engine with the BagSport turbo manifold, downpipe, and blow-off valve installed',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-04.jpg`,
        alt: 'Close-up of the turbocharger mounted to the cast manifold with wastegate actuator and charge pipe',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-05.jpg`,
        alt: 'Detail of the Garrett turbocharger, oil feed line, and K&N intake filter on the A-series block',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-06.jpg`,
        alt: 'Front view of the engine showing the BagSport intercooler core mounted across the block',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-07.jpg`,
        alt: 'Three-quarter view of the fully assembled turbo kit on a complete engine and gearbox unit',
      },
      {
        src: `${IMAGE_BASE}/bagsport-rear-mount-turbo-kit/rear-turbo-kit-08.jpg`,
        alt: 'Rear three-quarter view of the turbocharged A-series engine with intake filter and charge piping routed over the block',
      },
    ],
  },
];

/**
 * The giveaway to promote right now: the soonest-ending entry that hasn't
 * closed yet, or `null` when everything has expired (the card then renders
 * nothing at all).
 *
 * `now` is injectable so callers can pass a mount-time timestamp instead of
 * letting SSR and hydration disagree about the clock.
 */
export function activeGiveaway(now: Date = new Date()): Giveaway | null {
  const live = GIVEAWAYS.filter((giveaway) => new Date(giveaway.endsAt).getTime() > now.getTime());
  if (!live.length) return null;
  return live.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0]!;
}
