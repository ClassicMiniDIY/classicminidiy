/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/discourse/sso — DiscourseConnect identity provider for the forum
// (docs/plans/2026-10-03-discourse-sso.md, tests 1-12a). Requests are signed
// here with node:crypto, independently of the Web Crypto helpers under test.
// ---------------------------------------------------------------------------

const SECRET = 'test-discourse-secret';
const FORUM = 'https://community.example.com';
const RETURN_URL = `${FORUM}/session/sso_login`;
const NONCE = 'cb68251eefb5211e58c00ff1395f0c0b';

const mockRequireUserAuth = vi.fn();
const mockExtractAccessToken = vi.fn();
const profileMaybeSingle = vi.fn();
const rpc = vi.fn();
const profileSelect = vi.fn(() => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }));
const ownerMaybeSingle = vi.fn();
const ownerEqUser = vi.fn(() => ({ maybeSingle: ownerMaybeSingle }));
const ownerEqName = vi.fn(() => ({ eq: ownerEqUser }));
const ownerSelect = vi.fn(() => ({ eq: ownerEqName }));
const mockService = {
  from: vi.fn((table: string) => {
    if (table === 'profiles') return { select: profileSelect };
    if (table === 'reserved_username_owners') return { select: ownerSelect };
    throw new Error(`unexpected table ${table}`);
  }),
  rpc,
};

vi.mock('~/server/utils/userAuth', () => ({
  requireUserAuth: mockRequireUserAuth,
  extractAccessToken: mockExtractAccessToken,
}));
vi.mock('~/server/utils/supabase', () => ({ getServiceClient: () => mockService }));

const readBody = vi.fn();
const getHeader = vi.fn();
const setHeader = vi.fn();
const runtimeConfig = vi.fn();
vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  e.data = opts.data;
  return e;
});
vi.stubGlobal('readBody', readBody);
vi.stubGlobal('getHeader', getHeader);
vi.stubGlobal('setHeader', setHeader);
vi.stubGlobal('useRuntimeConfig', runtimeConfig);

