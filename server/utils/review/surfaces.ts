/**
 * Per-surface adapters for the review card: turn a row into `ReviewInput`,
 * and, for the two surfaces that support `auto`, approve through the same
 * path a human uses. Listings: the status route's effect (status, published
 * date, audit row, seller email). Finds: the admin composable's effect
 * (status, published date). Archive, wanted and models have no auto path in
 * this phase; their gate's `auto` behaves as `hint`.
 *
 * Numbers are checked HERE and passed to the model as findings in words:
 * the model never compares a year or a price.
 */
import type { H3Event } from 'h3';
import { getServiceClient } from '../supabase';
import { recordReviewHint, reviewSubmission, trustLevelOf, type ReviewInput, type ReviewOutcome } from './card';

const EXCHANGE_CATEGORIES: Record<string, string> = {
  vehicle: 'A whole car: a Mini, Cooper, Clubman, Moke, van, estate, pickup, or a rolling shell.',
  engine: 'A complete engine or a gearbox-and-engine unit.',
  parts: 'A part, an assembly, an accessory, trim, wheels, tyres, or tools for a classic Mini.',
};

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}
function yearFinding(year: unknown): string[] {
  const y = Number(year);
  if (!year || !Number.isFinite(y)) return [];
  return y < 1959 || y > 2000 ? [`year ${y} is outside classic Mini production (1959-2000)`] : [];
}

// -- listings ---------------------------------------------------------------
export async function reviewListing(event: H3Event, listingId: string): Promise<ReviewOutcome | null> {
  const db = getServiceClient();
  const { data: l } = await db
    .from('listings')
    .select(
      'id, user_id, title, description, listing_category, year, model, condition, price, currency, mileage, engine_size, transmission, part_number, part_condition, fits_models, oem_or_aftermarket, variant, status, slug'
    )
    .eq('id', listingId)
    .maybeSingle();
  if (!l) return null;
  const input: ReviewInput = {
    title: str(l.title),
    description: str(l.description),
    category: l.listing_category ? String(l.listing_category) : null,
    categories: EXCHANGE_CATEGORIES,
    fields: {
      year: str(l.year),
      model: str(l.model),
      variant: str(l.variant),
      condition: str(l.condition || l.part_condition),
      price: l.price ? `${l.currency ?? ''} ${l.price}`.trim() : '',
      mileage: str(l.mileage),
      engine: str(l.engine_size),
      transmission: str(l.transmission),
      part_number: str(l.part_number),
      fits: str(l.fits_models),
      oem: str(l.oem_or_aftermarket),
    },
    findings: [...yearFinding(l.year), ...(Number(l.price) <= 0 && l.listing_category ? ['no price given'] : [])],
    trust: await trustLevelOf(l.user_id),
  };
  const outcome = await reviewSubmission(event, 'listings', l.id, input);
  if (outcome.autoEligible && l.status === 'pending' && outcome.hint && outcome.model) {
    const ok = await autoApproveListing({ id: l.id, user_id: l.user_id, title: str(l.title), slug: str(l.slug) });
    if (ok) {
      await recordReviewHint('listings', l.id, outcome.hint, outcome.model, 'auto');
      return { ...outcome, decision: 'auto' };
    }
  }
  return outcome;
}

/** The status route's approval, minus the admin: status, published_at, audit row, seller email. */
async function autoApproveListing(l: {
  id: string;
  user_id: string | null;
  title: string;
  slug: string;
}): Promise<boolean> {
  const db = getServiceClient();
  const { error } = await db
    .from('listings')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', l.id)
    .eq('status', 'pending');
  if (error) {
    console.warn('[review] listing auto-approve failed:', error.message);
    return false;
  }
  await db.from('admin_audit_log').insert({
    admin_id: null,
    action: 'listing_active',
    target_type: 'listing',
    target_id: l.id,
    details: { from: 'pending', to: 'active', title: l.title, actor: 'review_gate' },
  });
  if (l.user_id) {
    await db.from('notification_queue').insert({
      user_id: l.user_id,
      event_type: 'listing_status',
      payload: { listingTitle: l.title, listingSlug: l.slug, status: 'active' },
      channel: 'email',
      batch_key: `status:${l.id}`,
    });
  }
  return true;
}

// -- finds ------------------------------------------------------------------
export async function reviewFind(event: H3Event, findId: string): Promise<ReviewOutcome | null> {
  const db = getServiceClient();
  const { data: f } = await db
    .from('external_listings')
    .select(
      'id, submitted_by, title, description, og_description, category, year, model, price, price_label, source_site, source_url, status'
    )
    .eq('id', findId)
    .maybeSingle();
  if (!f) return null;
  // Duplicates: same site, similar title, found in code.
  const { data: sameSite } = await db
    .from('external_listings')
    .select('id, title, source_url')
    .eq('source_site', f.source_site ?? '')
    .neq('id', f.id)
    .in('status', ['approved', 'pending'])
    .order('created_at', { ascending: false })
    .limit(40);
  const words = new Set(
    str(f.title)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2)
  );
  const candidates: Record<string, string> = {};
  for (const row of sameSite ?? []) {
    const rw = str(row.title)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);
    const overlap = rw.filter((w) => words.has(w)).length;
    if (row.source_url === f.source_url || (words.size && overlap / words.size >= 0.5))
      candidates[row.id] = str(row.title).slice(0, 120);
    if (Object.keys(candidates).length >= 5) break;
  }
  const input: ReviewInput = {
    title: str(f.title),
    description: str(f.description),
    category: f.category ? String(f.category) : null,
    categories: EXCHANGE_CATEGORIES,
    fields: { year: str(f.year), model: str(f.model), price: str(f.price_label || f.price), site: str(f.source_site) },
    findings: yearFinding(f.year),
    trust: await trustLevelOf(f.submitted_by),
    pageText: str(f.og_description),
    duplicateCandidates: candidates,
  };
  const outcome = await reviewSubmission(event, 'finds', f.id, input);
  if (outcome.autoEligible && f.status === 'pending' && outcome.hint && outcome.model) {
    const { error } = await db
      .from('external_listings')
      .update({ status: 'approved', published_at: new Date().toISOString() })
      .eq('id', f.id)
      .eq('status', 'pending');
    if (!error) {
      await db.from('admin_audit_log').insert({
        admin_id: null,
        action: 'find_approved',
        target_type: 'external_listing',
        target_id: f.id,
        details: { title: str(f.title), actor: 'review_gate' },
      });
      await recordReviewHint('finds', f.id, outcome.hint, outcome.model, 'auto');
      return { ...outcome, decision: 'auto' };
    }
  }
  return outcome;
}

