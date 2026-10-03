/**
 * The dashboard toast key for a failed seller relist.
 *
 * `POST /api/exchange/listings/:id/relist` answers 409 with `data.code`.
 * `$fetch` puts the response body on `error.data`, and h3 puts `createError`'s
 * `data` inside that body, so the code is at `error.data.data.code`.
 */
export function relistErrorKey(error: unknown): string {
  const code = (error as { data?: { data?: { code?: unknown } } } | null | undefined)?.data?.data?.code;
  if (code === 'NOT_APPROVED') return 'toast.relistNotApproved';
  if (code === 'NOT_RELISTABLE') return 'toast.relistNotRelistable';
  if (code === 'CONFLICT') return 'toast.relistConflict';
  return 'toast.relistError';
}
