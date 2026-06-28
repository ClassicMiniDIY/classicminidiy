import { Feed } from 'feed';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '../supabase';

// RSS/Atom/JSON feeds for the Mini Exchange. Ported from TME; rehomed under
// /exchange/feed/* and gated by the cutover flag. Each route file is a one-liner:
//   export default createFeedHandler('vehicles', 'rss')

export type FeedType = 'everything' | 'listings' | 'vehicles' | 'engines' | 'parts' | 'finds' | 'wanted';
export type FeedFormat = 'rss' | 'atom' | 'json';

interface FeedConfig {
  title: string;
  description: string;
  path: string;
  includeListings: boolean;
  listingCategory?: 'vehicle' | 'engine' | 'parts';
  includeFinds: boolean;
  includeWanted: boolean;
}

export const FEED_META: Record<FeedType, FeedConfig> = {
  everything: {
    title: 'The Mini Exchange - Everything',
    description: 'All marketplace listings, Mini Finds, and Wanted posts from The Mini Exchange.',
    path: '/exchange/feed.xml',
    includeListings: true,
    includeFinds: true,
    includeWanted: true,
  },
  listings: {
    title: 'The Mini Exchange - All Marketplace Listings',
    description: 'All active Classic Mini marketplace listings — vehicles, engines, and parts.',
    path: '/exchange/feed/listings.xml',
    includeListings: true,
    includeFinds: false,
    includeWanted: false,
  },
  vehicles: {
    title: 'The Mini Exchange - Classic Mini Vehicles',
    description: 'Classic Mini vehicles for sale on The Mini Exchange.',
    path: '/exchange/feed/vehicles.xml',
    includeListings: true,
    listingCategory: 'vehicle',
    includeFinds: false,
    includeWanted: false,
  },
  engines: {
    title: 'The Mini Exchange - Classic Mini Engines',
    description: 'Classic Mini engines for sale on The Mini Exchange.',
    path: '/exchange/feed/engines.xml',
    includeListings: true,
    listingCategory: 'engine',
    includeFinds: false,
    includeWanted: false,
  },
  parts: {
    title: 'The Mini Exchange - Classic Mini Parts',
    description: 'Classic Mini parts and accessories for sale on The Mini Exchange.',
    path: '/exchange/feed/parts.xml',
    includeListings: true,
    listingCategory: 'parts',
    includeFinds: false,
    includeWanted: false,
  },
  finds: {
    title: 'The Mini Exchange - Mini Finds',
    description: 'Curated Classic Mini listings spotted across the web by the community.',
    path: '/exchange/feed/finds.xml',
    includeListings: false,
    includeFinds: true,
    includeWanted: false,
  },
  wanted: {
    title: 'The Mini Exchange - Wanted Posts',
    description: 'Classic Mini vehicles, engines, and parts that community members are seeking.',
    path: '/exchange/feed/wanted.xml',
    includeListings: false,
    includeFinds: false,
    includeWanted: true,
  },
};

/** Escape HTML entities for safe inclusion in feed content. */
function escapeHtml(unsafe: string): string {
  return unsafe.replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m
  );
}

/** Order embedded listing_photos: primary first, then display_order. */
function applyPhotoOrdering<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order('is_primary', { referencedTable: 'listing_photos', ascending: false })
    .order('display_order', { referencedTable: 'listing_photos', ascending: true });
}

function formatServerLocation(listing: any): string {
  const parts: string[] = [];
  if (listing.city) parts.push(listing.city);
  if (listing.state_province) parts.push(listing.state_province);
  if (listing.country && listing.country !== 'United States') parts.push(listing.country);
  if (parts.length > 0) return parts.join(', ');
  return listing.location || '';
}

interface FeedItem {
  item: any;
  date: Date;
}

