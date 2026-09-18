/**
 * TypeSafe screening for marketplace text that reaches the Worker: wanted
 * posts and seller inquiries. The private-message screen lives in the
 * database (a trigger and the `message-screen` edge function in
 * classicminidiy-supabase); this is the same six questions, the same
 * thresholds, and the same mode switch, applied to the two surfaces that
 * arrive through Nitro routes instead of a browser insert.
 *
 * Programme rules that shape this file (`.claude/rules/typesafe.md`):
 *   - A Jev answer is a hint or a hold, never a rejection or a ban. A wanted
 *     post the screen flags goes to the moderation queue exactly like one the
 *     regex flags; a seller inquiry is an email with nothing to hold, so it is
 *     only logged.
 *   - One switch. `platform_settings.message_screen_mode` (off | shadow |
 *     hold) governs the private-message screen, and this reads the same row,
 *     cached per isolate for a minute, so one edit turns the whole marketplace
 *     screen up or down.
 *   - Off, unconfigured, slow, thrown or malformed all collapse to "no
 *     judgment": the route proceeds as it did before this file existed.
 *   - Nothing but the text and a one-line context leaves the platform.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, noul, score, typesafeConfigured } from '../typesafe';
import { getServiceClient } from '../supabase';

export type ScreenMode = 'off' | 'shadow' | 'hold';
export type ScreenTag = 'impersonation' | 'off_platform' | 'deposit' | 'harassment' | 'severity';

export interface ScreenScores {
  impersonation: number;
  off_platform: number;
  deposit: number;
  harassment: number;
  about_listing: number;
  severity: number;
}

export interface ScreenVerdict {
  mode: ScreenMode;
  /** 'hold' means the thresholds tripped; whether anything is held is the caller's, by mode. */
  decision: 'clear' | 'hold' | 'skipped';
  tags: ScreenTag[];
  scores: ScreenScores | null;
  model: string | null;
  durationMs: number;
}

export interface ScreenThresholds {
  flag: number;
  severity: number;
}

export const DEFAULT_THRESHOLDS: ScreenThresholds = { flag: 0.7, severity: 2 };
/** Longest a route waits for the screen before proceeding without it. */
export const SCREEN_CEILING_MS = 1500;
const SETTINGS_TTL_MS = 60_000;
const TEXT_CHARS = 2000;

let settingsCache: { at: number; mode: ScreenMode; thresholds: ScreenThresholds } | null = null;

export function parseScreenMode(raw: unknown): ScreenMode {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return v === 'hold' || v === 'shadow' ? v : 'off';
}

export function parseThresholds(raw: unknown): ScreenThresholds {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  return {
    flag: num(o.flag, DEFAULT_THRESHOLDS.flag, 0.05, 1),
    severity: num(o.severity, DEFAULT_THRESHOLDS.severity, 0.5, 3),
  };
}

/** The mode and thresholds from `platform_settings`, cached briefly. A read failure is `off`. */
export async function loadScreenSettings(): Promise<{ mode: ScreenMode; thresholds: ScreenThresholds }> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_TTL_MS) return settingsCache;
  try {
    const { data, error } = await getServiceClient()
      .from('platform_settings')
      .select('key, value')
      .in('key', ['message_screen_mode', 'message_screen_thresholds']);
    if (error) throw error;
    const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
    settingsCache = {
      at: now,
      mode: parseScreenMode(map.get('message_screen_mode')),
      thresholds: parseThresholds(map.get('message_screen_thresholds')),
    };
  } catch (e) {
    // A transient read failure must not flip the switch: keep the last good
    // value for another minute. With nothing cached yet the screen is off,
    // which is the same posture the private-message screen has for an
    // unscored row in shadow mode.
    console.warn(
      `[screen] platform_settings read failed; keeping ${settingsCache ? `'${settingsCache.mode}'` : "'off'"} for a minute:`,
      e instanceof Error ? e.message : String(e)
    );
    settingsCache = settingsCache
      ? { ...settingsCache, at: now }
      : { at: now, mode: 'off', thresholds: DEFAULT_THRESHOLDS };
  }
  return settingsCache;
}