const handler = (await import('~~/server/api/discourse/sso.post')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

const hmac = (text: string, secret = SECRET) => createHmac('sha256', secret).update(text).digest('hex');
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

/** A request as Discourse would send it. */
function signedRequest(fields: Record<string, string> = {}, secret = SECRET) {
  const sso = b64(new URLSearchParams({ nonce: NONCE, return_sso_url: RETURN_URL, ...fields }).toString());
  return { sso, sig: hmac(sso, secret) };
}

/** An access token whose payload carries these `amr` methods (signature irrelevant: GoTrue is mocked). */
function accessToken(methods?: string[]) {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const payload: Record<string, unknown> = { sub: 'user', role: 'authenticated' };
  if (methods) payload.amr = methods.map((method) => ({ method, timestamp: 1767225600 }));
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`;
}

const SUPABASE_URL = 'https://proj.supabase.co';
const AVATAR = `${SUPABASE_URL}/storage/v1/object/public/avatars/6f1c2a8e/avatar.png`;

const user = {
  id: '6f1c2a8e-4b1d-4c55-9a7e-0d5f2b1e9c33',
  email: 'jane.driver@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
};
const profile = { username: 'mini-jane', display_name: 'Jane Driver', avatar_url: AVATAR };

/** Parse the returned redirect, check its signature, and decode its payload. */
function readAnswer(redirect: string) {
  const url = new URL(redirect);
  const sso = url.searchParams.get('sso')!;
  const sig = url.searchParams.get('sig')!;
  return {
    url,
    sso,
    sig,
    sigValid: hmac(sso) === sig,
    payload: new URLSearchParams(Buffer.from(sso, 'base64').toString('utf8')),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  runtimeConfig.mockReturnValue({
    DISCOURSE_CONNECT_SECRET: SECRET,
    public: { discourseUrl: FORUM, supabaseUrl: SUPABASE_URL },
  });
  mockExtractAccessToken.mockReturnValue(accessToken(['otp']));
  getHeader.mockReturnValue(undefined);
  readBody.mockResolvedValue(signedRequest());
  mockRequireUserAuth.mockResolvedValue({ user: { ...user } });
  profileMaybeSingle.mockResolvedValue({ data: { ...profile }, error: null });
  ownerMaybeSingle.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe('a valid request', () => {
  it('returns a redirect to the forum sso_login whose sig verifies over its sso (1)', async () => {
    const res = await handler(evt());
    const answer = readAnswer(res.redirect);
    expect(`${answer.url.origin}${answer.url.pathname}`).toBe(RETURN_URL);
    expect(answer.sigValid).toBe(true);
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'cache-control', 'no-store');
  });

  it('answers with the nonce, identity, username, flair and no line breaks (2)', async () => {
    const res = await handler(evt());
    const { payload, sso } = readAnswer(res.redirect);
    expect(sso).not.toMatch(/[\r\n]/);
    expect(res.redirect).toContain(`sso=${encodeURIComponent(sso)}&`);
    expect(Object.fromEntries(payload)).toEqual({
      nonce: NONCE,
      external_id: user.id,
      email: user.email,
      username: 'mini-jane',
      name: 'Jane Driver',
      avatar_url: AVATAR,
      require_activation: 'false',
      add_groups: 'sustaining_members',
    });
  });

  it('never sends staff, group-list or profile fields', async () => {
    const { payload } = readAnswer((await handler(evt())).redirect);
    for (const key of ['admin', 'moderator', 'groups', 'title', 'bio', 'website', 'location']) {
      expect(payload.has(key)).toBe(false);
    }
  });

  it('checks membership through user_has_subscription for the sustaining product', async () => {
    await handler(evt());
    expect(rpc).toHaveBeenCalledWith('user_has_subscription', {
      p_user_id: user.id,
      p_product_id: 'sustaining',
    });
    expect(profileSelect).toHaveBeenCalledWith('username, display_name, avatar_url');
  });

  it('gives a non-member remove_groups and no add_groups (3)', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.get('remove_groups')).toBe('sustaining_members');
    expect(payload.has('add_groups')).toBe(false);
  });

  it('accepts a forum URL configured with a trailing slash', async () => {
    runtimeConfig.mockReturnValue({ DISCOURSE_CONNECT_SECRET: SECRET, public: { discourseUrl: `${FORUM}/` } });
    await expect(handler(evt())).resolves.toHaveProperty('redirect');
  });
});

describe('request checks (no auth or DB call on failure)', () => {
  const expectNoDownstreamCalls = () => {
    expect(mockRequireUserAuth).not.toHaveBeenCalled();
    expect(mockService.from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  };

  it('wrong sig → 400 bad_signature (4)', async () => {
    readBody.mockResolvedValue(signedRequest({}, 'not-the-secret'));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_signature' } });
    expectNoDownstreamCalls();
  });

  it('sso changed by one character after signing → 400 (5)', async () => {
    const { sso, sig } = signedRequest();
    const tampered = (sso[0] === 'b' ? 'c' : 'b') + sso.slice(1);
    readBody.mockResolvedValue({ sso: tampered, sig });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expectNoDownstreamCalls();
  });

  it.each([
    ['uppercase hex', (sig: string) => sig.toUpperCase()],
    ['too short', (sig: string) => sig.slice(0, 63)],
    ['too long', (sig: string) => `${sig}0`],
  ])('sig in %s → 400 bad_request (6)', async (_label, mangle) => {
    const { sso, sig } = signedRequest();
    readBody.mockResolvedValue({ sso, sig: mangle(sig) });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_request' } });
    expectNoDownstreamCalls();
  });

  it.each([
    ['another origin', 'https://evil.example.net/session/sso_login'],
    ['http instead of https', 'http://community.example.com/session/sso_login'],
    ['a look-alike host', 'https://community.example.com.evil.net/session/sso_login'],
    ['credentials in the URL', 'https://user@community.example.com/session/sso_login'],
    ['a query string', `${RETURN_URL}?next=/x`],
    ['a trailing ?', `${RETURN_URL}?`],
    ['a trailing #', `${RETURN_URL}#`],
    ['a fragment', `${RETURN_URL}#top`],
    ['another path', `${FORUM}/session/sso_login/extra`],
    ['the forum root', `${FORUM}/`],
    ['not a URL', 'session/sso_login'],
  ])('return_sso_url with %s → 400 (7)', async (_label, returnUrl) => {
    readBody.mockResolvedValue(signedRequest({ return_sso_url: returnUrl }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_request' } });
    expectNoDownstreamCalls();
  });

  it('a payload with no nonce → 400', async () => {
    readBody.mockResolvedValue(signedRequest({ nonce: '' }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_request' } });
    expectNoDownstreamCalls();
  });

  it.each([
    ['no body', null],
    ['missing sig', { sso: b64('nonce=1') }],
    ['sso that is not base64', { sso: 'not base64!', sig: 'a'.repeat(64) }],
    ['non-string fields', { sso: 1, sig: 2 }],
  ])('%s → 400 bad_request', async (_label, body) => {
    readBody.mockResolvedValue(body);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_request' } });
    expectNoDownstreamCalls();
  });

  it('a body over 2 KB → 400 bad_request', async () => {
    getHeader.mockImplementation((_e: unknown, name: string) => (name === 'content-length' ? '4096' : undefined));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, data: { error: 'bad_request' } });
    expect(readBody).not.toHaveBeenCalled();
  });

  it.each([
    ['the secret', { DISCOURSE_CONNECT_SECRET: '', public: { discourseUrl: FORUM } }],
    ['the forum URL', { DISCOURSE_CONNECT_SECRET: SECRET, public: { discourseUrl: '' } }],
    [
      'an https forum URL',
      { DISCOURSE_CONNECT_SECRET: SECRET, public: { discourseUrl: 'http://community.example.com' } },
    ],
  ])('without %s → 503 sso_unconfigured (11)', async (_label, config) => {
    runtimeConfig.mockReturnValue(config);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 503, data: { error: 'sso_unconfigured' } });
    expect(readBody).not.toHaveBeenCalled();
    expectNoDownstreamCalls();
  });
});

