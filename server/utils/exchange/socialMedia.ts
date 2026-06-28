import { type SupabaseClient } from '@supabase/supabase-js';
import { prepareImageForInstagram, cleanupTempImages, compressImageForBluesky } from './imageProcessor';

/**
 * Social Media Auto-Posting for The Mini Exchange
 *
 * Automatically posts paid listings to Facebook Page and Instagram Business
 * account using the Meta Graph API when a listing is activated after payment.
 */

const META_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function formatServerLocation(listing: {
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
  location?: string | null;
}): string {
  const parts: string[] = [];
  if (listing.city) parts.push(listing.city);
  if (listing.state_province) parts.push(listing.state_province);
  if (listing.country && listing.country !== 'United States') parts.push(listing.country);
  if (parts.length > 0) return parts.join(', ');
  return listing.location || '';
}

// --- Types ---

interface BlueskyConfig {
  handle: string;
  appPassword: string;
  siteUrl: string;
}

interface MetaConfig {
  accessToken: string;
  pageId: string;
  instagramAccountId: string;
  siteUrl: string;
}

export interface SocialPostResult {
  success: boolean;
  postId?: string;
  /** Human-readable single-line error message — safe to render verbatim in a toast. */
  error?: string;
  /** Meta Graph API top-level error code (e.g. 100, 190, 200). */
  errorCode?: number;
  /** Meta Graph API error_subcode (e.g. 33, 463). */
  errorSubcode?: number;
  /** Meta Graph API fbtrace_id — admin includes this when filing a Meta support ticket. */
  fbtraceId?: string;
  /** Meta error.type (e.g. OAuthException). */
  errorType?: string;
  /** Meta error_user_msg — user-facing message Meta wants shown to end users. */
  userMessage?: string;
}

/**
 * Redact `access_token=...` query params from any string before it leaves the
 * server. ofetch builds error.message from the failing request URL, and the
 * Instagram container-status poll passes the token as a query param — without
 * this, a polling failure would surface the live Meta access token in the
 * admin UI and Vercel logs.
 */
