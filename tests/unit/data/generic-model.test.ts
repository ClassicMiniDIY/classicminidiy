import { describe, it, expect } from 'vitest';
import {
  BREADCRUMB_VERSIONS,
  HERO_TYPES,
  DRAWER_TYPES,
  SocialShareData,
  SocialItems,
  MobileMenuItems,
  ToolboxItems,
  ArchiveItems,
  LandingPageToolboxItems,
} from '~/data/models/generic';
import type { Post, ToolboxItem, MobileMenuItem, ArchiveItem, SocialItem } from '~/data/models/generic';

// ---------------------------------------------------------------------------
// BREADCRUMB_VERSIONS
// ---------------------------------------------------------------------------
describe('BREADCRUMB_VERSIONS', () => {
  it('TECH equals "technical"', () => {
    expect(BREADCRUMB_VERSIONS.TECH).toBe('technical');
  });

  it('ARCHIVE equals "archive"', () => {
    expect(BREADCRUMB_VERSIONS.ARCHIVE).toBe('archive');
  });

  it('ADMIN equals "admin"', () => {
    expect(BREADCRUMB_VERSIONS.ADMIN).toBe('admin');
  });

  it('PROFILE equals "profile"', () => {
    expect(BREADCRUMB_VERSIONS.PROFILE).toBe('profile');
  });
});

// ---------------------------------------------------------------------------
// HERO_TYPES
// ---------------------------------------------------------------------------
describe('HERO_TYPES', () => {
  it('HOME equals "home"', () => {
    expect(HERO_TYPES.HOME).toBe('home');
  });

  it('TECH equals "tech"', () => {
    expect(HERO_TYPES.TECH).toBe('tech');
  });

  it('ARCHIVE equals "archive"', () => {
    expect(HERO_TYPES.ARCHIVE).toBe('archive');
  });

  it('BLOG equals "blog"', () => {
    expect(HERO_TYPES.BLOG).toBe('blog');
  });

  it('MAPS equals "maps"', () => {
    expect(HERO_TYPES.MAPS).toBe('maps');
  });

  it('CONTACT equals "contact"', () => {
    expect(HERO_TYPES.CONTACT).toBe('contact');
  });
});

// ---------------------------------------------------------------------------
// DRAWER_TYPES
// ---------------------------------------------------------------------------
describe('DRAWER_TYPES', () => {
  it('HOME equals "home"', () => {
    expect(DRAWER_TYPES.HOME).toBe('home');
  });

  it('ARCHIVE equals "archive"', () => {
    expect(DRAWER_TYPES.ARCHIVE).toBe('archive');
  });

  it('TOOLBOX equals "toolbox"', () => {
    expect(DRAWER_TYPES.TOOLBOX).toBe('toolbox');
  });
});

