import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { hintSubmissionDuplicates, queueDuplicatesEnabled, type DuplicateHint } from '../../../utils/queueDuplicates';
import { reviewArchiveSubmission } from '../../../utils/review/surfaces';
import { loadReviewSettings } from '../../../utils/review/card';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const targetType = query.targetType?.toString();
  const status = query.status?.toString() || 'pending';

  let q = supabase
    .from('submission_queue')
    .select(
      '*, submitter:profiles!submission_queue_submitted_by_fkey(display_name, avatar_url, trust_level, profile_private ( email ))'
    )
    .order('created_at', { ascending: false });

  if (status !== 'all') q = q.eq('status', status);
  if (targetType) q = q.eq('target_type', targetType);

  const { data, error } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  // Collect any collection_id UUIDs referenced in edit suggestion diffs so we can resolve names
  const collectionIds = new Set<string>();
  for (const item of data || []) {
    if (item.type === 'edit_suggestion' && item.data?.changes?.collection_id) {
      const diff = item.data.changes.collection_id;
      if (diff?.from && diff.from !== '__new__') collectionIds.add(diff.from);
      if (diff?.to && diff.to !== '__new__') collectionIds.add(diff.to);
    }
  }

  // Batch-fetch collection names
  const collectionNames: Record<string, string> = {};
  if (collectionIds.size > 0) {
    const { data: cols } = await supabase
      .from('document_collections')
      .select('id, title')
      .in('id', [...collectionIds]);
    for (const col of cols || []) {
      collectionNames[col.id] = col.title;
    }
  }

  // The duplicate hint for new colour/wheel submissions, filled once per row
  // on the first list load that finds it empty (a few rows at most; the queue
  // is small and each is one TypeSafe call). A row that fails stays empty and
  // is tried again next load. Off unless TYPESAFE_QUEUE_MODE is on.
  const hints = new Map<string, DuplicateHint | null>();
  if (await queueDuplicatesEnabled(event)) {
    const wanting = (data || []).filter(
      (item: any) =>
        item.status === 'pending' &&
        item.type === 'new_item' &&
        (item.target_type === 'color' || item.target_type === 'wheel') &&
        item.duplicate_hint == null
    );
    await Promise.all(
      wanting.slice(0, 5).map(async (item: any) => {
        hints.set(
          item.id,
          await hintSubmissionDuplicates(event, { id: item.id, targetType: item.target_type, data: item.data || {} })
        );
      })
    );
  }

  // The review card, filled lazily for pending rows that have none (the
  // insert is client-side, so there is no server hook at submit time).
  const reviews = new Map<string, unknown>();
  const { gates } = await loadReviewSettings();
  if (gates.archive !== 'off') {
    const unreviewed = (data || []).filter((item: any) => item.status === 'pending' && item.review_hint == null);
    await Promise.all(
      unreviewed.slice(0, 5).map(async (item: any) => {
        const out = await reviewArchiveSubmission(event, {
          id: item.id,
          submitted_by: item.submitted_by,
          target_type: item.target_type,
          type: item.type,
          data: item.data || {},
        }).catch(() => null);
        if (out?.hint) reviews.set(item.id, { hint: out.hint, decision: out.decision });
      })
    );
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    duplicateHint: (hints.get(item.id) ?? item.duplicate_hint ?? null) as DuplicateHint | null,
    reviewHint:
      reviews.get(item.id) ?? (item.review_hint ? { hint: item.review_hint, decision: item.review_decision } : null),
    type: item.type,
    targetType: item.target_type,
    targetId: item.target_id,
    status: item.status,
    data: item.data,
    collectionNames,
    reviewerNotes: item.reviewer_notes,
    reviewedAt: item.reviewed_at,
    createdAt: item.created_at,
    submittedBy: item.submitted_by,
    submitterName: item.submitter?.display_name || item.submitter?.profile_private?.email || 'Unknown',
    submitterEmail: item.submitter?.profile_private?.email || null,
    submitterAvatar: item.submitter?.avatar_url || null,
    submitterTrustLevel: item.submitter?.trust_level || 'new',
  }));
});