function redactCredentials(input: string): string {
  return input.replace(/access_token=[^&\s"']+/gi, 'access_token=REDACTED');
}

/**
 * Pull structured Meta Graph API error fields out of an ofetch / $fetch error.
 *
 * Meta returns errors as:
 *   { error: { message, type, code, error_subcode?, error_user_msg?, fbtrace_id? } }
 *
 * ofetch surfaces the response JSON on `error.data`, but some transports stash
 * it on `error.response._data` instead — try both. We deliberately whitelist
 * known-safe fields so we never accidentally surface an access_token or any
 * other credential that Meta might echo back, and every string we return is
 * passed through `redactCredentials` as a backstop against ofetch's URL-in-
 * error-message behavior.
 */
function extractMetaErrorDetails(error: any): Omit<SocialPostResult, 'success' | 'postId'> {
  const metaError = error?.data?.error ?? error?.response?._data?.error ?? null;

  // `typeof [] === 'object'`, so explicitly reject arrays.
  if (!metaError || typeof metaError !== 'object' || Array.isArray(metaError)) {
    const raw = typeof error?.message === 'string' ? error.message : 'Unknown error';
    return { error: redactCredentials(raw) };
  }

  const message = typeof metaError.message === 'string' ? metaError.message : undefined;
  const userMessage = typeof metaError.error_user_msg === 'string' ? metaError.error_user_msg : undefined;
  const code = typeof metaError.code === 'number' ? metaError.code : undefined;
  const subcode = typeof metaError.error_subcode === 'number' ? metaError.error_subcode : undefined;
  const fbtraceId = typeof metaError.fbtrace_id === 'string' ? metaError.fbtrace_id : undefined;
  const errorType = typeof metaError.type === 'string' ? metaError.type : undefined;

  // Build the human-readable line: "<message> [code N / subcode M / fbtrace XYZ]"
  const tags: string[] = [];
  if (code !== undefined) tags.push(`code ${code}`);
  if (subcode !== undefined) tags.push(`subcode ${subcode}`);
  if (fbtraceId) tags.push(`fbtrace ${fbtraceId}`);
  const base = message || error?.message || 'Unknown Meta error';
  const human = tags.length > 0 ? `${base} [${tags.join(' / ')}]` : base;

  return {
    error: redactCredentials(human),
    errorCode: code,
    errorSubcode: subcode,
    fbtraceId,
    errorType,
    userMessage: userMessage ? redactCredentials(userMessage) : undefined,
  };
}

export interface ListingForSocialPost {
  id: string;
  title: string;
  description: string;
  slug: string;
  price?: number | null;
  currency?: string | null;
  year?: number | null;
  model?: string | null;
  location?: string | null;
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
  listing_category?: string | null;
  condition?: string | null;
  listing_photos?: Array<{
    storage_path: string;
    display_order: number;
    is_primary?: boolean | null;
    category?: string | null;
  }>;
}

// --- Configuration ---

function getMetaConfig(): MetaConfig | null {
  const config = useRuntimeConfig();

  if (!config.metaAccessToken || !config.metaPageId || !config.metaInstagramAccountId) {
    console.warn('Meta API credentials not configured. Social media posting will be skipped.');
    return null;
  }

  // Always use production URL for social media posts, even when running locally
  const siteUrl = config.public.siteUrl as string;
  const isLocalhost = !siteUrl || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1');

  return {
    accessToken: config.metaAccessToken as string,
    pageId: config.metaPageId as string,
    instagramAccountId: config.metaInstagramAccountId as string,
    siteUrl: isLocalhost ? 'https://theminiexchange.com' : siteUrl,
  };
}

function getBlueskyConfig(): BlueskyConfig | null {
  const config = useRuntimeConfig();

  if (!config.blueskyHandle || !config.blueskyAppPassword) {
    console.warn('Bluesky credentials not configured. Bluesky posting will be skipped.');
    return null;
  }

  const siteUrl = config.public.siteUrl as string;
  const isLocalhost = !siteUrl || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1');

  return {
    handle: config.blueskyHandle as string,
    appPassword: config.blueskyAppPassword as string,
    siteUrl: isLocalhost ? 'https://theminiexchange.com' : siteUrl,
  };
}

// --- Helpers ---

export function getPhotoPublicUrl(storagePath: string): string {
  const config = useRuntimeConfig();
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${config.public.supabaseUrl}/storage/v1/object/public/listing-photos/${encoded}`;
}

export function generateHashtags(listing: {
  year?: number | null;
  model?: string | null;
  listing_category?: string | null;
  condition?: string | null;
}): string {
  const tags: string[] = ['#ClassicMini', '#MiniCooper', '#TheMiniExchange', '#ClassicMiniDIY', '#ClassicCar'];

  if (listing.year) {
    tags.push(`#Mini${listing.year}`);
  }

  if (listing.model) {
    const modelTag = listing.model.replace(/\s+/g, '');
    tags.push(`#${modelTag}`);
    if (listing.model.toLowerCase().includes('cooper s')) {
      tags.push('#CooperS');
    } else if (listing.model.toLowerCase().includes('cooper')) {
      tags.push('#MiniCooperClassic');
    }
  }

  if (listing.listing_category === 'parts') {
    tags.push('#MiniParts', '#ClassicMiniParts');
  } else if (listing.listing_category === 'engine') {
    tags.push('#ASeriesEngine', '#MiniEngine');
  } else {
    tags.push('#MiniForSale', '#ClassicCarForSale');
  }

  if (listing.condition) {
    if (listing.condition.toLowerCase() === 'restored') {
      tags.push('#Restored');
    } else if (listing.condition.toLowerCase() === 'original') {
      tags.push('#OriginalCondition');
    }
  }

  return tags.join(' ');
}

export function formatPostText(
  listing: {
    title: string;
    description: string;
    price?: number | null;
    currency?: string | null;
    year?: number | null;
    model?: string | null;
    location?: string | null;
    slug: string;
    listing_category?: string | null;
    condition?: string | null;
  },
  siteUrl: string,
  options?: { linkInBio?: boolean }
): string {
  const parts: string[] = [];

  parts.push(listing.title);
  parts.push('');

  if (listing.price) {
    const currency = listing.currency || 'USD';
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(listing.price);
    parts.push(`Price: ${formatted}`);
  }

  const loc = formatServerLocation(listing);
  if (loc) {
    parts.push(`Location: ${loc}`);
  }

  parts.push('');

  const maxDescLength = 300;
  if (listing.description.length > maxDescLength) {
    parts.push(listing.description.substring(0, maxDescLength).trim() + '...');
  } else {
    parts.push(listing.description);
  }

  parts.push('');
  if (options?.linkInBio) {
    parts.push('Link in bio');
  } else {
    parts.push(`View listing: ${siteUrl}/listings/${listing.slug}`);
  }
  parts.push('');
  parts.push(generateHashtags(listing));

  return parts.join('\n');
}

// --- Facebook ---

export async function postToFacebook(listing: ListingForSocialPost, photoUrls: string[]): Promise<SocialPostResult> {
  const metaConfig = getMetaConfig();
  if (!metaConfig) return { success: false, error: 'Meta API not configured' };

  try {
    const message = formatPostText(listing, metaConfig.siteUrl);

    if (photoUrls.length > 0) {
      // Upload each photo as unpublished
      const mediaFbIds: string[] = [];

      for (const url of photoUrls) {
        const response = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${metaConfig.pageId}/photos`, {
          method: 'POST',
          body: {
            url,
            published: false,
            access_token: metaConfig.accessToken,
          },
        });
        mediaFbIds.push(response.id);
      }

      // Create multi-photo post with proper JSON array format
      const postResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${metaConfig.pageId}/feed`, {
        method: 'POST',
        body: {
          message,
          attached_media: mediaFbIds.map((id) => ({ media_fbid: id })),
          access_token: metaConfig.accessToken,
        },
      });

      return { success: true, postId: postResponse.id };
    }

    // Text-only fallback
    const postResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${metaConfig.pageId}/feed`, {
      method: 'POST',
      body: {
        message,
        link: `${metaConfig.siteUrl}/listings/${listing.slug}`,
        access_token: metaConfig.accessToken,
      },
    });

    return { success: true, postId: postResponse.id };
  } catch (error: any) {
    console.error('Failed to post to Facebook:', error?.data || error.message || error);
    const details = extractMetaErrorDetails(error);
    return { success: false, ...details };
  }
}

// --- Instagram ---

/**
 * Instagram Image Requirements:
 * - Aspect ratio must be between 4:5 (0.8) and 1.91:1 (1.91)
 * - Minimum resolution: 320px
 * - Maximum resolution: 1440px
 * - File size: under 8MB
 *
 * If posting fails with "aspect ratio is not supported", the image dimensions
 * fall outside the 0.8 to 1.91 ratio range. Common culprits:
 * - Very wide panoramic shots (wider than 1.91:1)
 * - Very tall/narrow images (taller than 4:5)
 * - Square-ish images within the range should work fine
 *
 * The user may need to crop/resize images in their listing before retrying.
 */
/**
 * Fallback wait when the container status endpoint is not readable by the token.
 * Photo containers typically finish in 3-8 seconds; we wait 10 to be safe.
 */
const INSTAGRAM_CONTAINER_FALLBACK_WAIT_MS = 10_000;

/**
 * Window during which a subsequent fallback wait for the same token can be
 * skipped — the previous wait covered the IG processing time. Long enough to
 * span container-create + carousel-create + small slack; short enough that a
 * stale entry doesn't help an unrelated later post avoid a needed wait.
 */
const INSTAGRAM_RECENT_WAIT_WINDOW_MS = INSTAGRAM_CONTAINER_FALLBACK_WAIT_MS + 5_000;

/**
 * Per-token timestamp of the most recent fallback wait. Used to skip
 * redundant 10s waits within a single post flow (e.g. after children have
 * already finished waiting, the carousel parent doesn't need another 10s).
 * Bounded to 100 entries — for this app there's effectively one token,
 * but the clear-on-full guard prevents unbounded growth if that changes.
 */
const lastWaitTimestamps = new Map<string, number>();

function recordWait(token: string, timestamp: number): void {
  if (lastWaitTimestamps.size >= 100) {
    lastWaitTimestamps.clear();
  }
  lastWaitTimestamps.set(token, timestamp);
}

/**
 * Test-only helper to reset the per-token wait cache between tests.
 * Do not call from production code.
 */
export function _resetIgWaitCacheForTesting(): void {
  lastWaitTimestamps.clear();
}

/**
 * Polls the Instagram container status until it's ready for publishing.
 * Instagram containers can take a few seconds to process, especially for carousels.
 *
 * Some Page Access Tokens (even with full `instagram_content_publish` / asset
 * permissions) cannot read `GET /{ig-container-id}?fields=status_code` —
 * Meta returns `code: 100, error_subcode: 33, type: GraphMethodException`.
 * The container CREATE and PUBLISH endpoints still work for the same token,
 * so when we hit that specific error we fall back to a fixed wait and
 * proceed to publish. The container's true status is enforced server-side
 * by the publish call.
 *
 * Within a single post flow, only the FIRST 100/33 fallback actually waits;
 * subsequent ones within `INSTAGRAM_RECENT_WAIT_WINDOW_MS` skip the wait
 * since the IG containers have already had time to process. Caps total
 * fallback wait at ~10s regardless of carousel size (vs Vercel timeouts).
 */
async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 10,
  delayMs = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let status: { status_code: string; id: string };
    try {
      status = await $fetch<{ status_code: string; id: string }>(`${META_GRAPH_API_BASE}/${containerId}`, {
        params: {
          fields: 'status_code',
          access_token: accessToken,
        },
      });
    } catch (err: any) {
      const code = err?.data?.error?.code;
      const subcode = err?.data?.error?.error_subcode;
      if (code === 100 && subcode === 33) {
        const now = Date.now();
        const lastWait = lastWaitTimestamps.get(accessToken) ?? 0;
        if (now - lastWait < INSTAGRAM_RECENT_WAIT_WINDOW_MS) {
          console.warn(
            `[Instagram] Container ${containerId} status endpoint not readable (code 100/33). Already waited recently, skipping.`
          );
          return;
        }
        // Pre-record so concurrent callers in the same flow (e.g. Promise.all
        // over carousel children) see "wait in progress" and skip.
        recordWait(accessToken, now);
        console.warn(
          `[Instagram] Container ${containerId} status endpoint not readable by this token (code 100/33). Falling back to fixed ${INSTAGRAM_CONTAINER_FALLBACK_WAIT_MS}ms wait.`
        );
        await new Promise((resolve) => setTimeout(resolve, INSTAGRAM_CONTAINER_FALLBACK_WAIT_MS));
        // Refresh the timestamp to the wait-completion time so the
        // post-wait skip-window is measured from when the IG containers
        // would actually be ready.
        recordWait(accessToken, Date.now());
        return;
      }
      throw err;
    }

    if (status.status_code === 'FINISHED') {
      console.log(`[Instagram] Container ${containerId} ready after ${attempt} check(s)`);
      return;
    }

    if (status.status_code === 'ERROR') {
      throw new Error(`Instagram container ${containerId} failed processing`);
    }

    // IN_PROGRESS or other status - wait and retry
    console.log(
      `[Instagram] Container ${containerId} status: ${status.status_code}, waiting... (attempt ${attempt}/${maxAttempts})`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Instagram container ${containerId} not ready after ${maxAttempts} attempts`);
}

export async function postToInstagram(listing: ListingForSocialPost, photoUrls: string[]): Promise<SocialPostResult> {
  const metaConfig = getMetaConfig();
  if (!metaConfig) return { success: false, error: 'Meta API not configured' };

  if (photoUrls.length === 0) {
    return { success: false, error: 'Instagram requires at least one photo' };
  }

  console.log(`[Instagram] Attempting to post ${photoUrls.length} photos for listing "${listing.title}"`);
  console.log('[Instagram] Note: Images must have aspect ratio between 4:5 (0.8) and 1.91:1 (1.91)');

  try {
    const caption = formatPostText(listing, metaConfig.siteUrl, { linkInBio: true });
    const igAccountId = metaConfig.instagramAccountId;

    if (photoUrls.length === 1) {
      // Single image post
      const containerResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${igAccountId}/media`, {
        method: 'POST',
        body: {
          image_url: photoUrls[0],
          caption,
          access_token: metaConfig.accessToken,
        },
      });

      // Wait for container to finish processing
      await waitForInstagramContainer(containerResponse.id, metaConfig.accessToken);

      const publishResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${igAccountId}/media_publish`, {
        method: 'POST',
        body: {
          creation_id: containerResponse.id,
          access_token: metaConfig.accessToken,
        },
      });

      return { success: true, postId: publishResponse.id };
    }

    // Multi-image carousel (2-10 images)
    const childContainerIds: string[] = [];

    for (const url of photoUrls) {
      const response = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${igAccountId}/media`, {
        method: 'POST',
        body: {
          image_url: url,
          is_carousel_item: true,
          access_token: metaConfig.accessToken,
        },
      });
      childContainerIds.push(response.id);
    }

    // Wait for all child containers to finish processing concurrently.
    // Containers process in parallel on Meta's side once created, so polling
    // sequentially adds no correctness — and with the 10s fallback for the
    // 100/33 status-endpoint case, a sequential loop would multiply the wait
    // by N children (e.g. 10 photos × 10s = 100s, past Vercel timeouts).
    await Promise.all(childContainerIds.map((childId) => waitForInstagramContainer(childId, metaConfig.accessToken)));

    // Create carousel container
    const carouselResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${igAccountId}/media`, {
      method: 'POST',
      body: {
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        caption,
        access_token: metaConfig.accessToken,
      },
    });

    // Wait for carousel container to finish processing
    await waitForInstagramContainer(carouselResponse.id, metaConfig.accessToken);

    // Publish the carousel
    const publishResponse = await $fetch<{ id: string }>(`${META_GRAPH_API_BASE}/${igAccountId}/media_publish`, {
      method: 'POST',
      body: {
        creation_id: carouselResponse.id,
        access_token: metaConfig.accessToken,
      },
    });

    return { success: true, postId: publishResponse.id };
  } catch (error: any) {
    console.error('Failed to post to Instagram:', error?.data || error.message || error);
    const details = extractMetaErrorDetails(error);

    // Provide more helpful error message for common issues (preserve aspect-ratio hint)
    // but still carry the structured diagnostic fields through for the admin UI.
    if (details.error && details.error.toLowerCase().includes('aspect ratio')) {
      console.error(
        '[Instagram] Aspect ratio error: One or more images have dimensions outside the 4:5 to 1.91:1 range. ' +
          'The user may need to crop/resize their listing photos before retrying.'
      );
      return {
        success: false,
        ...details,
        error: 'Image aspect ratio not supported. Photos must be between 4:5 (portrait) and 1.91:1 (landscape) ratio.',
      };
    }

    return { success: false, ...details };
  }
}

