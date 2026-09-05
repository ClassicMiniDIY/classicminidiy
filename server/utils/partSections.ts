/**
 * Turning Somerford's plate filenames into a browsable taxonomy.
 *
 * THE LEADING NUMBER IS NOT A SECTION. It is a page number within a system, so
 * "01" spans Manifolds, Battery, Cooling, Fascias, Front End Panels and Manual
 * Gearbox, while "Manual Gearbox" runs from 01 to 12 because those are gearbox
 * pages 1 to 12. The taxonomy is the NAME.
 *
 * The raw names need work before they are a menu: near duplicates ("Fuel Tanks,
 * Fuel Pump and Fuel System" and "...Systems"), hyphen-joined variants from
 * filenames written that way, trailing (F)/(D)/(Fx) markers, and one plate whose
 * filename did not match the number pattern at all and took the whole filename
 * as its name.
 *
 * `initcap` is not enough either — it renders "ECUs" as "Ecus".
 */

/** Groups the ~60 plate sections into systems a reader actually thinks in. */
export const SYSTEM_ORDER = [
  'Engine',
  'Fuel and Air',
  'Cooling',
  'Exhaust',
  'Transmission',
  'Suspension and Steering',
  'Brakes',
  'Electrical',
  'Body',
  'Interior',
  'Glazing and Seals',
] as const;

export type PartSystem = (typeof SYSTEM_ORDER)[number];

/**
 * Section-name fragment to system, matched in order — FIRST MATCH WINS, so the
 * order is load-bearing.
 *
 * Glazing sits above Body because "Body Glazing" contains both and belongs
 * under glazing. Every pattern is word-anchored: an unanchored /body/ matched
 * "Something NoBODY Anticipated" and filed it under Body, which is how a rule
 * meant to categorise turns into a rule that mislabels.
 */
const SYSTEM_RULES: Array<[RegExp, PartSystem]> = [
  [/\b(glazing|windscreen|seals?)\b/, 'Glazing and Seals'],
  [/\b(cylinder head|internal engine|external engine|engine mountings?|oil (pump|filter)|manifolds?)\b/, 'Engine'],
  [/\b(carburetters?|carburetter fittings|fuel|air filters?|emission|engine controls)\b/, 'Fuel and Air'],
  [/\bcooling\b/, 'Cooling'],
  [/\bexhausts?\b/, 'Exhaust'],
  [/\b(gearbox|transmission|final drive|differential|drive shafts?|drive flanges?|clutch)\b/, 'Transmission'],
  [/\b(suspension|subframes?|steering|road wheels|hubs?)\b/, 'Suspension and Steering'],
  [/\b(brakes?|handbrake)\b/, 'Brakes'],
  [
    /\b(harnesses?|lamps?|headlamps?|switches|switch|fuses?|flasher|relays?|instruments?|distributors?|ignition|ecus?|alternators?|dynamo|battery|starter|horns?|alarms?|airbags?|radios?|wipers?|washers?|warning lights?)\b/,
    'Electrical',
  ],
  [
    /\b(body|panels?|bonnet|boot|doors?|roof|decals?|stripes?|brightwork|finishers?|chassis plates?|sunroof|tailboard)\b/,
    'Body',
  ],
  [
    /\b(interior|trim|seats?|carpets?|headlinings?|sun visors?|fascias?|dash|heating|air conditioning|seat belts?|sound insulation|luggage)\b/,
    'Interior',
  ],
];

/** Words `initcap` gets wrong, and casing the source is inconsistent about. */
const CASING_FIXES: Array<[RegExp, string]> = [
  [/\bEcus\b/g, 'ECUs'],
  [/\bLh\b/g, 'LH'],
  [/\bRh\b/g, 'RH'],
  [/\bF\)/g, ')'],
];

/**
 * A display name for a raw section string.
 *
 * Returns null when the raw value is unusable, so a caller groups the plate as
 * uncategorised rather than inventing a section from a filename.
 */
export function cleanSectionName(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let name = raw
    // Hyphen- and underscore-joined filename variants.
    .replace(/[-_]+/g, ' ')
    // Trailing sheet markers: (F), (D), (Fx), (Part 2FF).
    .replace(/\((?:f|d|fx|part\s*[0-9a-z]*)\)/gi, ' ')
    // A leading page number that survived into the name.
    .replace(/^\s*\d+[a-z]?\s*[.]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 3) return null;

  name = name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bTo\b/g, 'to')
    .replace(/\bUp\b/g, 'up')
    .replace(/\bOn\b/g, 'on');
  // Re-capitalise the first word after the lowercase-joiner pass.
  name = name.charAt(0).toUpperCase() + name.slice(1);

  for (const [pattern, replacement] of CASING_FIXES) name = name.replace(pattern, replacement);

  return name.replace(/\s+/g, ' ').trim() || null;
}

/** The system a section belongs to, or null when no rule matches. */
export function systemForSection(sectionName: string | null | undefined): PartSystem | null {
  if (!sectionName) return null;
  const haystack = sectionName.toLowerCase();
  for (const [pattern, system] of SYSTEM_RULES) {
    if (pattern.test(haystack)) return system;
  }
  return null;
}
