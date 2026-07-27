import { requireAdminAuth } from './adminAuth';

/**
 * Marketing email composer gate: standard admin auth PLUS an email allowlist
 * (MARKETING_ADMIN_EMAILS, comma-separated). Mass email is the one admin
 * surface where "any admin" is too broad — only allowlisted accounts (default:
 * the founder) may compose, upload images for, or send marketing mail. Reads
 * of drafts/history stay plain-admin via the marketing_emails RLS SELECT.
 */
export async function requireMarketingAdmin(event: any) {
  const auth = await requireAdminAuth(event);
  const config = useRuntimeConfig();
  const allowlist = ((config.MARKETING_ADMIN_EMAILS as string) || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = auth.user.email?.toLowerCase();
  if (!email || !allowlist.includes(email)) {
    throw createError({ statusCode: 403, statusMessage: 'Marketing admin access required' });
  }
  return auth;
}