function buildListingItems(listings: any[], supabaseUrl: string, siteUrl: string): FeedItem[] {
  return listings.map((listing: any) => {
    const listingUrl = `${siteUrl}/exchange/listings/${listing.slug}`;

    const photos = listing.listing_photos || [];
    const primaryPhoto = photos.find((p: any) => p.is_primary) || photos[0];
    const imageUrl = primaryPhoto?.storage_path
      ? `${supabaseUrl}/storage/v1/object/public/listing-photos/${encodeURIComponent(primaryPhoto.storage_path)}`
      : undefined;

    const sellerName = listing.user?.display_name || 'Anonymous Seller';

    const priceText =
      listing.price === 0 ? 'Free' : listing.price ? `$${listing.price.toLocaleString()}` : 'Contact for price';

    const safeTitle = escapeHtml(listing.title || '');
    const safeModel = escapeHtml(String(listing.model || ''));
    const safeDescription = escapeHtml(listing.description || '');
    const safeSellerName = escapeHtml(sellerName);
    const safeLocation = escapeHtml(formatServerLocation(listing));

    const feedItem: any = {
      title: listing.title,
      id: listing.id,
      link: listingUrl,
      description: `${listing.year} ${safeModel} - ${priceText} - ${safeLocation}\n\n${safeDescription}`,
      content: `
        <h2>${safeTitle}</h2>
        ${imageUrl ? `<img src="${imageUrl}" alt="${safeTitle}" style="max-width: 100%; height: auto;" />` : ''}
        <p><strong>${listing.year} ${safeModel}</strong></p>
        <p><strong>Price:</strong> ${priceText}</p>
        <p><strong>Location:</strong> ${safeLocation}</p>
        <p><strong>Seller:</strong> ${safeSellerName}</p>
        <p>${safeDescription}</p>
        <p><a href="${listingUrl}">View full listing</a></p>
      `,
      author: [{ name: sellerName, link: listingUrl }],
      date: new Date(listing.created_at),
    };

    if (imageUrl) {
      feedItem.image = imageUrl;
      feedItem.enclosure = { url: imageUrl, type: 'image/jpeg' };
    }

    return { item: feedItem, date: new Date(listing.created_at) };
  });
}

function buildFindItems(finds: any[], siteUrl: string): FeedItem[] {
  return finds.map((find: any) => {
    const findUrl = `${siteUrl}/exchange/finds/${find.slug}`;
    const findTitle = `[Mini Find] ${find.title}`;
    const findContent = find.editor_commentary || find.description || find.og_description || '';
    const safeTitle = escapeHtml(findTitle);
    const safeContent = escapeHtml(findContent);

    const feedItem: any = {
      title: findTitle,
      id: `external-${find.id}`,
      link: findUrl,
      description: safeContent,
      content: `
        <h2>${safeTitle}</h2>
        ${find.og_image_url ? `<img src="${escapeHtml(find.og_image_url)}" alt="${safeTitle}" style="max-width: 100%; height: auto;" />` : ''}
        <p>${safeContent}</p>
        <p><a href="${findUrl}">View on The Mini Exchange</a></p>
      `,
      author: [{ name: 'The Mini Exchange', link: siteUrl }],
      date: new Date(find.published_at),
    };

    if (find.og_image_url) {
      const safeImageUrl = escapeHtml(find.og_image_url);
      feedItem.image = safeImageUrl;
      feedItem.enclosure = { url: safeImageUrl, type: 'image/jpeg' };
    }

    return { item: feedItem, date: new Date(find.published_at) };
  });
}

function formatBudget(minCents: number | null, maxCents: number | null, currency: string): string {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);

  if (minCents != null && maxCents != null) return `${fmt(minCents)} – ${fmt(maxCents)}`;
  if (maxCents != null) return `Up to ${fmt(maxCents)}`;
  if (minCents != null) return `From ${fmt(minCents)}`;
  return 'Flexible';
}

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  engine: 'Engine',
  parts: 'Parts',
};

function buildWantedItems(wantedPosts: any[], siteUrl: string): FeedItem[] {
  return wantedPosts.map((post: any) => {
    const postUrl = `${siteUrl}/exchange/wanted/${post.id}`;
    const postTitle = `[Wanted] ${post.title}`;
    const budgetText = formatBudget(post.budget_min, post.budget_max, post.currency || 'USD');
    const categoryLabel = CATEGORY_LABELS[post.category] || post.category;
    const safeTitle = escapeHtml(postTitle);
    const safeDescription = escapeHtml(post.description || '');
    const safeLocation = escapeHtml(formatServerLocation(post));

    const feedItem: any = {
      title: postTitle,
      id: `wanted-${post.id}`,
      link: postUrl,
      description: `${categoryLabel} — Budget: ${budgetText}${safeLocation ? ` — ${safeLocation}` : ''}\n\n${safeDescription}`,
      content: `
        <h2>${safeTitle}</h2>
        <p><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p><strong>Budget:</strong> ${escapeHtml(budgetText)}</p>
        ${safeLocation ? `<p><strong>Location:</strong> ${safeLocation}</p>` : ''}
        <p>${safeDescription}</p>
        <p><a href="${postUrl}">View wanted post</a></p>
      `,
      author: [{ name: 'The Mini Exchange', link: siteUrl }],
      date: new Date(post.created_at),
    };

    return { item: feedItem, date: new Date(post.created_at) };
  });
}

