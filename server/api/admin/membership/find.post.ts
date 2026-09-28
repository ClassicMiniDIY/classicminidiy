/**
 * POST /api/admin/membership/find  { q }  →  { results, truncated }
 *
 * POST, not GET: the query is usually an email, and a query string would copy
 * it into Worker request logs, log drains and browser history.
 *
 * Support lookup for /admin/membership (membership clarity §8). Finds a person
 * by any email they use, a Discord username, a store or Stripe reference, or a
 * user id — never by name. The contract and the three row kinds are documented
 * in `shared/utils/memberLookup.ts`.
 *
 * Service client after `requireAdminAuth`, like the reference-data admin
 * reads: `admin_find_member` is EXECUTE for `service_role` only, and it reads
 * `auth.users`, which no browser role can.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import {
  MEMBER_LOOKUP_LIMIT,
  MEMBER_LOOKUP_MAX_QUERY,
  MEMBER_LOOKUP_MIN_QUERY,
  normaliseMemberLookupQuery,
  normaliseMemberLookupRow,
  type MemberLookupResponse,
  type MemberLookupRow,
} from '../../../../shared/utils/memberLookup';

export default defineEventHandler(async (event): Promise<MemberLookupResponse> => {
  await requireAdminAuth(event);

  const body = await readBody<{ q?: unknown } | null>(event);
  const q = normaliseMemberLookupQuery(body?.q);
  if (q === null) {
    throw createError({
      statusCode: 400,
      statusMessage: `Search needs ${MEMBER_LOOKUP_MIN_QUERY} to ${MEMBER_LOOKUP_MAX_QUERY} characters`,
    });
  }

  const db = getServiceClient();
  const { data, error } = await db.rpc('admin_find_member', { p_query: q });
  if (error) {
    // 22023 is the RPC's own short-query refusal: a bad request, not an outage.
    if (error.code === '22023') throw createError({ statusCode: 400, statusMessage: error.message });
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  // The generated type has the jsonb columns as Json; normaliseMemberLookupRow
  // checks and narrows each row, so the cast goes through unknown.
  const rows = Array.isArray(data) ? (data as unknown as Partial<MemberLookupRow>[]) : [];
  return {
    results: rows.slice(0, MEMBER_LOOKUP_LIMIT).map(normaliseMemberLookupRow),
    truncated: rows.length > MEMBER_LOOKUP_LIMIT,
  };
});
