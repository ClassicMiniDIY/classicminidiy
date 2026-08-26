/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// server/utils/archiveApprovals.ts
//
// These decisions used to be covered only through the two routes that called
// them. One of those routes (server/api/colors/queue/save.ts, behind the
// retired /admin/colors/review page) was deleted with the admin consolidation,
// which would have taken its coverage of the SHARED logic with it. The logic is
// the part that was expensive to get wrong — a duplicate colour row reached
// production twice — so it is pinned here, at the level it actually lives at,
// rather than only through whichever route happens to survive.
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://auth.classicminidiy.com';

vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({ public: { supabaseUrl: SUPABASE_URL } }))
);

const {
  isOwnUploadUrl,
  asColorId,
  collectColorAssets,
  mergeContributorImages,
  attachToExistingColor,
  resolveColorTarget,
  UPLOAD_BUCKETS,
} = await import('~~/server/utils/archiveApprovals');

const SUBMISSION = 'sub-1';
const own = (name: string, bucket = 'archive-colors') =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/uploads/${SUBMISSION}/${name}`;

describe('isOwnUploadUrl', () => {
  it('accepts a URL this app minted for this submission, in any upload bucket', () => {
    for (const bucket of UPLOAD_BUCKETS) {
      expect(isOwnUploadUrl(own('a.jpg', bucket), SUBMISSION)).toBe(true);
    }
  });

  // submission_queue.data is browser-written and the INSERT policy only checks
  // auth.uid() = submitted_by, never the payload — so every one of these is
  // reachable from a crafted submission.
  it.each([
    ['an external origin', 'https://evil.example/storage/v1/object/public/archive-colors/uploads/sub-1/a.jpg'],
    ['a bucket outside the allowlist', `${SUPABASE_URL}/storage/v1/object/public/listing-photos/uploads/sub-1/a.jpg`],
    ['another submission’s uploads', `${SUPABASE_URL}/storage/v1/object/public/archive-colors/uploads/sub-2/a.jpg`],
    ['a path outside /uploads', `${SUPABASE_URL}/storage/v1/object/public/archive-colors/curated/sub-1/a.jpg`],
    ['a prefix-matching submission id', `${SUPABASE_URL}/storage/v1/object/public/archive-colors/uploads/sub-10/a.jpg`],
  ])('rejects %s', (_label, url) => {
    expect(isOwnUploadUrl(url, SUBMISSION)).toBe(false);
  });

  it('rejects a non-string', () => {
    for (const value of [null, undefined, 42, {}, ['x']]) {
      expect(isOwnUploadUrl(value, SUBMISSION)).toBe(false);
    }
  });
});

describe('asColorId', () => {
  it('passes a uuid through, trimmed', () => {
    expect(asColorId('  3f2504e0-4f89-41d3-9a0c-0305e82c3301 ')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  // colors.id is a uuid: an unparseable value reaching .eq('id', …) is a
  // Postgres 22P02 that surfaces as an opaque 500 on approval.
  it('treats anything that is not a uuid as absent', () => {
    for (const value of ['', 'not-a-uuid', '123', null, undefined, 42, {}]) {
      expect(asColorId(value)).toBeNull();
    }
  });
});

describe('collectColorAssets', () => {
  it('sorts this submission’s own uploads into swatch and gallery', () => {
    const result = collectColorAssets(
      {
        submittedBy: 'Ada',
        uploadedFiles: [
          { url: own('swatch.png'), category: 'swatch' },
          { url: own('car.jpg'), category: 'car-photos' },
        ],
      },
      SUBMISSION
    );

    expect(result.swatchPath).toBe(own('swatch.png'));
    expect(result.contributorImages).toEqual([{ url: own('car.jpg'), contributor: 'Ada' }]);
  });

  it('drops any asset URL that did not come from this submission’s uploads', () => {
    const result = collectColorAssets(
      {
        imageSwatch: 'https://evil.example/swatch.png',
        images: [own('kept.jpg'), 'https://evil.example/car.jpg'],
      },
      SUBMISSION
    );

    expect(result.swatchPath).toBeNull();
    expect(result.contributorImages).toEqual([{ url: own('kept.jpg'), contributor: null }]);
  });

  // The upload route stamps 'general' when the caller sends no ?category=, but
  // the payload is browser-written, so { url, category: undefined } is
  // reachable — and matching neither arm of the branch silently dropped a
  // legitimate own-upload photo.
  it('treats an own-upload with no category as a gallery photo', () => {
    const result = collectColorAssets({ uploadedFiles: [{ url: own('car.jpg') }] }, SUBMISSION);

    expect(result.contributorImages).toEqual([{ url: own('car.jpg'), contributor: null }]);
  });

  it('ignores an own-upload whose category is not a colour category', () => {
    const result = collectColorAssets({ uploadedFiles: [{ url: own('scan.pdf'), category: 'document' }] }, SUBMISSION);

    expect(result.swatchPath).toBeNull();
    expect(result.contributorImages).toEqual([]);
  });

  it('keeps the first swatch rather than letting a later one replace it', () => {
    const result = collectColorAssets(
      {
        imageSwatch: own('first.png'),
        uploadedFiles: [{ url: own('second.png'), category: 'swatch' }],
      },
      SUBMISSION
    );

    expect(result.swatchPath).toBe(own('first.png'));
    // The rejected swatch is not silently promoted into the gallery either.
    expect(result.contributorImages).toEqual([]);
  });

  it('credits the legacy submitter name when there is no account', () => {
    const result = collectColorAssets({ legacy_submitted_by: 'Grace', images: [own('car.jpg')] }, SUBMISSION);

    expect(result.contributorImages).toEqual([{ url: own('car.jpg'), contributor: 'Grace' }]);
  });
});

describe('mergeContributorImages', () => {
  // Append rather than replace: the gallery accumulates across contributors.
  it('appends to the existing gallery instead of replacing it', () => {
    const merged = mergeContributorImages(
      [{ url: 'https://cdn/existing.jpg', contributor: 'Ada' }],
      [{ url: 'https://cdn/new.jpg', contributor: 'Grace' }]
    );

    expect(merged).toEqual([
      { url: 'https://cdn/existing.jpg', contributor: 'Ada' },
      { url: 'https://cdn/new.jpg', contributor: 'Grace' },
    ]);
  });

  it('dedupes by url so re-approving a submission is not additive', () => {
    const merged = mergeContributorImages(
      [{ url: 'https://cdn/car.jpg', contributor: 'Ada' }],
      [{ url: 'https://cdn/car.jpg', contributor: 'Ada' }]
    );

    expect(merged).toHaveLength(1);
  });

  it('dedupes against bare-string entries left by older payloads', () => {
    const merged = mergeContributorImages(['https://cdn/car.jpg'], [{ url: 'https://cdn/car.jpg' }]);

    expect(merged).toEqual(['https://cdn/car.jpg']);
  });

  it('treats a non-array existing value as an empty gallery', () => {
    expect(mergeContributorImages(null, [{ url: 'https://cdn/a.jpg' }])).toEqual([{ url: 'https://cdn/a.jpg' }]);
  });
});

// ---------------------------------------------------------------------------
// attachToExistingColor / resolveColorTarget
// ---------------------------------------------------------------------------

let updates: Record<string, any> | null;
let filters: Array<[string, unknown]>;
let canned: { data: unknown; error: unknown };

function client() {
  return {
    from: () => {
      const builder: any = {
        select: () => builder,
        update: (v: any) => {
          updates = v;
          return builder;
        },
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return builder;
        },
        maybeSingle: () => Promise.resolve(canned),
        then: (ok: any, err?: any) => Promise.resolve(canned).then(ok, err),
      };
      return builder;
    },
  };
}

beforeEach(() => {
  updates = null;
  filters = [];
  canned = { data: null, error: null };
});

describe('attachToExistingColor', () => {
  const base = { id: 'color-1', contributor_images: [], submitted_by: null, swatch_path: null };

  it('claims an unowned colour for the submitter', async () => {
    await attachToExistingColor(client(), base, [{ url: 'https://cdn/a.jpg' }], null, 'user-1');

    expect(updates?.submitted_by).toBe('user-1');
    expect(filters).toContainEqual(['id', 'color-1']);
  });

  // Overwriting a real value moves another contributor's credit — and, through
  // contributor_archive_items, their trust counters — onto this photo.
  it('never reassigns a colour that already has an owner', async () => {
    await attachToExistingColor(
      client(),
      { ...base, submitted_by: 'user-original' },
      [{ url: 'https://cdn/a.jpg' }],
      null,
      'user-2'
    );

    expect(updates).not.toHaveProperty('submitted_by');
  });

  it('fills a missing swatch and flags it', async () => {
    await attachToExistingColor(client(), base, [], 'https://cdn/swatch.png', null);

    expect(updates?.swatch_path).toBe('https://cdn/swatch.png');
    expect(updates?.has_swatch).toBe(true);
  });

  // A colour that already has a swatch has a curated one.
  it('does not replace a swatch the colour already has', async () => {
    await attachToExistingColor(
      client(),
      { ...base, swatch_path: 'https://cdn/curated.png' },
      [],
      'https://cdn/new.png',
      null
    );

    expect(updates).not.toHaveProperty('swatch_path');
    expect(updates).not.toHaveProperty('has_swatch');
  });

  it('touches no other field on the existing row', async () => {
    await attachToExistingColor(client(), base, [{ url: 'https://cdn/a.jpg' }], 'https://cdn/s.png', 'user-1');

    expect(Object.keys(updates!).sort()).toEqual(
      ['contributor_images', 'has_swatch', 'submitted_by', 'swatch_path'].sort()
    );
  });

  it('returns the error message when the update fails', async () => {
    const failing = {
      from: () => ({
        update: () => ({ eq: () => Promise.resolve({ error: { message: 'nope' } }) }),
      }),
    };

    await expect(attachToExistingColor(failing as any, base, [], null, null)).resolves.toBe('nope');
  });
});

describe('resolveColorTarget', () => {
  it('resolves a uuid to the row it names', async () => {
    canned = { data: { id: 'color-1' }, error: null };

    const result = await resolveColorTarget(client(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');

    expect(result.existing).toEqual({ id: 'color-1' });
    expect(result.error).toBeNull();
  });

  it('reports "not an attach submission" for a missing or non-uuid id, without querying', async () => {
    for (const value of [undefined, null, '', 'not-a-uuid']) {
      filters = [];
      const result = await resolveColorTarget(client(), value);
      expect(result).toEqual({ existing: null, error: null });
      expect(filters).toEqual([]);
    }
  });

  // A stale or deleted id falls through to the caller's INSERT rather than
  // dropping the contribution on the floor.
  it('resolves a stale id to null so the caller still inserts', async () => {
    canned = { data: null, error: null };

    const result = await resolveColorTarget(client(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');

    expect(result).toEqual({ existing: null, error: null });
  });

  it('surfaces a read failure instead of pretending the colour is new', async () => {
    canned = { data: null, error: { message: 'boom' } };

    const result = await resolveColorTarget(client(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');

    expect(result).toEqual({ existing: null, error: 'boom' });
  });
});
