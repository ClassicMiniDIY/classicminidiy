/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decodeDiscoursePayload,
  isValidDiscourseSig,
  isValidDiscourseSsoParam,
  signDiscoursePayload,
  verifyDiscourseSig,
} from '~~/server/utils/discourseConnect';

// ---------------------------------------------------------------------------
// DiscourseConnect wire format (docs/plans/2026-10-03-discourse-sso.md).
// The helpers use Web Crypto. node:crypto appears ONLY here, as an independent
// second implementation to cross-check their output.
// ---------------------------------------------------------------------------

// The worked example from Discourse's DiscourseConnect protocol description.
const SPEC_SECRET = 'd836444a9e4084d5b224a60c208dce14';
// Request: Ruby `encode64` output, trailing line break included in the signed text.
const SPEC_REQUEST_SSO = 'bm9uY2U9Y2I2ODI1MWVlZmI1MjExZTU4YzAwZmYxMzk1ZjBjMGI=\n';
const SPEC_REQUEST_SIG = '2828aa29899722b35a2f191d34ef9b3ce695e0e6eeec47deb46d588d70c7cb56';
// Answer.
const SPEC_ANSWER_PAYLOAD =
  'nonce=cb68251eefb5211e58c00ff1395f0c0b&name=sam&username=samsam&email=test%40test.com&external_id=hello123&require_activation=true';
const SPEC_ANSWER_SSO =
  'bm9uY2U9Y2I2ODI1MWVlZmI1MjExZTU4YzAwZmYxMzk1ZjBjMGImbmFtZT1zYW0mdXNlcm5hbWU9c2Ftc2FtJmVtYWlsPXRlc3QlNDB0ZXN0LmNvbSZleHRlcm5hbF9pZD1oZWxsbzEyMyZyZXF1aXJlX2FjdGl2YXRpb249dHJ1ZQ==';
const SPEC_ANSWER_SIG = '3d7e5ac755a87ae3ccf90272644ed2207984db03cf020377c8b92ff51be3abc3';

const nodeHmac = (secret: string, text: string) => createHmac('sha256', secret).update(text).digest('hex');
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe('fixed vectors (test 13)', () => {
  it('the published vectors agree with node:crypto', () => {
    expect(nodeHmac(SPEC_SECRET, SPEC_REQUEST_SSO)).toBe(SPEC_REQUEST_SIG);
    expect(b64(SPEC_ANSWER_PAYLOAD)).toBe(SPEC_ANSWER_SSO);
    expect(nodeHmac(SPEC_SECRET, SPEC_ANSWER_SSO)).toBe(SPEC_ANSWER_SIG);
  });

  it('signDiscoursePayload reproduces the published answer exactly', async () => {
    const signed = await signDiscoursePayload(new URLSearchParams(SPEC_ANSWER_PAYLOAD), SPEC_SECRET);
    expect(signed).toEqual({ sso: SPEC_ANSWER_SSO, sig: SPEC_ANSWER_SIG });
  });

  it('verifyDiscourseSig accepts the published request (line break and all)', async () => {
    await expect(verifyDiscourseSig(SPEC_REQUEST_SSO, SPEC_REQUEST_SIG, SPEC_SECRET)).resolves.toBe(true);
    expect(decodeDiscoursePayload(SPEC_REQUEST_SSO)?.get('nonce')).toBe('cb68251eefb5211e58c00ff1395f0c0b');
  });

  it('a payload long enough to wrap under encode64 stays on one line, and matches node:crypto', async () => {
    const params = new URLSearchParams({
      nonce: 'a'.repeat(32),
      external_id: '6f1c2a8e-4b1d-4c55-9a7e-0d5f2b1e9c33',
      email: 'someone+forum@example.com',
      username: 'mini-owner',
      name: 'Zoë Mini Owner',
      avatar_url: 'https://example.com/a b.png',
    });
    const signed = await signDiscoursePayload(params, 'k3y');
    expect(signed.sso).not.toMatch(/[\r\n]/);
    expect(signed.sso).toBe(b64(params.toString()));
    expect(signed.sig).toBe(nodeHmac('k3y', signed.sso));
    expect(decodeDiscoursePayload(signed.sso)?.get('name')).toBe('Zoë Mini Owner');
  });
});

describe('verifyDiscourseSig (tests 4-6)', () => {
  const secret = 'shared-secret';
  const sso = b64('nonce=abc&return_sso_url=https%3A%2F%2Fcommunity.example.com%2Fsession%2Fsso_login');
  const sig = nodeHmac(secret, sso);

  it('accepts a correct signature', async () => {
    await expect(verifyDiscourseSig(sso, sig, secret)).resolves.toBe(true);
  });

  it('rejects the wrong secret', async () => {
    await expect(verifyDiscourseSig(sso, sig, 'other-secret')).resolves.toBe(false);
  });

  it('rejects an sso changed by one character after signing', async () => {
    const tampered = (sso[0] === 'b' ? 'c' : 'b') + sso.slice(1);
    await expect(verifyDiscourseSig(tampered, sig, secret)).resolves.toBe(false);
  });

  it('rejects an uppercase or wrong-length sig without verifying', async () => {
    await expect(verifyDiscourseSig(sso, sig.toUpperCase(), secret)).resolves.toBe(false);
    await expect(verifyDiscourseSig(sso, sig.slice(0, 62), secret)).resolves.toBe(false);
    await expect(verifyDiscourseSig(sso, `${sig}00`, secret)).resolves.toBe(false);
  });

  it('rejects an empty secret', async () => {
    await expect(verifyDiscourseSig(sso, nodeHmac('', sso), '')).resolves.toBe(false);
  });
});

describe('format checks', () => {
  it('isValidDiscourseSig wants exactly 64 lowercase hex characters', () => {
    expect(isValidDiscourseSig('a'.repeat(64))).toBe(true);
    expect(isValidDiscourseSig('A'.repeat(64))).toBe(false);
    expect(isValidDiscourseSig('g'.repeat(64))).toBe(false);
    expect(isValidDiscourseSig('a'.repeat(63))).toBe(false);
    expect(isValidDiscourseSig(42)).toBe(false);
  });

  it('isValidDiscourseSsoParam wants base64 under the size limit', () => {
    expect(isValidDiscourseSsoParam(b64('nonce=1'))).toBe(true);
    expect(isValidDiscourseSsoParam(SPEC_REQUEST_SSO)).toBe(true);
    expect(isValidDiscourseSsoParam('')).toBe(false);
    expect(isValidDiscourseSsoParam('not base64!')).toBe(false);
    expect(isValidDiscourseSsoParam('abc')).toBe(false);
    expect(isValidDiscourseSsoParam('A'.repeat(2052))).toBe(false);
    expect(isValidDiscourseSsoParam(null)).toBe(false);
  });

  it('decodeDiscoursePayload returns null for bytes that are not UTF-8', () => {
    expect(decodeDiscoursePayload(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64'))).toBeNull();
  });
});