// --- Bluesky ---

/**
 * Bluesky (AT Protocol) Requirements:
 * - Character limit: 300 characters (much shorter than FB/IG)
 * - Image limit: 4 images per post
 * - Image size: 1MB max per image
 * - Uses App Password for authentication (not OAuth)
 */

// Bluesky has 300 char limit - create shorter format for main post
function formatBlueskyText(
  listing: {
    title: string;
    price?: number | null;
    currency?: string | null;
    location?: string | null;
    slug: string;
  },
  siteUrl: string
): string {
  const parts: string[] = [];

  parts.push(listing.title);

  if (listing.price) {
    const currency = listing.currency || 'USD';
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(listing.price);
    parts.push(formatted);
  }

  const bskyLoc = formatServerLocation(listing);
  if (bskyLoc) {
    parts.push(`📍 ${bskyLoc}`);
  }

  parts.push('');
  parts.push(`${siteUrl}/listings/${listing.slug}`);
  parts.push('');
  parts.push('#ClassicMini #MiniCooper');

  return parts.join('\n');
}

// Format additional details for Bluesky reply thread
function formatBlueskyReplyText(listing: ListingForSocialPost): string | null {
  const details: string[] = [];

  // Year, model, condition line
  const specs: string[] = [];
  if (listing.year) specs.push(String(listing.year));
  if (listing.model) specs.push(listing.model);
  if (listing.condition) specs.push(`(${listing.condition})`);
  if (specs.length > 0) {
    details.push(`🚗 ${specs.join(' ')}`);
  }

  // Description (truncated to fit within 300 chars with room for other content)
  if (listing.description) {
    const maxDescLength = 250;
    let desc = listing.description.trim();
    if (desc.length > maxDescLength) {
      desc = desc.substring(0, maxDescLength).trim() + '...';
    }
    details.push('');
    details.push(desc);
  }

  // Only return if we have meaningful content
  if (details.length === 0 || (details.length === 1 && specs.length === 0)) {
    return null;
  }

  return details.join('\n');
}

