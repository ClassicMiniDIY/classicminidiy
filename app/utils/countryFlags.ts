/**
 * Country name to ISO 3166-1 alpha-2 code mapping.
 * Covers countries where Classic Minis are commonly found,
 * plus a broad set of others for global coverage.
 */
const COUNTRY_CODES: Record<string, string> = {
  // Common Mini markets
  'united kingdom': 'GB',
  'united states': 'US',
  australia: 'AU',
  canada: 'CA',
  'new zealand': 'NZ',
  ireland: 'IE',
  japan: 'JP',
  germany: 'DE',
  france: 'FR',
  netherlands: 'NL',
  belgium: 'BE',
  italy: 'IT',
  spain: 'ES',
  portugal: 'PT',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  switzerland: 'CH',
  austria: 'AT',
  'south africa': 'ZA',
  singapore: 'SG',
  'hong kong': 'HK',
  malaysia: 'MY',
  thailand: 'TH',
  india: 'IN',
  brazil: 'BR',
  argentina: 'AR',
  mexico: 'MX',
  chile: 'CL',
  poland: 'PL',
  'czech republic': 'CZ',
  czechia: 'CZ',
  hungary: 'HU',
  greece: 'GR',
  turkey: 'TR',
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
  israel: 'IL',
  philippines: 'PH',
  indonesia: 'ID',
  vietnam: 'VN',
  'south korea': 'KR',
  taiwan: 'TW',
  china: 'CN',
  russia: 'RU',
  ukraine: 'UA',
  romania: 'RO',
  croatia: 'HR',
  serbia: 'RS',
  bulgaria: 'BG',
  luxembourg: 'LU',
  malta: 'MT',
  cyprus: 'CY',
  iceland: 'IS',
  colombia: 'CO',
  peru: 'PE',
  ecuador: 'EC',
  uruguay: 'UY',
  'costa rica': 'CR',
  panama: 'PA',
  jamaica: 'JM',
  'trinidad and tobago': 'TT',
  barbados: 'BB',
  bahamas: 'BS',
  bermuda: 'BM',
  egypt: 'EG',
  morocco: 'MA',
  kenya: 'KE',
  nigeria: 'NG',
  ghana: 'GH',
  qatar: 'QA',
  kuwait: 'KW',
  bahrain: 'BH',
  oman: 'OM',

  // Common aliases
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  usa: 'US',
  america: 'US',
  'the netherlands': 'NL',
  holland: 'NL',
  uae: 'AE',
  korea: 'KR',
};

/**
 * Convert a 2-letter ISO country code to a flag emoji
 * using Unicode Regional Indicator Symbol pairs.
 */
function codeToFlag(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * Get a flag emoji for a country name.
 * Returns empty string if no match found.
 */
export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const code = COUNTRY_CODES[country.toLowerCase().trim()];
  if (!code) return '';
  return codeToFlag(code);
}

/**
 * Get a flag emoji + country name pair.
 * Returns null if no flag found.
 */
export function getCountryWithFlag(country: string | null | undefined): { flag: string; name: string } | null {
  if (!country) return null;
  const flag = getCountryFlag(country);
  if (!flag) return null;
  return { flag, name: country };
}

/**
 * Get all unique countries with their flag emojis.
 * Deduplicates aliases (e.g. "UK" and "United Kingdom" both map to GB).
 */
export function getAllCountriesWithFlags(): { flag: string; name: string }[] {
  const seen = new Set<string>();
  const result: { flag: string; name: string }[] = [];

  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (seen.has(code)) continue;
    seen.add(code);
    // Title case: capitalize each word for proper display
    const displayName = name.replace(/\b\w/g, (c) => c.toUpperCase());
    result.push({ flag: codeToFlag(code), name: displayName });
  }

  return result;
}