// -- wanted -----------------------------------------------------------------
export async function reviewWanted(event: H3Event, wantedId: string): Promise<ReviewOutcome | null> {
  const db = getServiceClient();
  const { data: w } = await db
    .from('wanted_posts')
    .select(
      'id, user_id, title, description, category, parts_subcategory, condition_preference, budget_min, budget_max, currency'
    )
    .eq('id', wantedId)
    .maybeSingle();
  if (!w) return null;
  const input: ReviewInput = {
    title: str(w.title),
    description: str(w.description),
    category: w.category ? String(w.category) : null,
    categories: EXCHANGE_CATEGORIES,
    fields: {
      subcategory: str(w.parts_subcategory),
      condition: str(w.condition_preference),
      budget:
        w.budget_min || w.budget_max ? `${w.currency ?? ''} ${w.budget_min ?? ''}-${w.budget_max ?? ''}`.trim() : '',
    },
    trust: await trustLevelOf(w.user_id),
  };
  // No auto path: the phase 3 screen already decides holds.
  return reviewSubmission(event, 'wanted', w.id, input);
}

// -- archive ----------------------------------------------------------------
const ARCHIVE_TYPES: Record<string, string> = {
  color: 'A paint colour: a name and a factory code.',
  wheel: 'A wheel: name, size, width, offset, maker.',
  registry: 'A registry entry: one real car by body number, year and model.',
  document: 'A reference document: a manual, a wiring diagram, a brochure, a parts list.',
  collection: 'A collection of documents.',
};
export async function reviewArchiveSubmission(
  event: H3Event,
  sub: { id: string; submitted_by: string | null; target_type: string; type: string; data: Record<string, unknown> }
): Promise<ReviewOutcome | null> {
  const d = sub.data ?? {};
  const title = str(d.name || d.title || (d.bodyNum ? `${d.year ?? ''} ${d.model ?? ''} ${d.bodyNum}` : ''));
  const description = str(d.description || d.notes || d.years || d.summary);
  const fields: Record<string, string> = {};
  for (const k of [
    'code',
    'shortCode',
    'ditzlerPpgCode',
    'duluxCode',
    'hexValue',
    'type',
    'size',
    'width',
    'offset',
    'manufacturer',
    'year',
    'model',
    'bodyNum',
    'engineNum',
    'author',
  ]) {
    if (d[k] !== undefined && d[k] !== null && str(d[k]).trim()) fields[k] = str(d[k]).slice(0, 120);
  }
  const findings: string[] = [];
  if (sub.target_type === 'registry') findings.push(...yearFinding(d.year));
  if (sub.target_type === 'color' && d.hexValue && !/^#?[0-9a-f]{6}$/i.test(str(d.hexValue)))
    findings.push('hex value is not a colour');
  const input: ReviewInput = {
    title,
    description,
    category: sub.target_type,
    categories: ARCHIVE_TYPES,
    fields,
    findings,
    trust: await trustLevelOf(sub.submitted_by),
    archiveType: sub.type === 'edit_suggestion' ? `edit to an existing ${sub.target_type}` : sub.target_type,
  };
  // No auto path in this phase: the approve route inserts rows and credits trust; it stays a click.
  return reviewSubmission(event, 'archive', sub.id, input);
}

// -- models -----------------------------------------------------------------
export async function reviewModel(event: H3Event, modelId: string): Promise<ReviewOutcome | null> {
  const db = getServiceClient();
  const [{ data: m }, { data: cats }] = await Promise.all([
    db
      .from('models')
      .select('id, owner_id, title, summary, description, category_slug, tags, license_code, pricing_mode')
      .eq('id', modelId)
      .maybeSingle(),
    db.from('model_categories').select('slug, name'),
  ]);
  if (!m) return null;
  const categories: Record<string, string> = {};
  for (const c of cats ?? []) categories[c.slug] = c.name;
  const input: ReviewInput = {
    title: str(m.title),
    description: `${str(m.summary)}\n\n${str(m.description)}`.trim(),
    category: m.category_slug ? String(m.category_slug) : null,
    categories,
    fields: { tags: (m.tags ?? []).join(', '), licence: str(m.license_code), pricing: str(m.pricing_mode) },
    trust: await trustLevelOf(m.owner_id),
  };
  // Never auto: publishing a model touches Stripe Connect and the entitlement.
  return reviewSubmission(event, 'models', m.id, input);
}