describe('user checks', () => {
  it('no bearer token → 401 from requireUserAuth (8)', async () => {
    mockRequireUserAuth.mockRejectedValue(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(mockService.from).not.toHaveBeenCalled();
  });

  it('email_confirmed_at null → 403 email_unverified (9)', async () => {
    mockRequireUserAuth.mockResolvedValue({ user: { ...user, email_confirmed_at: null } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403, data: { error: 'email_unverified' } });
    expect(mockService.from).not.toHaveBeenCalled();
  });

  it('no email at all → 403 email_unverified', async () => {
    mockRequireUserAuth.mockResolvedValue({ user: { ...user, email: undefined } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403, data: { error: 'email_unverified' } });
  });

  it('user_has_subscription error → 503 and no redirect (10)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 503,
      data: { error: 'membership_unavailable' },
    });
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('profile read error → 503 and no membership check', async () => {
    profileMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 503, data: { error: 'profile_unavailable' } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['too short', 'jo'],
    ['uppercase', 'Mini-Jane'],
    ['a leading hyphen', '-minijane'],
    ['reserved', 'classicminidiy'],
  ])('username %s → 409 username_required and no redirect (12a)', async (_label, username) => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, username }, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409, data: { error: 'username_required' } });
    expect(rpc).not.toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('a reserved name granted to this user in reserved_username_owners → signs in with it', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, username: 'classicminidiy' }, error: null });
    ownerMaybeSingle.mockResolvedValue({ data: { user_id: 'owner' }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.get('username')).toBe('classicminidiy');
    expect(ownerEqName).toHaveBeenCalledWith('username', 'classicminidiy');
    expect(ownerEqUser).toHaveBeenCalledWith('user_id', user.id);
  });

  it('a failed reserved-name owner read → 503, no redirect', async () => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, username: 'classicminidiy' }, error: null });
    ownerMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 503 });
  });

  it('a non-reserved name never reads the owners table', async () => {
    await handler(evt());
    expect(ownerSelect).not.toHaveBeenCalled();
  });

  it('no profile row → 409 username_required', async () => {
    profileMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409, data: { error: 'username_required' } });
  });
});