// ---------------------------------------------------------------------------
// SocialShareData
// ---------------------------------------------------------------------------
describe('SocialShareData', () => {
  it('is an object', () => {
    expect(typeof SocialShareData).toBe('object');
  });

  it('has a preUrl string', () => {
    expect(typeof SocialShareData.preUrl).toBe('string');
    expect(SocialShareData.preUrl.length).toBeGreaterThan(0);
  });

  it('has a postUrl string', () => {
    expect(typeof SocialShareData.postUrl).toBe('string');
    expect(SocialShareData.postUrl.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SocialItems
// ---------------------------------------------------------------------------
describe('SocialItems', () => {
  it('has 4 items', () => {
    expect(SocialItems).toHaveLength(4);
  });

  it('each item has title, href, and icon', () => {
    for (const item of SocialItems) {
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe('string');
      expect(item.href.length).toBeGreaterThan(0);
      expect(typeof item.icon).toBe('string');
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it('includes YouTube, Patreon, Instagram, and Facebook entries', () => {
    const titles = SocialItems.map((i) => i.title);
    expect(titles.some((t) => t.includes('Youtube'))).toBe(true);
    expect(titles.some((t) => t.includes('Patreon'))).toBe(true);
    expect(titles.some((t) => t.includes('Instagram'))).toBe(true);
    expect(titles.some((t) => t.includes('Facebook'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MobileMenuItems
// ---------------------------------------------------------------------------
describe('MobileMenuItems', () => {
  it('has 3 items', () => {
    expect(MobileMenuItems).toHaveLength(3);
  });

  it('each item has title, iconHtml, and drawer', () => {
    for (const item of MobileMenuItems) {
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.iconHtml).toBe('string');
      expect(item.iconHtml.length).toBeGreaterThan(0);
      expect(typeof item.drawer).toBe('string');
    }
  });

  it('drawer values are valid DRAWER_TYPES members', () => {
    const validValues = Object.values(DRAWER_TYPES);
    for (const item of MobileMenuItems) {
      expect(validValues).toContain(item.drawer);
    }
  });
});

// ---------------------------------------------------------------------------
// ToolboxItems
// ---------------------------------------------------------------------------
describe('ToolboxItems', () => {
  it('has 8 items', () => {
    expect(ToolboxItems).toHaveLength(8);
  });

  it('each item has titleKey, path, iconHtml, and to', () => {
    for (const item of ToolboxItems) {
      expect(typeof item.titleKey).toBe('string');
      expect(item.titleKey.length).toBeGreaterThan(0);
      expect(typeof item.path).toBe('string');
      expect(item.path.length).toBeGreaterThan(0);
      expect(typeof item.iconHtml).toBe('string');
      expect(item.iconHtml.length).toBeGreaterThan(0);
      expect(typeof item.to).toBe('string');
      expect(item.to.length).toBeGreaterThan(0);
    }
  });

  it('path and to are the same value for all items', () => {
    for (const item of ToolboxItems) {
      expect(item.path).toBe(item.to);
    }
  });

  it('includes expected technical routes', () => {
    const paths = ToolboxItems.map((i) => i.path);
    expect(paths).toContain('/technical/torque');
    expect(paths).toContain('/technical/gearing');
    expect(paths).toContain('/technical/compression');
    expect(paths).toContain('/technical/needles');
    expect(paths).toContain('/technical/chassis-decoder');
    expect(paths).toContain('/technical/engine-decoder');
    expect(paths).toContain('/technical/parts');
    expect(paths).toContain('/technical/clearance');
  });
});

// ---------------------------------------------------------------------------
// ArchiveItems
// ---------------------------------------------------------------------------
describe('ArchiveItems', () => {
  it('has 7 items', () => {
    expect(ArchiveItems).toHaveLength(7);
  });

  it('each item has title, path, iconHtml, to, description, and image', () => {
    for (const item of ArchiveItems) {
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.path).toBe('string');
      expect(item.path.length).toBeGreaterThan(0);
      expect(typeof item.iconHtml).toBe('string');
      expect(item.iconHtml.length).toBeGreaterThan(0);
      expect(typeof item.to).toBe('string');
      expect(item.to.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(typeof item.image).toBe('string');
    }
  });

  it('includes expected archive routes', () => {
    const paths = ArchiveItems.map((i) => i.path);
    expect(paths).toContain('/archive/registry');
    expect(paths).toContain('/archive/wheels');
    expect(paths).toContain('/archive/colors');
    expect(paths).toContain('/archive/electrical');
    expect(paths).toContain('/archive/engines');
  });

  it('disabled property, when present, is a boolean', () => {
    for (const item of ArchiveItems) {
      if ('disabled' in item) {
        expect(typeof item.disabled).toBe('boolean');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// LandingPageToolboxItems
// ---------------------------------------------------------------------------
describe('LandingPageToolboxItems', () => {
  it('has 10 items', () => {
    expect(LandingPageToolboxItems).toHaveLength(10);
  });

  it('each item has title, image, webp, and to', () => {
    for (const item of LandingPageToolboxItems) {
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.image).toBe('string');
      expect(item.image.length).toBeGreaterThan(0);
      expect(typeof item.webp).toBe('string');
      expect(item.webp.length).toBeGreaterThan(0);
      expect(typeof item.to).toBe('string');
      expect(item.to.length).toBeGreaterThan(0);
    }
  });

  it('image and webp are URLs', () => {
    for (const item of LandingPageToolboxItems) {
      expect(item.image).toMatch(/^https?:\/\//);
      expect(item.webp).toMatch(/^https?:\/\//);
    }
  });
});

// ---------------------------------------------------------------------------
// Interface type guards (compile-time structural check via assignment)
// ---------------------------------------------------------------------------
describe('Interface structural contracts', () => {
  it('Post interface accepts expected fields', () => {
    const post: Post = {
      title: 'Test Post',
      path: '/test',
      description: 'A test post',
    };
    expect(post.title).toBe('Test Post');
  });

  it('SocialItem interface has required fields', () => {
    const item: SocialItem = { title: 'Test', href: 'https://example.com', icon: 'fab fa-test' };
    expect(item.href).toContain('https');
  });

  it('ToolboxItem interface has required fields', () => {
    const item: ToolboxItem = { titleKey: 'key', path: '/path', iconHtml: '<i/>', to: '/path' };
    expect(item.titleKey).toBe('key');
  });

  it('MobileMenuItem interface has required fields', () => {
    const item: MobileMenuItem = { title: 'Title', iconHtml: '<i/>', drawer: DRAWER_TYPES.HOME };
    expect(item.drawer).toBe(DRAWER_TYPES.HOME);
  });

  it('ArchiveItem interface has required fields', () => {
    const item: ArchiveItem = {
      title: 'Archive',
      path: '/archive',
      iconHtml: '<i/>',
      to: '/archive',
      description: 'Desc',
      image: 'img.jpg',
    };
    expect(item.title).toBe('Archive');
  });
});
