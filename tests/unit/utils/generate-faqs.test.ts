import { describe, it, expect } from 'vitest';
import {
  torqueFaqs,
  clearanceFaqs,
  engineCodeFaqs,
  chassisFaqs,
} from '~/app/utils/geo/generateFaqs';
import { buildFaqPage } from '~/app/utils/schema/faqPage';

describe('torqueFaqs', () => {
  const faqs = torqueFaqs();
  it('produces FAQs from real torque data', () => {
    expect(faqs.length).toBeGreaterThan(3);
  });
  it('every entry is a question with an lb-ft answer', () => {
    for (const f of faqs) {
      expect(f.q).toMatch(/torque spec/i);
      expect(f.a).toMatch(/lb-ft/);
      expect(f.q.endsWith('?')).toBe(true);
    }
  });
  it('includes the cylinder head', () => {
    expect(faqs.some((f) => /cylinder head/i.test(f.q))).toBe(true);
  });
});

describe('clearanceFaqs', () => {
  const faqs = clearanceFaqs();
  it('produces FAQs from real clearance data', () => {
    expect(faqs.length).toBeGreaterThan(2);
  });
  it('includes the rocker/valve (tappet) clearance with an inch value', () => {
    const valve = faqs.find((f) => /valve|rocker/i.test(f.q));
    expect(valve).toBeTruthy();
    expect(valve!.a).toContain('"');
  });
});

describe('engineCodeFaqs', () => {
  const faqs = engineCodeFaqs();
  it('produces one FAQ per known displacement that has codes', () => {
    expect(faqs.length).toBeGreaterThanOrEqual(4);
  });
  it('includes a 1275cc entry listing real codes', () => {
    const f = faqs.find((x) => /1275cc/.test(x.q));
    expect(f).toBeTruthy();
    expect(f!.a).toMatch(/\(/); // lists code (description) pairs
  });
});

describe('chassisFaqs', () => {
  const faqs = chassisFaqs();
  it('produces a format FAQ for every era plus synthesized ones', () => {
    // 8 eras + engine-letter + assembly-plant + marque
    expect(faqs.length).toBeGreaterThanOrEqual(10);
  });
  it('every era FAQ has a non-empty example pattern', () => {
    for (const f of faqs.filter((x) => /look like/.test(x.q))) {
      expect(f.a).toMatch(/follows the pattern \S/);
    }
  });
  it('derives the assembly-plant answer from data (Longbridge)', () => {
    const plant = faqs.find((f) => /where my Classic Mini was built/i.test(f.q));
    expect(plant).toBeTruthy();
    expect(plant!.a).toMatch(/Longbridge/);
  });
  it('derives the marque letters (Austin/Morris)', () => {
    const marque = faqs.find((f) => /first letters/i.test(f.q));
    expect(marque).toBeTruthy();
    expect(marque!.a).toMatch(/Austin/);
  });
});

describe('buildFaqPage', () => {
  it('maps Q&As into a valid FAQPage graph', () => {
    const node = buildFaqPage([{ q: 'Q1?', a: 'A1.' }]);
    expect(node).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1.' } }],
    });
  });
  it('drops blank entries and returns null when empty', () => {
    expect(buildFaqPage([{ q: '  ', a: '' }])).toBeNull();
    expect(buildFaqPage([])).toBeNull();
  });
});
