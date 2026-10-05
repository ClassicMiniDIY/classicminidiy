// @vitest-environment happy-dom
/**
 * Links from the site to Classic Mini DIY Community (the Discourse forum):
 *  - the "Community" entry in the header (More menu + mobile drawer) and the footer
 *  - the "Discuss this on the community" link on knowledgebase pages
 *    (docs/plans/2026-10-05-community-discuss-links.md)
 */
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommunityDiscussLink from '~/app/components/CommunityDiscussLink.vue';

function mountAt(path: string) {
  vi.stubGlobal('useRoute', () => ({ path, params: {}, query: {} }));
  return mount(CommunityDiscussLink);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CommunityDiscussLink', () => {
  it('links a listed page to the discuss route by key, nofollow, in a new tab', () => {
    const link = mountAt('/technical/torque').find('a');
    expect(link.attributes('href')).toBe('/api/community/discuss?page=technical-torque');
    expect(link.attributes('rel')).toContain('nofollow');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.find('.sr-only').text()).toBe('opens_new_tab');
  });

  it('renders nothing on a page outside the list', () => {
    expect(mountAt('/exchange').find('a').exists()).toBe(false);
    expect(mountAt('/archive/colors/some-colour').find('a').exists()).toBe(false);
  });
});

describe('Community nav and footer links', () => {
  const nav = readFileSync('app/components/MainNav.vue', 'utf8');
  const footer = readFileSync('app/components/Footer.vue', 'utf8');

  it('MainNav lists Community as an external secondary link to the configured forum origin', () => {
    expect(nav).toMatch(/label: t\('navigation\.community'\),[^\n]*to: communityUrl\.value, external: true/);
    expect(nav).toMatch(/runtimeConfig\.public\.discourseUrl/);
  });

  it('MainNav has the community label in all ten locales', () => {
    const block = JSON.parse(nav.match(/<i18n lang="json">\n([\s\S]*?)<\/i18n>/)![1]!);
    for (const locale of ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko']) {
      expect(block[locale].navigation.community, locale).toBeTruthy();
    }
  });

  it('every new-tab link in the nav and footer announces the new tab', () => {
    const navBlock = JSON.parse(nav.match(/<i18n lang="json">\n([\s\S]*?)<\/i18n>/)![1]!);
    for (const locale of ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko']) {
      expect(navBlock[locale].opens_new_tab, locale).toBeTruthy();
    }
    expect(nav.match(/target="_blank"/g)?.length).toBe(
      nav.match(/class="sr-only">\{\{ t\('opens_new_tab'\) \}\}/g)?.length
    );
    expect(footer.match(/opens_new_tab: '/g)).toHaveLength(10);
    expect(footer).toMatch(
      /\{\{ t\('community_link'\) \}\}\s*<span class="sr-only">\{\{ t\('opens_new_tab'\) \}\}<\/span>/
    );
  });

  it('Footer links to the configured forum origin', () => {
    expect(footer).toMatch(/:to="communityUrl"/);
    expect(footer).toMatch(/runtimeConfig\.public\.discourseUrl/);
    expect(footer.match(/community_link: '/g)).toHaveLength(10);
  });
});
