/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { cleanSectionName, systemForSection, SYSTEM_ORDER } from '~~/server/utils/partSections';

describe('cleanSectionName', () => {
  it.each([
    ['Manual Gearbox', 'Manual Gearbox'],
    ['External Brightwork and Finishers', 'External Brightwork and Finishers'],
    // Hyphen-joined filename variants.
    ['-Body-Glazing---Saloon-and-Cabriolet', 'Body Glazing Saloon and Cabriolet'],
    // Trailing sheet markers.
    ['Front Brakes(F)', 'Front Brakes'],
    ['Engine Mountings (D)', 'Engine Mountings'],
    ['Subframes(Fx)', 'Subframes'],
    // The one plate whose filename never matched the number pattern, so the
    // whole filename became its section name.
    ['01F BODY SEALING HARDWARE', 'Body Sealing Hardware'],
  ])('cleans %s', (raw, expected) => {
    expect(cleanSectionName(raw)).toBe(expected);
  });

  it('fixes casing initcap gets wrong', () => {
    expect(cleanSectionName('Distributors, Ignition and ECUs')).toContain('ECUs');
  });

  it.each([null, undefined, '', '  ', '01'])('returns null for unusable input %s', (raw) => {
    // Null means "uncategorised", which is honest. Inventing a section from a
    // filename puts a plate under a heading that does not describe it.
    expect(cleanSectionName(raw as never)).toBeNull();
  });
});

describe('systemForSection', () => {
  it.each([
    ['Manual Gearbox', 'Transmission'],
    ['Automatic Transmission', 'Transmission'],
    ['Cylinder Head', 'Engine'],
    ['Internal Engine', 'Engine'],
    ['Carburetters', 'Fuel and Air'],
    ['Emission Controls', 'Fuel and Air'],
    ['Cooling', 'Cooling'],
    ['Exhaust Systems', 'Exhaust'],
    ['Front Suspension', 'Suspension and Steering'],
    ['Brake Systems', 'Brakes'],
    ['Harnesses', 'Electrical'],
    ['Headlamps', 'Electrical'],
    ['Body Sides, Back Panels, Roof', 'Body'],
    ['Front Seats', 'Interior'],
    ['Heating', 'Interior'],
    ['Body Glazing', 'Glazing and Seals'],
  ])('maps %s to %s', (section, system) => {
    expect(systemForSection(section)).toBe(system);
  });

  it('returns null rather than guessing for an unknown section', () => {
    expect(systemForSection('Something Nobody Anticipated')).toBeNull();
  });

  it('every system it can return is in the display order', () => {
    // A system missing from SYSTEM_ORDER would be grouped and then never
    // rendered, hiding its plates entirely.
    for (const [, system] of [
      ['x', systemForSection('Manual Gearbox')],
      ['x', systemForSection('Cylinder Head')],
      ['x', systemForSection('Harnesses')],
    ] as const) {
      expect(SYSTEM_ORDER).toContain(system!);
    }
  });
});
