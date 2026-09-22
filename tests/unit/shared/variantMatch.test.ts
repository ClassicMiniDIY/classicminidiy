import { describe, expect, it } from 'vitest';
import seed from '../../../docs/plans/data/2026-09-22-model-variants-seed.json';
import { matchRegistryToVariant, type RegistryMatchInput } from '../../../shared/utils/variantMatch';

const variants = seed as any[];
const car = (
  year: number,
  model: string,
  trim = '',
  engine_size: number | null = null,
  body_type = 'Saloon'
): RegistryMatchInput => ({
  year,
  model,
  trim,
  engine_size,
  body_type,
});
const match = (input: RegistryMatchInput) => matchRegistryToVariant(input, variants);

describe('matchRegistryToVariant', () => {
  it.each([
    ['Austin Seven, 1960', car(1960, 'Austin Seven', '', 1275), 'austin-seven-mk1'],
    ['Austin Mini (renamed Seven), 1963', car(1963, 'Austin Mini', 'Deluxe', 850), 'austin-seven-mk1'],
    ['Morris Mini, 1962', car(1962, 'Morris Mini', 'Green Fleck', 850), 'morris-mini-minor-mk1'],
    [
      'Morris Traveller estate, 1963',
      car(1963, 'Morris Mini Minor', 'Traveller', 1275, 'Estate'),
      'austin-seven-countryman-mk1',
    ],
    ['Cooper S by capacity, 1964', car(1964, 'Morris Cooper S', '', 1275), 'austin-morris-mini-cooper-s-1275-mk1'],
    ['Authi by marque and capacity', car(1972, 'AUTHI Mini 1000', 'Deluxe', 1275), 'authi-mini-1000-mk3'],
    ['BL van by capacity', car(1978, '(BL) Mini Van 1000', 'Black', 998, 'Van'), 'leyland-minivan-1000-mk3'],
    ['Named edition, spelled out', car(1989, 'Mini Thirty', '', 998), 'mini-30-mk5'],
    ['Named edition in the trim', car(1988, 'Austin', 'Jet Black', 1340), 'austin-mini-red-hot-mk5'],
    ['Base car, not an edition, 1999 Cooper', car(1999, 'Rover Mini', 'Cooper', 1300), 'mini-cooper-mpi-mk7'],
    ['Base car, not an edition, 1997 saloon', car(1997, 'Rover Mini', '', 1275), 'mini-mk7'],
  ])('%s', (_label, input, slug) => {
    const result = match(input);
    expect(result.best?.slug).toBe(slug);
    expect(result.confident).toBe(true);
  });

  it('never scores connective words in a multi-name variant as an edition', () => {
    const saloon = match(car(1963, 'Austin Mini', 'red and white', 850));
    expect(saloon.best?.slug).toBe('austin-seven-mk1');
    expect(match(car(1966, 'Austin and Morris Mini', '', 848)).best?.slug).not.toBe('austin-seven-countryman-mk1');
  });

  it('reads "Thirty Five" as the 35, not the 30', () => {
    const { ranked } = match(car(1994, 'Mini Thirty Five', ''));
    expect(ranked[0]!.slug).toMatch(/35/);
  });

  it('is not confident on a changeover year that two marks share', () => {
    expect(match(car(1984, 'Mini', 'Mayfair', 998)).confident).toBe(false);
    expect(match(car(1967, 'Morris Cooper S', 'Tartan Red', 1275)).confident).toBe(false);
  });

  it('is not confident without a year, and never links an overseas car on a UK description', () => {
    expect(match({ ...car(0, 'Austin Seven'), year: null }).confident).toBe(false);
    expect(match(car(1972, 'Mini', '', 998)).best?.slug).not.toMatch(/^(authi|innocenti)/);
  });

  it('ranks suggestions best first, positive scores only', () => {
    const { ranked } = match(car(1964, 'Cooper S', '', 1071));
    expect(ranked[0]!.slug).toBe('austin-morris-mini-cooper-s-1071-mk1');
    expect(ranked.every((m) => m.score > 0)).toBe(true);
    expect(ranked.length).toBeLessThanOrEqual(5);
  });
});
