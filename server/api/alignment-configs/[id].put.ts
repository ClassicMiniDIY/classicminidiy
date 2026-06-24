import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

const NUMERIC_FIELDS = ['front_camber', 'front_caster', 'front_toe', 'rear_camber', 'rear_toe'] as const;

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
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID required' });
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
    }
  }

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name.trim();

  for (const field of NUMERIC_FIELDS) {
    if (body[field] !== undefined) {
      if (!Number.isFinite(Number(body[field]))) {
        throw createError({ statusCode: 400, statusMessage: `Invalid ${field}` });
      }
      updates[field] = Number(body[field]);
    }
  }

  if (body.wheel_size !== undefined) updates.wheel_size = body.wheel_size != null ? String(body.wheel_size) : null;
  if (body.preset !== undefined) updates.preset = body.preset != null ? String(body.preset) : null;
  if (body.notes !== undefined) updates.notes = body.notes != null ? String(body.notes).slice(0, 5000) : null;
  if (body.journal !== undefined) updates.journal = sanitizeJournal(body.journal);
  if (body.is_public !== undefined) updates.is_public = body.is_public === true;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_alignment_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update config' });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Config not found' });
  }

  return data;
});
