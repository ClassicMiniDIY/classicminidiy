// @vitest-environment node
/**
 * The submission review card: the pure halves (request shape, decision),
 * the settings posture, and the "never breaks the route" rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ask = vi.fn();
const rpc = vi.fn();
const settingsRows = vi.fn();
const config: Record<string, string> = { TYPESAFE_API_KEY: 'k' };

vi.mock('~~/server/utils/typesafe', async () => {
  const actual = await vi.importActual<typeof import('~~/server/utils/typesafe')>('~~/server/utils/typesafe');
  return {
    ...actual,
    askTypeSafe: (...a: unknown[]) => ask(...a),
    typesafeConfigured: () => Boolean(config.TYPESAFE_API_KEY),
  };
});
vi.mock('~~/server/utils/runtimeConfig', () => ({ serverRuntimeConfig: () => config }));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ in: () => Promise.resolve(settingsRows()) }) }),
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

const mod = await import('~~/server/utils/review/card');
const event = {} as any;
const base = {
  title: '1275 cylinder head, skimmed',
  description: 'Unleaded seats, new guides, pressure tested. Collection from Leeds or can post.',
  category: 'parts',
  categories: { vehicle: 'A car', engine: 'An engine', parts: 'A part' },
  trust: 'trusted' as const,
};
const n = (p: number) => ({ noul: p });
const clean = {
  about_mini: n(0.98),
  prohibited: n(0.01),
  scam: n(0.02),
  quality: { score: 1.9, probabilities: { '0': 0.02, '1': 0.08, '2': 0.9 } },
  category: { choice: 'parts', confidence: 0.95 },
  lead: { choice: 'none', confidence: 0.9 },
  condition_matches: n(0.95),
  title_is_item: n(0.97),
  vehicle_plausible: n(0.9),
};

beforeEach(() => {
  ask.mockReset();
  rpc.mockReset();
  settingsRows.mockReset();
  mod._resetReviewSettingsCache();
  config.TYPESAFE_API_KEY = 'k';
  rpc.mockResolvedValue({ data: true, error: null });
  settingsRows.mockReturnValue({ data: [{ key: 'review_gate_listings', value: 'hint' }], error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('buildReviewRequest', () => {
  it('asks the core six on every surface and the extras per surface', () => {
    const core = ['about_mini', 'prohibited', 'scam', 'quality', 'category', 'lead'];
    expect(Object.keys(mod.buildReviewRequest('wanted', base).questions)).toEqual(core);
    expect(Object.keys(mod.buildReviewRequest('listings', base).questions)).toEqual([
      ...core,
      'condition_matches',
      'title_is_item',
      'vehicle_plausible',
    ]);
    expect(
      Object.keys(
        mod.buildReviewRequest('finds', { ...base, pageText: 'x', duplicateCandidates: { a: 'A' } }).questions
      )
    ).toEqual([...core, 'is_listing_page', 'duplicate']);
    expect(Object.keys(mod.buildReviewRequest('archive', { ...base, archiveType: 'color' }).questions)).toEqual([
      ...core,
      'type_fits',
      'same_thing',
      'looks_real',
    ]);
  });

  it('sends the trust level as a word and never an id, and offers `none` for duplicates', () => {
    const r = mod.buildReviewRequest('finds', { ...base, pageText: 'p', duplicateCandidates: { 'id-1': 'Same car' } });
    expect(r.state).toMatchObject({ trust: 'trusted', page_text: 'p' });
    expect(JSON.stringify(r.state)).not.toMatch(/user_id|email/);
    expect(Object.keys((r.questions.duplicate as any).criteria)).toEqual(['none', 'id-1']);
  });
});

describe('decideReview', () => {
  it('clears a clean, complete, correctly filed listing from a trusted member; auto only when the gate is auto', () => {
    const hint = mod.decideReview('listings', base, clean, 'hint');
    expect(hint.decision).toBe('clear');
    expect(hint.autoEligible).toBe(false);
    const auto = mod.decideReview('listings', base, clean, 'auto');
    expect(auto.autoEligible).toBe(true);
    expect(auto.hint.reasons).toEqual([]);
  });

  it('flags on any risk, low quality, a category mismatch, a duplicate or a code finding, with a reason each', () => {
    expect(mod.decideReview('listings', base, { ...clean, scam: n(0.6) }, 'auto').hint.reasons[0]).toMatch(
      /scam pattern \(0.60\)/
    );
    expect(mod.decideReview('listings', base, { ...clean, about_mini: n(0.2) }, 'auto').hint.reasons[0]).toMatch(
      /may not be about a classic Mini/
    );
    expect(
      mod.decideReview(
        'listings',
        base,
        { ...clean, quality: { probabilities: { '0': 0.1, '1': 0.7, '2': 0.2 } } },
        'auto'
      ).hint.reasons[0]
    ).toBe('quality level 1');
    expect(
      mod.decideReview('listings', base, { ...clean, category: { choice: 'engine' } }, 'auto').hint.reasons[0]
    ).toMatch(/reads as "engine", filed as "parts"/);
    const dup = mod.decideReview(
      'finds',
      { ...base, duplicateCandidates: { x: 'Same car' } },
      { ...clean, duplicate: { choice: 'x' } },
      'auto'
    );
    expect(dup.hint.reasons[0]).toMatch(/possible duplicate of Same car/);
    expect(dup.hint.duplicate).toBe('x');
    const finding = mod.decideReview(
      'listings',
      { ...base, findings: ['year 1950 is outside classic Mini production (1959-2000)'] },
      clean,
      'auto'
    );
    expect(finding.decision).toBe('flag');
    expect(finding.autoEligible).toBe(false);
  });

  it('never auto-approves a new member or a model', () => {
    expect(mod.decideReview('listings', { ...base, trust: 'new' }, clean, 'auto').autoEligible).toBe(false);
    expect(mod.decideReview('listings', { ...base, trust: null }, clean, 'auto').autoEligible).toBe(false);
    expect(mod.decideReview('models', base, { ...clean }, 'auto').autoEligible).toBe(false);
  });
});

describe('settings', () => {
  it('parses gates, refuses auto for models, and keeps last-good values on a failed read', async () => {
    expect(mod.parseGate('auto', 'models')).toBe('hint');
    expect(mod.parseGate('AUTO ', 'listings')).toBe('auto');
    expect(mod.parseGate('nonsense', 'finds')).toBe('off');
    settingsRows.mockReturnValueOnce({
      data: [
        { key: 'review_gate_finds', value: 'auto' },
        { key: 'review_gate_thresholds', value: { risk: 0.5, trust: 'contributor' } },
      ],
      error: null,
    });
    const first = await mod.loadReviewSettings();
    expect(first.gates.finds).toBe('auto');
    expect(first.thresholds).toEqual({ risk: 0.5, quality: 2, trust: 'contributor' });
    mod._resetReviewSettingsCache();
    settingsRows.mockReturnValueOnce({ data: null, error: new Error('down') });
    expect((await mod.loadReviewSettings()).gates.finds).toBe('off');
  });
});

describe('reviewSubmission', () => {
  it('is skipped when the gate is off, writes the card when on, and never throws', async () => {
    settingsRows.mockReturnValue({ data: [{ key: 'review_gate_listings', value: 'off' }], error: null });
    expect((await mod.reviewSubmission(event, 'listings', 'id1', base)).decision).toBe('skipped');
    expect(ask).not.toHaveBeenCalled();

    mod._resetReviewSettingsCache();
    settingsRows.mockReturnValue({ data: [{ key: 'review_gate_listings', value: 'hint' }], error: null });
    ask.mockResolvedValue({ answers: clean, model: 'jev-1.13.0', inputTokens: 900, durationMs: 300 });
    const out = await mod.reviewSubmission(event, 'listings', 'id1', base);
    expect(out.decision).toBe('clear');
    expect(out.autoEligible).toBe(false);
    expect(rpc).toHaveBeenCalledWith(
      'record_review_hint',
      expect.objectContaining({ p_surface: 'listings', p_id: 'id1', p_version: 'jev-1.13.0', p_decision: 'clear' })
    );

    ask.mockRejectedValue(new Error('boom'));
    expect((await mod.reviewSubmission(event, 'listings', 'id2', base)).decision).toBe('skipped');
  });
});
