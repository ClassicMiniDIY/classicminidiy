import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import { ALIGNMENT_MAX_CONFIGS } from '../../../data/models/alignment';

const NUMERIC_FIELDS = ['front_camber', 'front_caster', 'front_toe', 'rear_camber', 'rear_toe'] as const;

/** Coerce arbitrary input into clean journal entries — never trust the client's JSON shape. */
function sanitizeJournal(input: unknown): { id: string; date: string; body: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((e) => e && typeof e === 'object')
    .map((e: any) => ({
      id: String(e.id ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`),
      date: String(e.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
      body: String(e.body ?? '').slice(0, 5000),
    }))
    .slice(0, 200);
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  const { name, wheel_size, preset, notes, journal, is_public } = body;

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
  }

  for (const field of NUMERIC_FIELDS) {
    if (!Number.isFinite(Number(body[field]))) {
      throw createError({ statusCode: 400, statusMessage: `Missing or invalid ${field}` });
    }
  }

  const supabase = getServiceClient();

  // Enforce max configs per user
  const { count, error: countError } = await supabase
    .from('saved_alignment_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check config count' });
  }

  if ((count ?? 0) >= ALIGNMENT_MAX_CONFIGS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum of ${ALIGNMENT_MAX_CONFIGS} saved configurations reached`,
    });
  }

  const { data, error } = await supabase
    .from('saved_alignment_configs')
    .insert({
      user_id: user.id,
      name: name.trim(),
      front_camber: Number(body.front_camber),
      front_caster: Number(body.front_caster),
      front_toe: Number(body.front_toe),
      rear_camber: Number(body.rear_camber),
      rear_toe: Number(body.rear_toe),
      wheel_size: wheel_size != null ? String(wheel_size) : null,
      preset: preset != null ? String(preset) : null,
      notes: notes != null ? String(notes).slice(0, 5000) : null,
      journal: sanitizeJournal(journal),
      is_public: is_public === true,
    })
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create config' });
  }

  return data;
});