/** Test seam. */
export function _resetScreenSettingsCache(): void {
  settingsCache = null;
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** The questions, word for word the ones the edge function asks of a private message. */
export function buildScreenQuestions() {
  return {
    impersonation: noul(
      "Does `text` claim to be from the marketplace itself, its staff, a review or security team, or present itself as an official notice about the reader's account?",
      {
        true: 'It speaks as the platform, its staff, a review or security team, or as an official account notice or warning.',
        false: 'It speaks as an ordinary member: a buyer, a seller, or someone asking about an item.',
      }
    ),
    off_platform: noul(
      'Does `text` ask the reader to continue the conversation or the deal somewhere else: by email, WhatsApp, Telegram, phone, text, or on another website?',
      {
        true: 'It asks to move to email, a messaging app, a phone number, or another site.',
        false: 'It stays on the marketplace, or mentions no other channel.',
      }
    ),
    deposit: noul(
      'Does `text` ask for money, a deposit, a gift card, a transfer, or payment details before the item has been seen, collected or delivered?',
      {
        true: 'It asks for payment, a deposit, a gift card, or bank or card details up front.',
        false: 'It asks for no payment, or only discusses price and how to pay at handover.',
      }
    ),
    harassment: noul('Does `text` threaten, abuse, demean, or sexually harass the reader?', {
      true: 'It contains a threat, abuse, slurs, or sexual harassment aimed at the reader.',
      false: 'It is civil, or at worst blunt, with no threat or abuse.',
    }),
    about_listing: noul(
      'Is `text` plausibly about buying, selling, wanting, viewing, or asking about a classic Mini, a part, or a car for sale?',
      {
        true: 'It is about an item, a sale, a wanted part, a viewing, a price, or shipping.',
        false: 'It has nothing to do with any item or sale.',
      }
    ),
    severity: score('How much harm could come to the reader if they believed `text` and did what it asks?', [
      'None: an ordinary marketplace message; acting on it costs nothing.',
      'Mild: a nuisance or an off-platform nudge, but no money or safety at stake.',
      'Serious: the reader could lose money, share private details, or be deceived about their account.',
      'Severe: the reader could lose significant money or be put in danger.',
    ]),
  };
}

type Answers = {
  impersonation: { noul: number };
  off_platform: { noul: number };
  deposit: { noul: number };
  harassment: { noul: number };
  about_listing: { noul: number };
  severity: { score: number };
};

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Answers → scores → tags under the thresholds. Pure. */
export function decideScreen(
  answers: Answers,
  thresholds: ScreenThresholds
): { decision: 'clear' | 'hold'; tags: ScreenTag[]; scores: ScreenScores } {
  const scores: ScreenScores = {
    impersonation: r3(answers.impersonation.noul),
    off_platform: r3(answers.off_platform.noul),
    deposit: r3(answers.deposit.noul),
    harassment: r3(answers.harassment.noul),
    about_listing: r3(answers.about_listing.noul),
    severity: r3(answers.severity.score),
  };
  const tags: ScreenTag[] = (['impersonation', 'off_platform', 'deposit', 'harassment'] as const).filter(
    (t) => scores[t] >= thresholds.flag
  );
  if (scores.severity >= thresholds.severity) tags.push('severity');
  return { decision: tags.length > 0 ? 'hold' : 'clear', tags, scores };
}

/**
 * Screen one piece of marketplace text. Never throws; a `skipped` decision
 * means the route proceeds exactly as before.
 *
 * `context` is one plain sentence about where the text comes from ("a wanted
 * post asking for a part", "an inquiry sent to a seller about a listing"),
 * so the model reads it as that and not as a private message.
 */
export async function screenMarketplaceText(
  event: H3Event,
  text: string,
  meta: { caller: string; context: string; title?: string | null }
): Promise<ScreenVerdict> {
  const started = Date.now();
  const skipped = (mode: ScreenMode): ScreenVerdict => ({
    mode,
    decision: 'skipped',
    tags: [],
    scores: null,
    model: null,
    durationMs: Date.now() - started,
  });

  const { mode, thresholds } = await loadScreenSettings();
  if (mode === 'off' || !typesafeConfigured(event) || !text.trim()) return skipped(mode);

  const state = {
    text: clip(text, TEXT_CHARS),
    title: meta.title ? clip(meta.title, 200) : '',
    context: `${meta.context} on a classic Mini parts and cars marketplace.`,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREEN_CEILING_MS);
  try {
    const answer = await askTypeSafe(event, state, buildScreenQuestions(), {
      caller: meta.caller,
      signal: controller.signal,
      retry: { maxRetries: 0 },
    });
    const { decision, tags, scores } = decideScreen(answer.answers as unknown as Answers, thresholds);
    return { mode, decision, tags, scores, model: answer.model, durationMs: Date.now() - started };
  } catch (e) {
    if (!controller.signal.aborted) {
      console.warn(`[screen] ${meta.caller} failed:`, e instanceof Error ? e.message : String(e));
    }
    return skipped(mode);
  } finally {
    clearTimeout(timer);
  }
}
