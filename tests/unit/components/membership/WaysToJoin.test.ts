// @vitest-environment happy-dom
/**
 * "Ways to join" on /membership (membership clarity §3, §4.1), rendered with
 * the component's real English messages so the assertions read the words a
 * customer reads.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import WaysToJoin from '~/app/components/membership/WaysToJoin.vue';

const SOURCE = readFileSync('app/components/membership/WaysToJoin.vue', 'utf8');
const BLOCK = JSON.parse(SOURCE.match(/<i18n lang="json">\n([\s\S]*?)<\/i18n>/)![1]!);

function tFor(locale: string) {
  return (key: string) => {
    const value = key.split('.').reduce<any>((node, part) => node?.[part], BLOCK[locale]);
    return typeof value === 'string' ? value : key;
  };
}

function mountIn(locale = 'en') {
  vi.stubGlobal('useI18n', () => ({ t: tFor(locale), locale: ref(locale) }));
  return mount(WaysToJoin);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WaysToJoin', () => {
  it('leads with "One membership covers all your cars and devices."', () => {
    const wrapper = mountIn();
    expect(wrapper.find('[data-testid="ways-lead"]').text()).toBe('One membership covers all your cars and devices.');
  });

  it('has the three channel columns in order', () => {
    const wrapper = mountIn();
    const heads = wrapper.findAll('thead th').map((th) => th.text());
    expect(heads.slice(1)).toEqual(['Website / apps', 'Patreon', 'YouTube']);
  });

  it('has the five rows from the design', () => {
    const wrapper = mountIn();
    const rows = wrapper.findAll('tbody th[scope="row"]').map((th) => th.text());
    expect(rows).toEqual([
      'Price per level',
      'Core benefits',
      'Channel extras',
      'How your site account is linked',
      'Where to manage billing and cancellation',
    ]);
  });

  it('prices each level per channel, and the website has no Pro Supporter', () => {
    const wrapper = mountIn();
    const cell = (c: string) => wrapper.find(`td[data-channel="${c}"]`).text();
    expect(cell('web')).toContain('Member$1.99/month');
    expect(cell('web')).toContain('Plus$4.99/month');
    expect(cell('web')).toContain('Pro$9.99/month');
    expect(cell('web')).toContain('Pro SupporterNot offered');
    expect(cell('patreon')).toContain('Member$2/month');
    expect(cell('patreon')).toContain('Pro Supporter$25/month');
    expect(cell('youtube')).toContain('Pro Supporter$24.99/month');
  });

  it('lists the core benefits once, across all three columns', () => {
    const wrapper = mountIn();
    const coreCells = wrapper.findAll('td[colspan="3"]');
    expect(coreCells).toHaveLength(1);
    const text = coreCells[0]!.text();
    for (const benefit of [
      'The Sustaining Member badge',
      'Members-only Discord',
      'Members-only blog posts',
      'Early access to videos',
      'Free premium listings on The Mini Exchange',
      'Maintenance sync in the apps',
      'The DIY Mini Bot allowance for your level',
    ]) {
      expect(text).toContain(benefit);
    }
  });

  it('states how each channel links the site account', () => {
    const wrapper = mountIn();
    expect(wrapper.find('td[data-link="web"]').text()).toBe('Automatic.');
    expect(wrapper.find('td[data-link="patreon"]').text()).toContain('Patreon email matches your account');
    expect(wrapper.find('td[data-link="patreon"]').text()).toContain('claim email');
    expect(wrapper.find('td[data-link="youtube"]').text()).toBe('Coming soon');
  });

  it('shows the three rules', () => {
    const wrapper = mountIn();
    expect(wrapper.findAll('[data-testid="ways-rules"] li').map((li) => li.text())).toEqual([
      'Pick one platform, not several.',
      'Website and app members do not need YouTube "Join" too.',
      'To move platforms, join the new one before you cancel the old one.',
    ]);
  });

  it('names no vendor a customer does not know', () => {
    const text = mountIn().text();
    expect(text).not.toContain('Ghost');
    expect(text).not.toContain('Stripe');
    expect(text).not.toMatch(/tip jar/i);
  });

  it('keeps the table in its own scroll box, never the page', () => {
    const wrapper = mountIn();
    expect(wrapper.find('table').element.parentElement!.classList.contains('overflow-x-auto')).toBe(true);
  });

  it('uses one Spanish term for Sustaining Member', () => {
    expect(mountIn('es').text()).toContain('La insignia de Socio Colaborador');
  });
});
