import { expect, test } from '@playwright/test';
import { gotoHydrated } from './_helpers';

/**
 * The chat, end to end.
 *
 * This file exists because of what the 2026-08-31 rebuild shipped twice. Both
 * defects passed 189 green test files and a clean Cloudflare build, and both
 * were found only by opening a browser:
 *
 *   - `convertToModelMessages` un-awaited (it is async in AI SDK v7, sync in
 *     v6). `streamText` got a Promise, threw inside `standardizePrompt`, and the
 *     route's own error handler turned it into a generic "An error occurred".
 *   - `useChat` destructured a `setMessages` that does not exist, which 500'd
 *     `/chat` on any visit that restored a conversation.
 *
 * Unit tests cannot see either: covering the route means mocking the AI SDK, at
 * which point the mock decides whether the promise resolves.
 *
 * The model is NOT called. Every spec stubs `/api/chat` with a canned UI message
 * stream — the point is the transport, the message shape, persistence and the
 * hydration gate, none of which need real inference. That also keeps the suite
 * free, deterministic, and runnable without an API key.
 */

/** One assistant turn: a tool call, its result, then text. */
function uiMessageStream(text: string, { withToolResult = false } = {}) {
  const lines: string[] = [
    JSON.stringify({ type: 'start' }),
    JSON.stringify({ type: 'start-step' }),
    JSON.stringify({ type: 'text-start', id: 't1' }),
  ];
  if (withToolResult) {
    // The output chunk is only attached to a part the client already knows
    // about, so the input chunk that opens the tool call has to come first.
    lines.push(
      JSON.stringify({
        type: 'tool-input-available',
        toolCallId: 'c1',
        toolName: 'site-search',
        input: { query: 'workshop manuals' },
      })
    );
    lines.push(
      JSON.stringify({
        type: 'tool-output-available',
        toolCallId: 'c1',
        output: {
          query: 'workshop manuals',
          total: 1,
          results: [
            {
              surface: 'archive',
              title: 'Workshop Manuals & Documents',
              summary: 'Scanned manuals and catalogues.',
              url: 'https://www.classicminidiy.com/archive/documents',
              tag: null,
            },
          ],
        },
      })
    );
  }
  for (const word of text.split(' ')) {
    lines.push(JSON.stringify({ type: 'text-delta', id: 't1', delta: `${word} ` }));
  }
  lines.push(JSON.stringify({ type: 'text-end', id: 't1' }));
  lines.push(JSON.stringify({ type: 'finish-step' }));
  lines.push(JSON.stringify({ type: 'finish' }));
  return `${lines.map((line) => `data: ${line}`).join('\n\n')}\n\ndata: [DONE]\n\n`;
}

async function stubChat(page: import('@playwright/test').Page, options: { withToolResult?: boolean } = {}) {
  const requests: any[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: uiMessageStream('Main bearing bolts are 63 lb-ft.', options),
    });
  });
  return requests;
}

const composer = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: /ask me anything/i });

/**
 * Text inside the TRANSCRIPT.
 *
 * `page.getByText` alone is ambiguous here: `ChatHistoryDialog` renders a
 * `<dialog>` that stays in the DOM when closed, and its entry titles are the
 * user's own words — so a question matches both the message bubble and the
 * history row, and Playwright's strict mode fails the assertion.
 */
const transcript = (page: import('@playwright/test').Page) =>
  page.locator('main, body').locator('.whitespace-pre-wrap, .markdown-content');

