import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('oldRouteRedirect middleware', () => {
  let middleware: (to: any, from: any) => any;

  beforeEach(async () => {
    vi.resetModules();
    // Stub defineNuxtRouteMiddleware to return the handler function directly
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn);
    // Reset navigateTo mock
    vi.stubGlobal(
      'navigateTo',
      vi.fn((path: string) => path)
    );

    const mod = await import('~/app/middleware/oldRouteRedirect.global');
    middleware = mod.default;
  });

  // --- /technical/colors ---
  it('redirects /technical/colors to /archive/colors', () => {
    const result = middleware({ path: '/technical/colors' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/colors', { redirectCode: 301 });
    expect(result).toBeDefined();
  });

  it('redirects /technical/colors/ (with trailing slash) to /archive/colors', () => {
    const result = middleware({ path: '/technical/colors/' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/colors', { redirectCode: 301 });
  });

  // --- /technical/manuals ---
  it('redirects /technical/manuals to /archive/documents?type=manual', () => {
    middleware({ path: '/technical/manuals' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/documents?type=manual', { redirectCode: 301 });
  });

  // --- /technical/wheels ---
  it('redirects /technical/wheels to /archive/wheels', () => {
    middleware({ path: '/technical/wheels' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/wheels', { redirectCode: 301 });
  });

  // --- /technical/electrical ---
  it('redirects /technical/electrical to /archive/electrical', () => {
    middleware({ path: '/technical/electrical' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/electrical', { redirectCode: 301 });
  });

  // --- /technical/engines ---
  it('redirects /technical/engines to /archive/engines', () => {
    middleware({ path: '/technical/engines' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/engines', { redirectCode: 301 });
  });

  // --- /technical/chassisDecoder ---
  it('redirects /technical/chassisDecoder to /technical/chassis-decoder', () => {
    middleware({ path: '/technical/chassisDecoder' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/technical/chassis-decoder', { redirectCode: 301 });
  });

  // --- /technical/chasisDecoder (typo variant) ---
  it('redirects /technical/chasisDecoder (typo) to /technical/chassis-decoder', () => {
    middleware({ path: '/technical/chasisDecoder' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/technical/chassis-decoder', { redirectCode: 301 });
  });

  // --- /technical/engineDecoder ---
  it('redirects /technical/engineDecoder to /technical/engine-decoder', () => {
    middleware({ path: '/technical/engineDecoder' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/technical/engine-decoder', { redirectCode: 301 });
  });

  // --- /registry ---
  it('redirects /registry to /archive/registry', () => {
    middleware({ path: '/registry' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/registry', { redirectCode: 301 });
  });

  it('does NOT redirect /archive/registry (already in archive)', () => {
    const result = middleware({ path: '/archive/registry' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does NOT redirect /admin/registry (admin path)', () => {
    const result = middleware({ path: '/admin/registry' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // --- /archive/carbs ---
  it('redirects /archive/carbs to /archive/documents?type=tuning', () => {
    middleware({ path: '/archive/carbs' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/documents?type=tuning', { redirectCode: 301 });
  });

  // --- Non-matching paths ---
  it('does NOT redirect /about', () => {
    const result = middleware({ path: '/about' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does NOT redirect /', () => {
    const result = middleware({ path: '/' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does NOT redirect /listings', () => {
    const result = middleware({ path: '/listings' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // --- Regression: substring matching hijacked user-generated slugs ---
  //
  // The matcher used `to.path.includes(...)`, so any path CONTAINING one of
  // these patterns was 301'd. Listing and model slugs are written by sellers,
  // and an ordinary Classic Mini ad mentioning a heritage registry produced a
  // slug that was silently redirected off the site — confirmed live in
  // production before the fix. A 301 also tells Google the listing moved
  // permanently, so it lost its indexing.
  it.each([
    '/exchange/listings/1969-cooper-s-with-heritage-registry-certificate',
    '/models/registry-plate-bracket',
    '/exchange/finds/mini-registry-book-for-sale',
    '/archive/documents/the-mini-registry-handbook',
  ])('does NOT redirect %s (user-generated slug containing a pattern)', (path) => {
    const result = middleware({ path }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does NOT redirect /contribute/registry', () => {
    const result = middleware({ path: '/contribute/registry' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // The old matcher fired on a pattern appearing anywhere, so a nested path
  // that merely contained it was redirected as if it were the moved page.
  it('does NOT redirect a path that merely contains technical/colors', () => {
    const result = middleware({ path: '/archive/documents/technical-colors-guide' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // Anchored matching still covers everything beneath a moved path.
  it('redirects sub-paths of a moved section', () => {
    middleware({ path: '/archive/manuals/haynes-workshop-manual' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/documents?type=manual', { redirectCode: 301 });
  });

  it('redirects /registry sub-paths', () => {
    middleware({ path: '/registry/1959' }, {});
    expect(navigateTo).toHaveBeenCalledWith('/archive/registry', { redirectCode: 301 });
  });

  it('does NOT redirect /technical/chassis-decoder (already correct path)', () => {
    const result = middleware({ path: '/technical/chassis-decoder' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does NOT redirect /technical/engine-decoder (already correct path)', () => {
    const result = middleware({ path: '/technical/engine-decoder' }, {});
    expect(navigateTo).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