export async function postToBluesky(listing: ListingForSocialPost, photoUrls: string[]): Promise<SocialPostResult> {
  const bskyConfig = getBlueskyConfig();
  if (!bskyConfig) return { success: false, error: 'Bluesky not configured' };

  try {
    const { BskyAgent, RichText } = await import('@atproto/api');

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: bskyConfig.handle,
      password: bskyConfig.appPassword,
    });

    // Format post text (Bluesky has 300 char limit - use shorter format)
    const postText = formatBlueskyText(listing, bskyConfig.siteUrl);

    // Create rich text for link detection
    const rt = new RichText({ text: postText });
    await rt.detectFacets(agent);

    // Upload images (Bluesky supports up to 4 images, 1MB each)
    const imagesToPost = photoUrls.slice(0, 4);
    const uploadedImages: Array<{
      alt: string;
      image: any; // BlobRef type from @atproto/api
    }> = [];

    console.log(`[Bluesky] Uploading ${imagesToPost.length} images for listing "${listing.title}"`);

    for (const url of imagesToPost) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const originalBuffer = Buffer.from(buffer);

      // Compress if over Bluesky's ~1MB limit
      let imageBuffer: Buffer;
      if (originalBuffer.length > 1_000_000) {
        console.log(
          `[Bluesky] Image ${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit, compressing...`
        );
        imageBuffer = await compressImageForBluesky(originalBuffer);
      } else {
        imageBuffer = originalBuffer;
      }

      const uint8Array = new Uint8Array(imageBuffer);

      const { data: blob } = await agent.uploadBlob(uint8Array, {
        encoding: 'image/jpeg',
      });

      uploadedImages.push({
        alt: `${listing.title} - Classic Mini listing`,
        image: blob.blob,
      });
    }

    // Create post with images embed
    const postRecord: {
      text: string;
      facets?: any[];
      createdAt: string;
      embed?: {
        $type: string;
        images: typeof uploadedImages;
      };
    } = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };

    if (uploadedImages.length > 0) {
      postRecord.embed = {
        $type: 'app.bsky.embed.images',
        images: uploadedImages,
      };
    }

    const result = await agent.post(postRecord);

    // Extract post ID from URI (at://did:plc:xxx/app.bsky.feed.post/xxx)
    const postId = result.uri.split('/').pop();

    console.log(`[Bluesky] Successfully posted for listing "${listing.title}" with ${uploadedImages.length} images`);

    // Create a reply thread with additional details
    const replyText = formatBlueskyReplyText(listing);
    if (replyText) {
      try {
        const replyRt = new RichText({ text: replyText });
        await replyRt.detectFacets(agent);

        await agent.post({
          text: replyRt.text,
          facets: replyRt.facets,
          createdAt: new Date().toISOString(),
          reply: {
            root: { uri: result.uri, cid: result.cid },
            parent: { uri: result.uri, cid: result.cid },
          },
        });

        console.log(`[Bluesky] Added reply thread with listing details`);
      } catch (replyError: any) {
        // Don't fail the whole post if reply fails
        console.warn(`[Bluesky] Failed to add reply thread: ${replyError?.message || replyError}`);
      }
    }

    return { success: true, postId };
  } catch (error: any) {
    console.error('Failed to post to Bluesky:', error?.message || error);

    // XRPCError from @atproto/api carries a `.error` string code (e.g. "InvalidRequest",
    // "AuthRequired") plus `.message`. Surface both so admins don't have to guess
    // which Bluesky failure mode they hit.
    const message = typeof error?.message === 'string' ? error.message : undefined;
    const xrpcCode = typeof error?.error === 'string' ? error.error : undefined;
    const status = typeof error?.status === 'number' ? error.status : undefined;

    const base = message || 'Unknown Bluesky error';
    const tags: string[] = [];
    if (xrpcCode) tags.push(xrpcCode);
    if (status !== undefined) tags.push(`status ${status}`);
    const human = tags.length > 0 ? `${base} [${tags.join(' / ')}]` : base;

    return {
      success: false,
      error: redactCredentials(human),
      errorType: xrpcCode,
    };
  }
}

