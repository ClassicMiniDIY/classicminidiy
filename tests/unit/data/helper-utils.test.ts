import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ARCHIVE_TYPES,
  humanFileSize,
  generateArchiveSubmissionMailto,
  determineArchiveType,
  shareArchiveItem,
  shareWheelItem,
  shareColorItem,
  submitArchiveFile,
} from '~/data/models/helper-utils';
import type { SubmissionInfo } from '~/data/models/helper-utils';

// ---------------------------------------------------------------------------
// ARCHIVE_TYPES enum
// ---------------------------------------------------------------------------
describe('ARCHIVE_TYPES enum', () => {
  it('has the expected values', () => {
    expect(ARCHIVE_TYPES.ADVERT).toBe('advert');
    expect(ARCHIVE_TYPES.CATALOGUE).toBe('catalogue');
    expect(ARCHIVE_TYPES.MANUAL).toBe('manual');
    expect(ARCHIVE_TYPES.TUNING).toBe('tuning');
    expect(ARCHIVE_TYPES.ELECTRICAL).toBe('electrical');
    expect(ARCHIVE_TYPES.GENERIC).toBe('generic');
  });

  it('contains exactly 6 members', () => {
    const values = Object.values(ARCHIVE_TYPES);
    expect(values).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// humanFileSize
// ---------------------------------------------------------------------------
describe('humanFileSize', () => {
  describe('zero and small values', () => {
    it('returns "0 B" for 0 bytes', () => {
      expect(humanFileSize(0)).toBe('0 B');
    });

    it('returns bytes for values below the threshold (binary)', () => {
      expect(humanFileSize(500)).toBe('500 B');
      expect(humanFileSize(1023)).toBe('1023 B');
    });

    it('returns bytes for values below the threshold (SI)', () => {
      expect(humanFileSize(500, true)).toBe('500 B');
      expect(humanFileSize(999, true)).toBe('999 B');
    });
  });

  describe('binary units (default, 1024-based)', () => {
    it('formats KiB', () => {
      expect(humanFileSize(1024)).toBe('1.0 KiB');
    });

    it('formats MiB', () => {
      expect(humanFileSize(1024 * 1024)).toBe('1.0 MiB');
    });

    it('formats GiB', () => {
      expect(humanFileSize(1024 ** 3)).toBe('1.0 GiB');
    });

    it('formats TiB', () => {
      expect(humanFileSize(1024 ** 4)).toBe('1.0 TiB');
    });

    it('formats fractional values', () => {
      expect(humanFileSize(1536)).toBe('1.5 KiB');
    });
  });

  describe('SI units (1000-based)', () => {
    it('formats kB', () => {
      expect(humanFileSize(1000, true)).toBe('1.0 kB');
    });

    it('formats MB', () => {
      expect(humanFileSize(1000 * 1000, true)).toBe('1.0 MB');
    });

    it('formats GB', () => {
      expect(humanFileSize(1000 ** 3, true)).toBe('1.0 GB');
    });

    it('formats TB', () => {
      expect(humanFileSize(1000 ** 4, true)).toBe('1.0 TB');
    });

    it('formats fractional values', () => {
      expect(humanFileSize(1500, true)).toBe('1.5 kB');
    });
  });

  describe('custom decimal places', () => {
    it('uses 0 decimal places', () => {
      expect(humanFileSize(1536, false, 0)).toBe('2 KiB');
    });

    it('uses 2 decimal places', () => {
      expect(humanFileSize(1536, false, 2)).toBe('1.50 KiB');
    });

    it('uses 3 decimal places', () => {
      expect(humanFileSize(1536, false, 3)).toBe('1.500 KiB');
    });
  });

  describe('negative values', () => {
    it('handles negative bytes below threshold', () => {
      expect(humanFileSize(-500)).toBe('-500 B');
    });

    it('handles negative KiB values', () => {
      expect(humanFileSize(-1024)).toBe('-1.0 KiB');
    });

    it('handles negative MiB values', () => {
      expect(humanFileSize(-1024 * 1024)).toBe('-1.0 MiB');
    });
  });

  describe('large values', () => {
    it('formats petabytes (binary)', () => {
      expect(humanFileSize(1024 ** 5)).toBe('1.0 PiB');
    });

    it('formats exabytes (binary)', () => {
      expect(humanFileSize(1024 ** 6)).toBe('1.0 EiB');
    });

    it('formats petabytes (SI)', () => {
      expect(humanFileSize(1000 ** 5, true)).toBe('1.0 PB');
    });
  });
});

// ---------------------------------------------------------------------------
// generateArchiveSubmissionMailto
// ---------------------------------------------------------------------------
describe('generateArchiveSubmissionMailto', () => {
  const sampleInfo: SubmissionInfo = {
    title: 'Test Manual',
    url: '/archive/manuals/test',
    body: 'A test manual description',
    code: 'TM-001',
  };

  describe('non-GENERIC types', () => {
    const nonGenericTypes = [
      ARCHIVE_TYPES.ADVERT,
      ARCHIVE_TYPES.CATALOGUE,
      ARCHIVE_TYPES.MANUAL,
      ARCHIVE_TYPES.TUNING,
      ARCHIVE_TYPES.ELECTRICAL,
    ];

    it.each(nonGenericTypes)('generates a detailed mailto link for type "%s"', (type) => {
      const result = generateArchiveSubmissionMailto(type, sampleInfo);
      expect(result).toContain('mailto:classicminidiy@gmail.com');
      expect(result).toContain(`subject=Archive%20Submission%20-%20${type}%20-%20${sampleInfo.code}`);
      expect(result).toContain(sampleInfo.title);
      expect(result).toContain(sampleInfo.url);
      expect(result).toContain(sampleInfo.body);
      expect(result).toContain(sampleInfo.code);
    });

    it('starts with mailto:classicminidiy@gmail.com', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.MANUAL, sampleInfo);
      expect(result.startsWith('mailto:classicminidiy@gmail.com')).toBe(true);
    });

    it('includes the archive type in the body', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.TUNING, sampleInfo);
      expect(result).toContain(`Archive%20-%20${ARCHIVE_TYPES.TUNING}`);
    });

    it('includes reference page info fields', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.CATALOGUE, sampleInfo);
      expect(result).toContain(`Title%20-%20${sampleInfo.title}`);
      expect(result).toContain(`Url%20-%20${sampleInfo.url}`);
      expect(result).toContain(`Description%20-%20${sampleInfo.body}`);
      expect(result).toContain(`Code%20-%20${sampleInfo.code}`);
    });
  });

  describe('GENERIC type', () => {
    it('generates a simple mailto link', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.GENERIC, sampleInfo);
      expect(result).toBe('mailto:classicminidiy@gmail.com?subject=Archive%20Submission%20-%20General');
    });

    it('does not include info fields', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.GENERIC, sampleInfo);
      expect(result).not.toContain('body=');
      expect(result).not.toContain(sampleInfo.title);
    });

    it('is addressed to classicminidiy@gmail.com', () => {
      const result = generateArchiveSubmissionMailto(ARCHIVE_TYPES.GENERIC, sampleInfo);
      expect(result.startsWith('mailto:classicminidiy@gmail.com')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// determineArchiveType
// ---------------------------------------------------------------------------
describe('determineArchiveType', () => {
  describe('known path segments', () => {
    it('returns MANUAL for paths containing "manuals"', () => {
      expect(determineArchiveType('/archive/manuals')).toBe(ARCHIVE_TYPES.MANUAL);
      expect(determineArchiveType('/archive/manuals/some-doc')).toBe(ARCHIVE_TYPES.MANUAL);
    });

    it('returns ADVERT for paths containing "adverts"', () => {
      expect(determineArchiveType('/archive/adverts')).toBe(ARCHIVE_TYPES.ADVERT);
      expect(determineArchiveType('/archive/adverts/vintage')).toBe(ARCHIVE_TYPES.ADVERT);
    });

    it('returns CATALOGUE for paths containing "catalogues"', () => {
      expect(determineArchiveType('/archive/catalogues')).toBe(ARCHIVE_TYPES.CATALOGUE);
      expect(determineArchiveType('/archive/catalogues/1965')).toBe(ARCHIVE_TYPES.CATALOGUE);
    });

    it('returns TUNING for paths containing "tuning"', () => {
      expect(determineArchiveType('/archive/tuning')).toBe(ARCHIVE_TYPES.TUNING);
      expect(determineArchiveType('/archive/tuning/engine')).toBe(ARCHIVE_TYPES.TUNING);
    });

    it('returns ELECTRICAL for paths containing "electrical"', () => {
      expect(determineArchiveType('/archive/electrical')).toBe(ARCHIVE_TYPES.ELECTRICAL);
      expect(determineArchiveType('/archive/electrical/wiring')).toBe(ARCHIVE_TYPES.ELECTRICAL);
    });
  });

  describe('unknown and edge-case paths', () => {
    it('returns GENERIC for unknown paths', () => {
      expect(determineArchiveType('/archive/wheels')).toBe(ARCHIVE_TYPES.GENERIC);
      expect(determineArchiveType('/archive/colors')).toBe(ARCHIVE_TYPES.GENERIC);
    });

    it('returns GENERIC for empty string', () => {
      expect(determineArchiveType('')).toBe(ARCHIVE_TYPES.GENERIC);
    });

    it('returns GENERIC for root path', () => {
      expect(determineArchiveType('/')).toBe(ARCHIVE_TYPES.GENERIC);
    });

    it('is case sensitive (uppercase does not match)', () => {
      expect(determineArchiveType('/archive/MANUALS')).toBe(ARCHIVE_TYPES.GENERIC);
      expect(determineArchiveType('/archive/Tuning')).toBe(ARCHIVE_TYPES.GENERIC);
    });
  });
});

// ---------------------------------------------------------------------------
// Share functions
// ---------------------------------------------------------------------------
describe('shareArchiveItem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('calls navigator.share with the correct URL', async () => {
    await shareArchiveItem('Test Title', '/archive/manuals/test');
    expect(navigator.share).toHaveBeenCalledWith({
      url: 'https://classicminidiy.com/archive/manuals/test',
    });
  });

  it('uses default URL when no url is provided', async () => {
    await shareArchiveItem('Test Title');
    expect(navigator.share).toHaveBeenCalledWith({
      url: 'https://classicminidiy.com/archive/manuals',
    });
  });

  it('uses default empty title and default URL when no arguments provided', async () => {
    await shareArchiveItem();
    expect(navigator.share).toHaveBeenCalledWith({
      url: 'https://classicminidiy.com/archive/manuals',
    });
  });

  it('does not throw when navigator.share rejects', async () => {
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('User cancelled'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(shareArchiveItem('Title', '/test')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('cannot share', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('shareWheelItem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('calls navigator.share with title and correct URL', async () => {
    await shareWheelItem('Cooper Wheels', 'abc-123');
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'Cooper Wheels',
      url: 'https://classicminidiy.com/archive/wheels/abc-123',
    });
  });

  it('uses default empty title and uuid when no arguments provided', async () => {
    await shareWheelItem();
    expect(navigator.share).toHaveBeenCalledWith({
      title: '',
      url: 'https://classicminidiy.com/archive/wheels/',
    });
  });

  it('does not throw when navigator.share rejects', async () => {
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Share failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(shareWheelItem('Wheels', 'uuid')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('cannot share', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('shareColorItem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('calls navigator.share with title and correct URL', async () => {
    await shareColorItem('British Racing Green', 'british-racing-green');
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'British Racing Green',
      url: 'https://classicminidiy.com/archive/colors/british-racing-green',
    });
  });

  it('uses default empty title and color when no arguments provided', async () => {
    await shareColorItem();
    expect(navigator.share).toHaveBeenCalledWith({
      title: '',
      url: 'https://classicminidiy.com/archive/colors/',
    });
  });

  it('does not throw when navigator.share rejects', async () => {
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Share failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(shareColorItem('Red', 'red')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('cannot share', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// submitArchiveFile
// ---------------------------------------------------------------------------
describe('submitArchiveFile', () => {
  let originalHref: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalHref = window.location.href;
    // Make window.location.href writable for the test
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalHref },
    });
  });

  it('sets window.location.href to the generated mailto link', async () => {
    await submitArchiveFile(ARCHIVE_TYPES.MANUAL, 'Test', '/url', 'CODE', 'Body');
    expect(window.location.href).toContain('mailto:classicminidiy@gmail.com');
    expect(window.location.href).toContain('manual');
  });

  it('uses default parameters when none provided', async () => {
    await submitArchiveFile();
    expect(window.location.href).toContain('mailto:classicminidiy@gmail.com');
    expect(window.location.href).toContain('manual');
  });

  it('does not throw when an error occurs', async () => {
    // Force generateArchiveSubmissionMailto to be called normally
    // but test the catch path by making location.href assignment throw
    Object.defineProperty(window, 'location', {
      get() {
        return {
          get href() {
            return '';
          },
          set href(_v: string) {
            throw new Error('Cannot navigate');
          },
        };
      },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(submitArchiveFile(ARCHIVE_TYPES.TUNING, 'T', '/u', 'C', 'B')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('cannot contribute', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
