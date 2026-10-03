/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { relistErrorKey } from '~/app/utils/relistError';

// The shape $fetch throws for an h3 createError({ statusCode, data }) body.
const fetchError = (code: unknown) => Object.assign(new Error('409'), { data: { statusCode: 409, data: { code } } });

describe('relistErrorKey', () => {
  it.each([
    ['NOT_APPROVED', 'toast.relistNotApproved'],
    ['NOT_RELISTABLE', 'toast.relistNotRelistable'],
    ['CONFLICT', 'toast.relistConflict'],
  ])('maps the route code %s to its own toast', (code, key) => {
    expect(relistErrorKey(fetchError(code))).toBe(key);
  });

  it.each([
    ['an unknown code', fetchError('SOMETHING_ELSE')],
    ['no data', new Error('network')],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic toast for %s', (_label, error) => {
    expect(relistErrorKey(error)).toBe('toast.relistError');
  });
});
