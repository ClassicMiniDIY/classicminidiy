/**
 * GET /api/models/[modelId]/comments  (keystone §11 PR 8)
 *
 * Approved comments for a model, one level of threading, with author display
 * info batch-joined. Public (service role, filtered to approved). Posting/editing
 * happens client-side through the authed Supabase client under RLS; a freshly
 * posted comment is reflected optimistically on the client (a `new`-trust user's
 * comment starts `pending` and only the author sees it until approved).
 */
import { getServiceClient } from '../../../utils/supabase';

interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; displayName: string | null; username: string | null; avatarUrl: string | null } | null;
  replies: CommentNode[];
}

export default defineEventHandler(async (event) => {
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const service = getServiceClient();
  const { data: rows, error } = await service
    .from('model_comments')
    .select('id, parent_id, content, created_at, edited_at, user_id')
    .eq('model_id', modelId)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[models/comments] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Could not load comments' });
  }

  const comments = rows ?? [];
  const authorIds = [...new Set(comments.map((c) => c.user_id))];
  const authorById = new Map<string, CommentNode['author']>();
  if (authorIds.length) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', authorIds);
    for (const p of profiles ?? []) {
      authorById.set(p.id, { id: p.id, displayName: p.display_name, username: p.username, avatarUrl: p.avatar_url });
    }
  }

  // Build one-level threads (parents in insertion order, replies under them).
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const c of comments) {
    nodes.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      author: authorById.get(c.user_id) ?? null,
      replies: [],
    });
  }
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    if (c.parent_id && nodes.has(c.parent_id)) nodes.get(c.parent_id)!.replies.push(node);
    else roots.push(node);
  }

  return { comments: roots, total: comments.length };
});
