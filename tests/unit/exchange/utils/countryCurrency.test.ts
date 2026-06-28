/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { currencyForCountry } from '~~/app/utils/countryCurrency';

describe('currencyForCountry — known countries', () => {
  it.each([
    // GBP
    ['united kingdom', 'GBP'],
    ['uk', 'GBP'],
    ['great britain', 'GBP'],
    ['england', 'GBP'],
    ['scotland', 'GBP'],
    ['wales', 'GBP'],
    ['northern ireland', 'GBP'],
    // USD
    ['united states', 'USD'],
    ['usa', 'USD'],
    ['america', 'USD'],
    // EUR (eurozone) — full set from the map
    ['ireland', 'EUR'],
    ['germany', 'EUR'],
    ['france', 'EUR'],
    ['netherlands', 'EUR'],
    ['the netherlands', 'EUR'],
    ['holland', 'EUR'],
    ['belgium', 'EUR'],
    ['italy', 'EUR'],
    ['spain', 'EUR'],
    ['portugal', 'EUR'],
    ['austria', 'EUR'],
    ['finland', 'EUR'],
    ['luxembourg', 'EUR'],
    ['greece', 'EUR'],
    ['malta', 'EUR'],
    ['cyprus', 'EUR'],
    ['estonia', 'EUR'],
    ['latvia', 'EUR'],
    ['lithuania', 'EUR'],
    ['slovakia', 'EUR'],
    ['slovenia', 'EUR'],
    ['croatia', 'EUR'],
    // AUD / NZD / CAD
    ['australia', 'AUD'],
    ['new zealand', 'NZD'],
    ['canada', 'CAD'],
    // CHF / SEK / NOK
    ['switzerland', 'CHF'],
    ['sweden', 'SEK'],
    ['norway', 'NOK'],
    // JPY / CNY / HKD / SGD / KRW
    ['japan', 'JPY'],
    ['china', 'CNY'],
    ['hong kong', 'HKD'],
    ['singapore', 'SGD'],
    ['south korea', 'KRW'],
    ['korea', 'KRW'],
    // MXN
    ['mexico', 'MXN'],
  ])('maps %s -> %s', (country, expected) => {
    expect(currencyForCountry(country)).toBe(expected);
  });
});

describe('currencyForCountry — case sensitivity & normalization', () => {
  it.each([
    ['UNITED KINGDOM', 'GBP'],
    ['United Kingdom', 'GBP'],
    ['United States', 'USD'],
    ['USA', 'USD'],
    ['Uk', 'GBP'],
    ['UK', 'GBP'],
    ['GeRmAnY', 'EUR'],
    ['HONG KONG', 'HKD'],
    ['South Korea', 'KRW'],
  ])('is case-insensitive: %s -> %s', (country, expected) => {
    expect(currencyForCountry(country)).toBe(expected);
  });

  it.each([
    ['  united kingdom  ', 'GBP'],
    ['\tusa\n', 'USD'],
    [' Germany ', 'EUR'],
    ['  ', undefined], // whitespace-only trims to empty -> no match
  ])('trims surrounding whitespace: %j -> %s', (country, expected) => {
    expect(currencyForCountry(country)).toBe(expected);
  });

  it('combines trim + lowercase', () => {
    expect(currencyForCountry('  GREAT Britain  ')).toBe('GBP');
  });
});

describe('currencyForCountry — fallback / falsy input returns undefined', () => {
  it.each([
    [null],
    [undefined],
    [''],
  ])('returns undefined for falsy input %j', (country) => {
    expect(currencyForCountry(country as string | null | undefined)).toBeUndefined();
  });
});

describe('currencyForCountry — unknown / unsupported countries return undefined', () => {
  it.each([
    'brazil', // real currency BRL not supported
    'india', // INR not supported
    'russia',
    'argentina',
    'south africa',
    'narnia', // not a real country
    'united', // partial token, not a key
    'kingdom',
    'us', // not a key (only "usa"/"united states")
    'gb', // not a key
    'eu',
    'europe',
    'unitedkingdom', // no internal space normalization
    'united  kingdom', // double internal space not collapsed
    '123',
    '!!!',
    '日本', // Japan in Japanese — not a key (only "japan")
    '🇬🇧', // emoji flag
    'a'.repeat(5000), // very long string
  ])('returns undefined for %j', (country) => {
    expect(currencyForCountry(country)).toBeUndefined();
  });
});

describe('currencyForCountry — invariant: only app-supported currency codes are returned', () => {
  const SUPPORTED = new Set([
    'GBP',
    'USD',
    'EUR',
    'AUD',
    'NZD',
    'CAD',
    'CHF',
    'SEK',
    'NOK',
    'JPY',
    'CNY',
    'HKD',
    'SGD',
    'KRW',
    'MXN',
  ]);

  it.each([
    'united kingdom',
    'united states',
    'germany',
    'australia',
    'new zealand',
    'canada',
    'switzerland',
    'sweden',
    'norway',
    'japan',
    'china',
    'hong kong',
    'singapore',
    'south korea',
    'mexico',
  ])('result for %s is a supported currency code', (country) => {
    const code = currencyForCountry(country);
    expect(code).toBeDefined();
    expect(SUPPORTED.has(code as string)).toBe(true);
  });

  it('never returns an empty string', () => {
    // A matched key always yields a non-empty code; a miss yields undefined.
    expect(currencyForCountry('united kingdom')).not.toBe('');
    expect(currencyForCountry('nowhere')).toBeUndefined();
  });
});

describe('currencyForCountry — no Object.prototype key leak', () => {
  // Regression guard: bracket lookup is own-property-guarded (Object.hasOwn), so
  // inherited prototype members never leak as a return value. Every prototype
  // key — including the previously-leaking 'constructor'/'__proto__' — must be
  // undefined, satisfying the declared `CurrencyCode | undefined` contract.
  it.each([
    'toString',
    'hasOwnProperty',
    'valueOf',
    'isPrototypeOf',
    'constructor',
    '__proto__',
    'propertyIsEnumerable',
    'toLocaleString',
  ])('prototype name %s returns undefined (not a leaked member)', (key) => {
    expect(currencyForCountry(key)).toBeUndefined();
  });
});
