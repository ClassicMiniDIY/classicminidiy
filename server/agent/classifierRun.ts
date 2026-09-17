/**
 * Runs the pre-classifier for one chat request: reads the mode, starts the
 * TypeSafe call, and hands back a handle the route collects with a ceiling.
 *
 * The pure half (state, questions, interpretation, the hint text) is
 * `server/agent/classifier.ts`; this file is the part that touches config,
 * the transcript and the network, and it is written so that NO failure here
 * can reach the reader: off, misconfigured, slow, thrown, or malformed all
 * collapse to "no hint" and a status stamped on the run.
 *
 * Timing. `runClassifier` is called before the quota write and returns at
 * once; `collect()` is awaited just before `streamText`. The TypeSafe round
 * trip measured 350-500 ms in phase 1, the quota write is of the same order,
 * so the common case adds nothing to time-to-first-token. The ceiling below
 * bounds the uncommon case; a late answer is dropped, not waited for.
 */
import type { H3Event } from 'h3';
import type { UIMessage } from 'ai';
import { askTypeSafe, typesafeConfigured } from '../utils/typesafe';
import { serverRuntimeConfig } from '../utils/runtimeConfig';
import {
  analyticsFields,
  buildClassifierRequest,
  hintFor,
  interpret,
  parseClassifierMode,
  type Classification,
  type ClassifierMode,
} from './classifier';

/** Longest the route waits for a classification before answering without it. */
export const CLASSIFIER_CEILING_MS = 900;

export interface ClassifierResult {
  mode: ClassifierMode;
  classification: Classification | null;
  hint: string | null;
  analytics: Record<string, unknown>;
}

export interface ClassifierRun {
  /** The result, or the "went without it" shape, within the ceiling. */
  collect(): Promise<ClassifierResult>;
  /** For a run that ended before `collect()` was awaited (disconnect, upstream error). */
  analyticsSoFar(): Record<string, unknown>;
}

/** The text of a UIMessage, text parts only. Tool parts and files are not the question. */
export function messageText(message: UIMessage | undefined): string {
  if (!message) return '';
  const parts = (message as { parts?: unknown[] }).parts ?? [];
  return parts
    .map((p) => {
      const part = p as { type?: string; text?: string };
      return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** The latest user message and the one before it, as text. */
export function userTurns(messages: UIMessage[]): { latest: string; previous: string } {
  const users = messages.filter((m) => m.role === 'user');
  return {
    latest: messageText(users[users.length - 1]),
    previous: messageText(users[users.length - 2]),
  };
}

const OFF: ClassifierResult = {
  mode: 'off',
  classification: null,
  hint: null,
  analytics: analyticsFields('off', null),
};

export function runClassifier(
  event: H3Event,
  input: { messages: UIMessage[]; pageSlug?: string | null; tools: { name: string; use: string }[] }
): ClassifierRun {
  const mode = parseClassifierMode(serverRuntimeConfig(event).TYPESAFE_CHAT_MODE);
  if (mode === 'off' || !typesafeConfigured(event)) {
    const off = mode === 'off' ? OFF : { ...OFF, analytics: analyticsFields('skipped', null) };
    return { collect: () => Promise.resolve(off), analyticsSoFar: () => off.analytics };
  }

  const { latest, previous } = userTurns(input.messages);
  if (!latest.trim()) {
    const empty = { ...OFF, mode, analytics: analyticsFields('skipped', null) };
    return { collect: () => Promise.resolve(empty), analyticsSoFar: () => empty.analytics };
  }

  const { state, questions, toolNames } = buildClassifierRequest({
    message: latest,
    previous,
    pageSlug: input.pageSlug ?? null,
    tools: input.tools,
  });

  // Started now, not in collect(): the point is to overlap the quota write.
  const controller = new AbortController();
  let settled: ClassifierResult | null = null;
  const started = Date.now();

  const inflight: Promise<ClassifierResult> = askTypeSafe(event, state, questions, {
    caller: 'chat-classifier',
    signal: controller.signal,
  })
    .then((answer) => {
      const classification = interpret(answer.answers as Parameters<typeof interpret>[0], toolNames);
      const hint = mode === 'hint' ? hintFor(classification) : null;
      const result: ClassifierResult = {
        mode,
        classification,
        hint,
        analytics: analyticsFields(mode, classification, {
          durationMs: answer.durationMs,
          inputTokens: answer.inputTokens,
          hinted: Boolean(hint),
        }),
      };
      settled = result;
      return result;
    })
    .catch((error: unknown) => {
      // Logged, never surfaced. A classifier outage must look like the
      // classifier being off, with a different status so it can be counted.
      if (!controller.signal.aborted) {
        console.warn('[chat] classifier failed:', error instanceof Error ? error.message : String(error));
      }
      const result: ClassifierResult = {
        mode,
        classification: null,
        hint: null,
        analytics: analyticsFields(controller.signal.aborted ? 'skipped' : 'error', null, {
          durationMs: Date.now() - started,
        }),
      };
      settled = result;
      return result;
    });

  return {
    async collect() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<ClassifierResult>((resolve) => {
        timer = setTimeout(() => {
          // Late answers are not worth the wait: abort so the SDK stops
          // retrying and the analytics say `skipped`, not `error`.
          controller.abort();
          resolve({
            mode,
            classification: null,
            hint: null,
            analytics: analyticsFields('skipped', null, { durationMs: Date.now() - started }),
          });
        }, CLASSIFIER_CEILING_MS);
      });
      try {
        return await Promise.race([inflight, timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    analyticsSoFar() {
      return settled?.analytics ?? analyticsFields('skipped', null);
    },
  };
}