describe('optional fields (12)', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['null', null],
    ['the email local part', 'jane.driver'],
    ['the email local part in another case', 'Jane.Driver'],
  ])('display_name %s → no name field', async (_label, displayName) => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, display_name: displayName }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.has('name')).toBe(false);
  });

  it.each([
    ['a storage path', 'avatars/6f1c2a8e/avatar.png'],
    ['an http URL', 'http://cdn.example.com/jane.png'],
    ['null', null],
  ])('avatar_url %s → no avatar_url field', async (_label, avatarUrl) => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, avatar_url: avatarUrl }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.has('avatar_url')).toBe(false);
  });
});

describe('session sign-in methods (amr)', () => {
  it('a session whose methods are all password → 403 reauth_required, no DB call', async () => {
    mockExtractAccessToken.mockReturnValue(accessToken(['password']));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403, data: { error: 'reauth_required' } });
    expect(mockService.from).not.toHaveBeenCalled();
  });

  it('two password entries are still password-only', async () => {
    mockExtractAccessToken.mockReturnValue(accessToken(['password', 'password']));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403, data: { error: 'reauth_required' } });
  });

  it.each([
    ['otp', ['otp']],
    ['oauth', ['oauth']],
    ['magiclink', ['magiclink']],
    ['passkey', ['webauthn']],
    ['password then otp', ['password', 'otp']],
    ['no amr claim', undefined],
  ])('%s → allowed', async (_label, methods) => {
    mockExtractAccessToken.mockReturnValue(accessToken(methods));
    await expect(handler(evt())).resolves.toHaveProperty('redirect');
  });

  it('an unreadable token payload is treated as no amr claim', async () => {
    mockExtractAccessToken.mockReturnValue('not-a-jwt');
    await expect(handler(evt())).resolves.toHaveProperty('redirect');
  });
});

describe('avatar_url allowlist (12)', () => {
  it('forwards the auth custom domain', async () => {
    const avatar = 'https://auth.classicminidiy.com/storage/v1/object/public/avatars/u/a.png';
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, avatar_url: avatar }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.get('avatar_url')).toBe(avatar);
  });

  it('forwards a legacy avatar on the Supabase project host', async () => {
    const avatar = 'https://psoqirvbujwohemmwplv.supabase.co/storage/v1/object/public/avatars/u/a.png';
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, avatar_url: avatar }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.get('avatar_url')).toBe(avatar);
  });

  it.each([
    ['another host', 'https://cdn.example.com/storage/v1/object/public/avatars/u/a.png'],
    ['another storage bucket', `${SUPABASE_URL}/storage/v1/object/public/listing-photos/u/a.png`],
    ['a signed storage URL', `${SUPABASE_URL}/storage/v1/object/sign/avatars/u/a.png`],
    ['http on our host', 'http://proj.supabase.co/storage/v1/object/public/avatars/u/a.png'],
  ])('%s → no avatar_url', async (_label, avatar) => {
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, avatar_url: avatar }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.has('avatar_url')).toBe(false);
  });
});

describe('payload encoding', () => {
  it('a display name with &, = and a newline stays one name field and adds no others', async () => {
    const tricky = 'Jane & co=1\nadmin=true&add_groups=staff';
    profileMaybeSingle.mockResolvedValue({ data: { ...profile, display_name: tricky }, error: null });
    const { payload } = readAnswer((await handler(evt())).redirect);
    expect(payload.getAll('name')).toEqual([tricky]);
    expect(payload.has('admin')).toBe(false);
    expect(payload.getAll('add_groups')).toEqual(['sustaining_members']);
    expect([...payload.keys()].sort()).toEqual(
      ['add_groups', 'avatar_url', 'email', 'external_id', 'name', 'nonce', 'require_activation', 'username'].sort()
    );
  });
});