export async function assembleFeed(
  feedType: FeedType,
  supabase: SupabaseClient,
  config: { public: { supabaseUrl: string; siteUrl?: string } }
): Promise<Feed> {
  const meta = FEED_META[feedType];
  const siteUrl = config.public.siteUrl || 'https://www.classicminidiy.com';

  // Build feed links for all 3 formats.
  const basePath = meta.path.replace('.xml', '');
  const feedLinks =
    feedType === 'everything'
      ? { rss: `${siteUrl}/exchange/feed.xml`, json: `${siteUrl}/exchange/feed.json`, atom: `${siteUrl}/exchange/atom.xml` }
      : { rss: `${siteUrl}${basePath}.xml`, json: `${siteUrl}${basePath}.json`, atom: `${siteUrl}${basePath}.atom` };

  const feed = new Feed({
    title: meta.title,
    description: meta.description,
    id: siteUrl,
    link: siteUrl,
    language: 'en',
    image: `${siteUrl}/og-image.jpg`,
    favicon: `${siteUrl}/favicon.ico`,
    copyright: `Copyright ${new Date().getFullYear()} The Mini Exchange`,
    updated: new Date(),
    generator: 'The Mini Exchange RSS',
    feedLinks,
    author: { name: 'The Mini Exchange', link: siteUrl },
  });

  const allItems: FeedItem[] = [];

  // Marketplace listings.
  if (meta.includeListings) {
    let query = supabase
      .from('listings')
      .select(
        `
        id, title, slug, description, price, year, model,
        location, city, state_province, country, created_at,
        user:profiles!listings_user_id_fkey ( display_name ),
        listing_photos ( storage_path, is_primary )
      `
      )
      .eq('status', 'active');

    if (meta.listingCategory) {
      query = query.eq('listing_category', meta.listingCategory);
    }

    query = query.order('created_at', { ascending: false });

    const { data: listings } = await applyPhotoOrdering(query).limit(50);
    if (listings) {
      allItems.push(...buildListingItems(listings, config.public.supabaseUrl, siteUrl));
    }
  }

  // External listings (finds).
  if (meta.includeFinds) {
    const { data: finds } = await supabase
      .from('external_listings')
      .select('id, title, slug, description, og_description, og_image_url, editor_commentary, published_at')
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .limit(20);

    if (finds) {
      allItems.push(...buildFindItems(finds, siteUrl));
    }
  }

  // Wanted posts.
  if (meta.includeWanted) {
    const { data: wantedPosts } = await supabase
      .from('wanted_posts')
      .select(
        'id, title, description, category, budget_min, budget_max, currency, city, state_province, country, created_at'
      )
      .eq('status', 'active')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20);

    if (wantedPosts) {
      allItems.push(...buildWantedItems(wantedPosts, siteUrl));
    }
  }

  allItems
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 50)
    .forEach(({ item }) => feed.addItem(item));

  return feed;
}

const CONTENT_TYPES: Record<FeedFormat, string> = {
  rss: 'application/xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

/**
 * Nitro event handler factory for a given feed type + format. Flag-gated: when
 * the Exchange is off the feed 404s (invisible/uncrawlable pre-cutover).
 */
export function createFeedHandler(type: FeedType, format: FeedFormat) {
  return defineEventHandler(async (event: any) => {
    const config = useRuntimeConfig();
    if (!config.public.exchangeEnabled) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' });
    }

    const supabase = getServiceClient();
    const feed = await assembleFeed(type, supabase as unknown as SupabaseClient, config as any);

    setHeader(event, 'Content-Type', CONTENT_TYPES[format]);
    setHeader(event, 'Cache-Control', 'public, max-age=3600');

    if (format === 'json') return feed.json1();
    if (format === 'atom') return feed.atom1();
    return feed.rss2();
  });
}
