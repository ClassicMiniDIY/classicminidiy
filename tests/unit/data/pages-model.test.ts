import { describe, it, expect } from 'vitest';
import { PAGE_DESCRIPTIONS, PAGE_CATEGORIES, getPageDescription, getPagesByCategory } from '~/data/models/pages';
import type { PageDescription } from '~/data/models/pages';

// ---------------------------------------------------------------------------
// PAGE_CATEGORIES
// ---------------------------------------------------------------------------
describe('PAGE_CATEGORIES', () => {
  it('HOME equals "home"', () => {
    expect(PAGE_CATEGORIES.HOME).toBe('home');
  });

  it('TECHNICAL equals "technical"', () => {
    expect(PAGE_CATEGORIES.TECHNICAL).toBe('technical');
  });

  it('ARCHIVE equals "archive"', () => {
    expect(PAGE_CATEGORIES.ARCHIVE).toBe('archive');
  });

  it('ADMIN equals "admin"', () => {
    expect(PAGE_CATEGORIES.ADMIN).toBe('admin');
  });

  it('UTILITY equals "utility"', () => {
    expect(PAGE_CATEGORIES.UTILITY).toBe('utility');
  });
});

// ---------------------------------------------------------------------------
// PAGE_DESCRIPTIONS - array shape
// ---------------------------------------------------------------------------
describe('PAGE_DESCRIPTIONS', () => {
  it('is an array', () => {
    expect(Array.isArray(PAGE_DESCRIPTIONS)).toBe(true);
  });

  it('has at least 25 entries', () => {
    expect(PAGE_DESCRIPTIONS.length).toBeGreaterThanOrEqual(25);
  });

  it('each entry has route, title, description, functions, and category', () => {
    for (const page of PAGE_DESCRIPTIONS) {
      expect(typeof page.route).toBe('string');
      expect(page.route.length).toBeGreaterThan(0);
      expect(typeof page.title).toBe('string');
      expect(page.title.length).toBeGreaterThan(0);
      expect(typeof page.description).toBe('string');
      expect(page.description.length).toBeGreaterThan(0);
      expect(Array.isArray(page.functions)).toBe(true);
      expect(page.functions.length).toBeGreaterThan(0);
      expect(typeof page.category).toBe('string');
    }
  });

  it('each functions array contains only strings', () => {
    for (const page of PAGE_DESCRIPTIONS) {
      for (const fn of page.functions) {
        expect(typeof fn).toBe('string');
      }
    }
  });

  it('each category is a valid PAGE_CATEGORIES value', () => {
    const validCategories = Object.values(PAGE_CATEGORIES);
    for (const page of PAGE_DESCRIPTIONS) {
      expect(validCategories).toContain(page.category);
    }
  });

  it('all routes begin with "/"', () => {
    for (const page of PAGE_DESCRIPTIONS) {
      expect(page.route).toMatch(/^\//);
    }
  });

  it('includes the home route "/"', () => {
    const routes = PAGE_DESCRIPTIONS.map((p) => p.route);
    expect(routes).toContain('/');
  });

  it('includes core technical routes', () => {
    const routes = PAGE_DESCRIPTIONS.map((p) => p.route);
    expect(routes).toContain('/technical');
    expect(routes).toContain('/technical/chassis-decoder');
    expect(routes).toContain('/technical/engine-decoder');
    expect(routes).toContain('/technical/compression');
    expect(routes).toContain('/technical/gearing');
    expect(routes).toContain('/technical/needles');
  });

  it('includes core archive routes', () => {
    const routes = PAGE_DESCRIPTIONS.map((p) => p.route);
    expect(routes).toContain('/archive');
    expect(routes).toContain('/archive/colors');
    expect(routes).toContain('/archive/wheels');
    expect(routes).toContain('/archive/registry');
  });

  it('includes admin routes', () => {
    const routes = PAGE_DESCRIPTIONS.map((p) => p.route);
    expect(routes).toContain('/admin/wheels/review');
    expect(routes).toContain('/admin/registry/review');
  });
});

// ---------------------------------------------------------------------------
// getPageDescription
// ---------------------------------------------------------------------------
describe('getPageDescription', () => {
  it('returns the home page for "/"', () => {
    const page = getPageDescription('/');
    expect(page).toBeDefined();
    expect(page!.route).toBe('/');
    expect(page!.category).toBe('home');
  });

  it('returns the correct page for "/technical/chassis-decoder"', () => {
    const page = getPageDescription('/technical/chassis-decoder');
    expect(page).toBeDefined();
    expect(page!.route).toBe('/technical/chassis-decoder');
    expect(page!.category).toBe('technical');
  });

  it('returns the correct page for "/archive/colors"', () => {
    const page = getPageDescription('/archive/colors');
    expect(page).toBeDefined();
    expect(page!.route).toBe('/archive/colors');
  });

  it('returns undefined for a nonexistent route', () => {
    const page = getPageDescription('/nonexistent');
    expect(page).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const page = getPageDescription('');
    expect(page).toBeUndefined();
  });

  it('is case-sensitive (does not match "/TECHNICAL")', () => {
    const page = getPageDescription('/TECHNICAL');
    expect(page).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPagesByCategory
// ---------------------------------------------------------------------------
describe('getPagesByCategory', () => {
  it('returns multiple technical pages', () => {
    const pages = getPagesByCategory('technical');
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.category).toBe('technical');
    }
  });

  it('returns multiple archive pages', () => {
    const pages = getPagesByCategory('archive');
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.category).toBe('archive');
    }
  });

  it('returns admin pages', () => {
    const pages = getPagesByCategory('admin');
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.category).toBe('admin');
    }
  });

  it('returns home pages', () => {
    const pages = getPagesByCategory('home');
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.category).toBe('home');
    }
  });

  it('returns utility pages', () => {
    const pages = getPagesByCategory('utility');
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.category).toBe('utility');
    }
  });

  it('returns an array', () => {
    const pages = getPagesByCategory('technical');
    expect(Array.isArray(pages)).toBe(true);
  });

  it('all returned pages are PageDescription objects', () => {
    const pages = getPagesByCategory('technical');
    for (const page of pages) {
      expect(page).toHaveProperty('route');
      expect(page).toHaveProperty('title');
      expect(page).toHaveProperty('description');
      expect(page).toHaveProperty('functions');
      expect(page).toHaveProperty('category');
    }
  });
});