// --- Orchestrator ---

export async function postListingToSocialMedia(
  listing: ListingForSocialPost,
  supabaseClient: SupabaseClient
): Promise<void> {
  const metaConfig = getMetaConfig();
  const bskyConfig = getBlueskyConfig();

  // Skip if no platforms are configured
  if (!metaConfig && !bskyConfig) {
    console.warn('No social media platforms configured. Skipping social posting.');
    return;
  }

  // Atomic idempotency check: only proceed if we can flip the flag
  const { data: updated, error: updateError } = await supabaseClient
    .from('listings')
    .update({ promoted_on_social: true, promoted_on_social_at: new Date().toISOString() })
    .eq('id', listing.id)
    .eq('promoted_on_social', false)
    .select('id')
    .single();

  if (updateError || !updated) {
    console.log(`Listing ${listing.id} already promoted on social media, skipping.`);
    return;
  }

  // Everything below is wrapped in try-catch to ensure promoted_on_social is
  // reverted if an unexpected error occurs (e.g., image processing throws).
  // Without this, the flag stays true and the listing vanishes from all admin
  // social posting sections — not pending, not failed, not successful.
  let anyImagesCropped = false;

  try {
    // Sort photos: primary first, then by display_order
    const photos = listing.listing_photos || [];
    const sortedPhotos = [...photos].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.display_order - b.display_order;
    });

    const photoUrls = sortedPhotos.slice(0, 5).map((p) => getPhotoPublicUrl(p.storage_path));

    // Process images for Instagram (auto-crop to valid aspect ratios)
    console.log(`[SocialMedia] Processing ${photoUrls.length} images for Instagram compatibility...`);
    const instagramPhotoUrls: string[] = [];

    for (let i = 0; i < photoUrls.length; i++) {
      const { url, wasCropped } = await prepareImageForInstagram(photoUrls[i], listing.id, i, supabaseClient);
      instagramPhotoUrls.push(url);
      if (wasCropped) anyImagesCropped = true;
    }

    if (anyImagesCropped) {
      console.log(`[SocialMedia] Some images were auto-cropped for Instagram aspect ratio compliance`);
    }

    // Post to all platforms concurrently
    // Facebook uses original URLs, Instagram uses processed URLs, Bluesky uses first 4 original URLs
    const [fbResult, igResult, bskyResult] = await Promise.allSettled([
      postToFacebook(listing, photoUrls),
      postToInstagram(listing, instagramPhotoUrls),
      postToBluesky(listing, photoUrls),
    ]);

    const fbSuccess = fbResult.status === 'fulfilled' && fbResult.value.success;
    const igSuccess = igResult.status === 'fulfilled' && igResult.value.success;
    const bskySuccess = bskyResult.status === 'fulfilled' && bskyResult.value.success;

    const fbPostId = fbResult.status === 'fulfilled' ? fbResult.value.postId : undefined;
    const igPostId = igResult.status === 'fulfilled' ? igResult.value.postId : undefined;
    const bskyPostId = bskyResult.status === 'fulfilled' ? bskyResult.value.postId : undefined;

    const fbError =
      fbResult.status === 'rejected'
        ? fbResult.reason?.message
        : fbResult.status === 'fulfilled'
          ? fbResult.value.error
          : undefined;
    const igError =
      igResult.status === 'rejected'
        ? igResult.reason?.message
        : igResult.status === 'fulfilled'
          ? igResult.value.error
          : undefined;
    const bskyError =
      bskyResult.status === 'rejected'
        ? bskyResult.reason?.message
        : bskyResult.status === 'fulfilled'
          ? bskyResult.value.error
          : undefined;

    // Store social post IDs in listing_promotions features JSONB
    if (fbPostId || igPostId || bskyPostId) {
      const { data: promo } = await supabaseClient
        .from('listing_promotions')
        .select('id, features')
        .eq('listing_id', listing.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (promo) {
        await supabaseClient
          .from('listing_promotions')
          .update({
            features: {
              ...(promo.features || {}),
              facebook_post_id: fbPostId || null,
              instagram_post_id: igPostId || null,
              bluesky_post_id: bskyPostId || null,
              social_posted_at: new Date().toISOString(),
            },
          })
          .eq('id', promo.id);
      }
    }

    if (fbSuccess || igSuccess || bskySuccess) {
      console.log(
        `Social media posted for listing ${listing.id}: FB=${fbSuccess}, IG=${igSuccess}, Bluesky=${bskySuccess}`
      );
    }

    // If all platforms failed, revert the flag so it can be retried
    if (!fbSuccess && !igSuccess && !bskySuccess) {
      await supabaseClient
        .from('listings')
        .update({ promoted_on_social: false, promoted_on_social_at: null })
        .eq('id', listing.id);

      console.error(
        `Social media posting failed for listing ${listing.id}: FB=${fbError}, IG=${igError}, Bluesky=${bskyError}`
      );
    }

    // Send admin notification for any failures
    if (!fbSuccess || !igSuccess || !bskySuccess) {
      const failures: string[] = [];
      if (!fbSuccess) failures.push(`Facebook: ${fbError || 'Unknown error'}`);
      if (!igSuccess) failures.push(`Instagram: ${igError || 'Unknown error'}`);
      if (!bskySuccess) failures.push(`Bluesky: ${bskyError || 'Unknown error'}`);

      console.error('[SocialMedia] Social post failures for listing ' + listing.id + ' (' + listing.title + '):', failures);
    }
  } catch (unexpectedError) {
    // Revert the flag so the listing appears in the admin pending list for manual retry
    console.error(
      `[SocialMedia] Unexpected error posting listing ${listing.id}, reverting promoted_on_social flag:`,
      unexpectedError
    );

    try {
      await supabaseClient
        .from('listings')
        .update({ promoted_on_social: false, promoted_on_social_at: null })
        .eq('id', listing.id);
    } catch (revertError) {
      console.error(
        `[SocialMedia] CRITICAL: Failed to revert promoted_on_social for listing ${listing.id}:`,
        revertError
      );
    }

    console.error('[SocialMedia] Social post failures for listing ' + listing.id + ' (' + listing.title + '):', [
      `Unexpected error: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`,
    ]);
  }

  // Clean up temporary cropped images (non-blocking, outside try-catch since it's best-effort)
  if (anyImagesCropped) {
    cleanupTempImages(listing.id, supabaseClient).catch((err) => {
      console.warn('[SocialMedia] Failed to cleanup temp images:', err);
    });
  }
}