test.describe('chat', () => {
  test('sends a message and streams a reply', async ({ page }) => {
    await stubChat(page);
    await gotoHydrated(page, '/chat');

    await composer(page).fill('What is the main bearing torque?');
    await composer(page).press('Enter');

    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });
    // The question is echoed back as the user turn — proof the role mapping
    // survived the move from LangGraph's `type: 'human'` to `role: 'user'`.
    await expect(transcript(page).filter({ hasText: 'What is the main bearing torque?' }).first()).toBeVisible();
  });

  test('the header, transcript and composer share one column axis', async ({ page }) => {
    // Everything on this page that holds readable text centres a `max-w-3xl`
    // box with `mx-auto`, and `mx-auto` centres on the parent's CONTENT box.
    // The header spans the shell; the transcript and composer live in the chat
    // column, which is the shell minus the links rail. So without the header
    // reserving the rail's width as padding it centred on a wider box than
    // everything beneath it, and the title and History button sat half the
    // rail's width to the right of the conversation.
    //
    // Asserting over ALL the boxes rather than naming two of them is deliberate:
    // the defect is "these are not one column", and a pairwise check passes
    // while a third box drifts.
    //
    // Only reproduces from `lg` up. Below it there is no rail and the axes
    // coincide, which is why it survived every narrow check.
    await stubChat(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/chat');

    const layout = await page.evaluate(() => {
      // Scoped to the chat shell throughout. `aside` and `textarea` are NOT
      // unique to this page — OnboardingNudge renders an <aside> above <main>
      // in app.vue, and it would satisfy the rail check below while the real
      // rail was missing.
      const shell = document.querySelector('.chat-shell');
      const rail = shell?.querySelector('aside') ?? null;
      return {
        boxes: [...(shell?.querySelectorAll('.max-w-3xl') ?? [])].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), right: Math.round(r.right) };
        }),
        // Structural, not by heading text: the copy is translated into ten
        // locales, so matching /Assistant/i would make this a locale test.
        hasHeading: !!shell?.querySelector('header h1'),
        hasComposer: !!shell?.querySelector('textarea'),
        railVisible: !!rail && getComputedStyle(rail).display !== 'none',
      };
    });

    // Guard the guard, three ways. With the rail hidden every box shares an axis
    // whatever the markup does; with a rotted selector there is nothing to
    // compare. Any of those would let the assertion below pass while proving
    // nothing.
    expect(layout.railVisible).toBe(true);
    expect(layout.hasHeading && layout.hasComposer).toBe(true);
    expect(layout.boxes.length).toBeGreaterThanOrEqual(3);

    // Every reading box, same axis.
    expect(new Set(layout.boxes.map((b) => `${b.x}-${b.right}`)).size).toBe(1);
  });

  test('keeps that axis once the transcript scrolls', async ({ page }) => {
    // The transcript sits inside the scrollport, so where scrollbars take
    // LAYOUT space a scrolling conversation narrows its containing block and
    // re-centres it ~7px left of the header and composer — the same "reading
    // column is not one column" defect as the header, small enough to read as
    // sloppiness, and it blinks in and out as the transcript crosses the scroll
    // threshold. `scrollbar-gutter: stable both-edges` holds the centre.
    await stubChat(page);
    await page.setViewportSize({ width: 1440, height: 600 });
    await gotoHydrated(page, '/chat');

    // Whether this test can prove anything is a property of the BROWSER, not of
    // the page: with overlay scrollbars (macOS, and the headless Chromium that
    // runs this suite) nothing is ever taken from the scrollport, so the
    // assertion below holds with or without the fix. Skip rather than pass —
    // a green vacuous test is worse than an absent one, because it reads as
    // coverage of a defect it cannot see.
    const scrollbarPx = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'overflow-y:scroll;width:100px;height:50px;position:absolute;visibility:hidden';
      document.body.appendChild(probe);
      const width = probe.offsetWidth - probe.clientWidth;
      probe.remove();
      return width;
    });
    test.skip(scrollbarPx === 0, 'overlay scrollbars take no layout space, so the drift cannot occur here');

    // Several turns, because one stubbed exchange fits on a screen. The stub's
    // route persists across sends.
    for (let turn = 0; turn < 4; turn++) {
      await composer(page).fill(`What is the main bearing torque, question ${turn}?`);
      await composer(page).press('Enter');
      await expect(
        transcript(page)
          .filter({ hasText: `question ${turn}` })
          .first()
      ).toBeVisible({
        timeout: 15_000,
      });
    }

    const layout = await page.evaluate(() => {
      const shell = document.querySelector('.chat-shell');
      const scroller = [...(shell?.querySelectorAll('.overflow-y-auto') ?? [])].find((el) =>
        el.querySelector('.max-w-3xl')
      );
      return {
        axes: [...(shell?.querySelectorAll('.max-w-3xl') ?? [])].map((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.x)}-${Math.round(r.right)}`;
        }),
        // The other half of the guard: without a scrollable transcript there is
        // no scrollbar, and this would pass for the empty-state reason.
        scrollable: !!scroller && scroller.scrollHeight > scroller.clientHeight,
      };
    });

    expect(layout.scrollable).toBe(true);
    expect(new Set(layout.axes).size).toBe(1);
  });

  test('posts the conversation and the request context', async ({ page }) => {
    const requests = await stubChat(page);
    await gotoHydrated(page, '/chat');

    await composer(page).fill('Torque please');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });

    expect(requests).toHaveLength(1);
    const body = requests[0];
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.at(-1)).toMatchObject({ role: 'user' });
    // locale and pageSlug are read at send time via a body getter, so a frozen
    // transport would show up here as a missing or stale value.
    expect(body).toMatchObject({ locale: 'en', pageSlug: '/chat' });
    expect(typeof body.threadId).toBe('string');
    expect(body.threadId.length).toBeGreaterThan(0);
  });

  test('restores the conversation after a reload', async ({ page }) => {
    // The exact path that 500'd on `setMessages is not a function`.
    await stubChat(page);
    await gotoHydrated(page, '/chat');
    await composer(page).fill('What is the main bearing torque?');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });

    // Beyond the persist debounce, so the write has landed.
    await page.waitForTimeout(1_000);

    const response = await gotoHydrated(page, '/chat');
    expect(response?.status()).toBe(200);
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible();
    await expect(transcript(page).filter({ hasText: 'What is the main bearing torque?' }).first()).toBeVisible();
  });

  test('new chat clears the transcript', async ({ page }) => {
    await stubChat(page);
    await gotoHydrated(page, '/chat');
    await composer(page).fill('Torque please');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /new chat/i }).click();

    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeHidden();
    await expect(page.getByRole('heading', { name: /how can i help/i })).toBeVisible();
  });

  test('lists the conversation in history', async ({ page }) => {
    await stubChat(page);
    await gotoHydrated(page, '/chat');
    await composer(page).fill('A memorable question');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    await page
      .getByRole('button', { name: /history/i })
      .first()
      .click();
    // Anchored: each row also has a "Delete <title>" button, so an unanchored
    // name matches twice.
    await expect(page.getByRole('button', { name: /^A memorable question/ })).toBeVisible();
  });

  test('fills the links rail from a search tool result', async ({ page }) => {
    // The rail matches on result SHAPE, not tool name — this is what stops it
    // silently emptying when a tool is renamed.
    await stubChat(page, { withToolResult: true });
    await gotoHydrated(page, '/chat');
    await composer(page).fill('Any workshop manuals?');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('link', { name: /Workshop Manuals & Documents/i }).first()).toBeVisible();
  });

  test('surfaces a request failure as chrome, not as an assistant turn', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'boom' }));
    await gotoHydrated(page, '/chat');

    await composer(page).fill('This will fail');
    await composer(page).press('Enter');

    // An alert, not a message bubble: a failure dressed as a reply is
    // indistinguishable from the assistant saying something went wrong.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  });

  test('hydrates without a mismatch when a conversation is stored', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (/hydrat|mismatch/i.test(text)) warnings.push(text);
    });

    await stubChat(page);
    await gotoHydrated(page, '/chat');
    await composer(page).fill('Torque please');
    await composer(page).press('Enter');
    await expect(page.getByText('Main bearing bolts are 63 lb-ft.')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // The reload is the case that matters: the server renders the welcome
    // branch and the client has a stored conversation, which is exactly the
    // mismatch that once corrupted this page's DOM.
    await gotoHydrated(page, '/chat');
    expect(warnings, `hydration warnings: ${warnings.join(' | ')}`).toEqual([]);
  });
});

test.describe('quota limit', () => {
  /** The 429 the route sends when a ceiling is reached. */
  const quotaBody = (tier: 'anonymous' | 'free' | 'member') =>
    JSON.stringify({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'You have reached the limit.',
      data: { tier, used: 15, limit: 15, upgradeUrl: 'https://www.classicminidiy.com/membership' },
    });

  async function stubQuota(page: import('@playwright/test').Page, tier: 'anonymous' | 'free' | 'member') {
    await page.route('**/api/chat', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: quotaBody(tier) })
    );
  }

  test('shows an upgrade panel, not a failure, when the ceiling is reached', async ({ page }) => {
    // The regression this guards: the server sends a structured 429 with an
    // upgrade pointer and the UI used to render "something went wrong, please
    // try again" — advice that can never work, at the one moment membership is
    // genuinely relevant to the reader.
    await stubQuota(page, 'anonymous');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('What is the head torque?');
    await composer(page).press('Enter');

    await expect(page.getByText(/used today's free messages/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('asks an anonymous visitor to sign in, not to subscribe', async ({ page }) => {
    // Selling a subscription to someone who has not made an account skips a
    // step; signing in is free and trebles their allowance.
    await stubQuota(page, 'anonymous');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('hi');
    await composer(page).press('Enter');

    await expect(page.getByRole('link', { name: /^Sign in$/ })).toBeVisible({ timeout: 15_000 });
  });

  test('asks a signed-in free user to become a member', async ({ page }) => {
    await stubQuota(page, 'free');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('hi');
    await composer(page).press('Enter');

    await expect(page.getByRole('link', { name: /Sustaining Member/i })).toBeVisible({ timeout: 15_000 });
  });

  test('tells a member when the allowance resets and sells them nothing', async ({ page }) => {
    await stubQuota(page, 'member');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('hi');
    await composer(page).press('Enter');

    await expect(page.getByText(/resets at the start of next month/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Sustaining Member/i })).toBeHidden();
  });

  test('blocks sending without removing the composer from the tab order', async ({ page }) => {
    // readonly + aria-disabled, NOT disabled: a disabled textarea leaves the tab
    // order and goes unannounced, so the placeholder explaining why it stopped
    // working would be unreachable by the people most reliant on it.
    await stubQuota(page, 'anonymous');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('hi');
    await composer(page).press('Enter');
    await expect(page.getByText(/used today's free messages/i)).toBeVisible({ timeout: 15_000 });

    await expect(composer(page)).toHaveAttribute('readonly', '');
    await expect(composer(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(composer(page)).toBeEditable({ editable: false });
    // Still focusable — that is the whole point of readonly over disabled.
    await composer(page).focus();
    await expect(composer(page)).toBeFocused();
    await expect(page.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  test('keeps the explanation on screen after New chat', async ({ page }) => {
    // Emptying the transcript used to send the render down the empty-state
    // branch and take the panel with it, leaving a disabled composer reading
    // "Message limit reached" above starter prompts that could not be used.
    await stubQuota(page, 'anonymous');
    await gotoHydrated(page, '/chat');
    await composer(page).fill('hi');
    await composer(page).press('Enter');
    await expect(page.getByText(/used today's free messages/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /new chat/i }).click();

    await expect(page.getByText(/used today's free messages/i)).toBeVisible();
    await expect(composer(page)).toBeDisabled();
  });
});
