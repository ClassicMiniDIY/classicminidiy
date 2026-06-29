/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Camino client (network). The real ./geo haversineDistance is used
// as-is so distance ranking and the 100m dedup threshold are exercised for real.
vi.mock('~~/server/utils/exchange/camino', () => ({
  caminoFetch: vi.fn(),
}));

import { findMeetingSpots, enrichWithDriveTimes, type MeetingSpot } from '~~/server/utils/exchange/meetingSpots';
import { caminoFetch } from '~~/server/utils/exchange/camino';
import { haversineDistance } from '~~/server/utils/exchange/geo';

const mockedCaminoFetch = vi.mocked(caminoFetch);

// findMeetingSpots fires one /query call per SAFE_PLACE_QUERIES entry.
const QUERY_COUNT = 5;

// Midpoint used by the suite. (0,0) keeps haversine math easy to reason about:
// one degree of latitude is ~111.2 km, so 0.001 deg ~= 111 m (just over the
// 100 m dedup threshold) and 0.0005 deg ~= 55 m (under it, a duplicate).
const MID = { lat: 0, lon: 0 };

/** A bare Camino /query result row. */
function spot(over: Partial<Record<string, any>> = {}): Record<string, any> {
  return { name: 'Place', lat: 0.01, lon: 0.0, ...over };
}

/**
 * Make caminoFetch resolve the first call with `first` and every subsequent
 * call with an empty results envelope. Lets a single query drive the test
 * without the other four polluting the ranked output.
 */
function resolveFirstThenEmpty(first: any) {
  mockedCaminoFetch.mockReset();
  mockedCaminoFetch.mockResolvedValueOnce(first);
  mockedCaminoFetch.mockResolvedValue({ results: [] });
}

beforeEach(() => {
  mockedCaminoFetch.mockReset();
  // Default: every query returns no spots.
  mockedCaminoFetch.mockResolvedValue({ results: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('findMeetingSpots — query fan-out', () => {
  it('issues one /query per safe-place query with the expected params', async () => {
    await findMeetingSpots(12.34, -56.78);

    expect(mockedCaminoFetch).toHaveBeenCalledTimes(QUERY_COUNT);
    for (const call of mockedCaminoFetch.mock.calls) {
      expect(call[0]).toBe('/query');
      const opts = call[1] as any;
      expect(opts.params).toMatchObject({
        lat: 12.34,
        lon: -56.78,
        radius: 8000,
        limit: 3,
        rank: true,
      });
      expect(typeof opts.params.query).toBe('string');
    }
  });

  it('passes each distinct SAFE_PLACE query string', async () => {
    await findMeetingSpots(MID.lat, MID.lon);
    const queries = mockedCaminoFetch.mock.calls.map((c) => (c[1] as any).params.query);
    expect(new Set(queries).size).toBe(QUERY_COUNT);
    expect(queries).toContain('police station');
    expect(queries).toContain('gas station well-lit');
  });
});

describe('findMeetingSpots — response shape handling', () => {
  it('handles the { results: [...] } envelope', async () => {
    resolveFirstThenEmpty({ results: [spot({ name: 'Envelope Place', lat: 0.01, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Envelope Place');
  });

  it('handles a bare array response', async () => {
    resolveFirstThenEmpty([spot({ name: 'Array Place', lat: 0.01, lon: 0 })]);
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Array Place');
  });

  it('ignores responses that are neither array nor { results }', async () => {
    resolveFirstThenEmpty({ answer: 'no places', unexpected: true });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toEqual([]);
  });

  it('returns an empty array when every query yields no spots', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockResolvedValue({ results: [] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toEqual([]);
  });
});

describe('findMeetingSpots — Promise.allSettled resilience', () => {
  it('drops rejected queries but keeps fulfilled ones', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch
      .mockRejectedValueOnce(new Error('camino 500'))
      .mockResolvedValueOnce({ results: [spot({ name: 'Survivor', lat: 0.01, lon: 0 })] })
      .mockResolvedValue({ results: [] });

    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Survivor');
  });

  it('returns [] when all queries reject (no throw)', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockRejectedValue(new Error('camino down'));
    await expect(findMeetingSpots(MID.lat, MID.lon)).resolves.toEqual([]);
  });
});

describe('findMeetingSpots — null lat/lon guard (0 is valid)', () => {
  it('filters out spots with null lat', async () => {
    resolveFirstThenEmpty({ results: [spot({ name: 'No Lat', lat: null, lon: 0.01 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toEqual([]);
  });

  it('filters out spots with null lon', async () => {
    resolveFirstThenEmpty({ results: [spot({ name: 'No Lon', lat: 0.01, lon: null })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toEqual([]);
  });

  it('filters out spots with undefined lat/lon (== null catches undefined)', async () => {
    resolveFirstThenEmpty({ results: [{ name: 'No Coords' }] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toEqual([]);
  });

  it('KEEPS a spot sitting exactly on the equator/prime-meridian (lat 0, lon 0)', async () => {
    // The guard is `== null`, so a genuine 0 coordinate must survive.
    resolveFirstThenEmpty({ results: [spot({ name: 'Origin Spot', lat: 0, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Origin Spot');
    expect(result[0].distanceFromMidpoint).toBe(0);
  });

  it('keeps spots with valid coords and drops null ones in the same batch', async () => {
    resolveFirstThenEmpty({
      results: [
        spot({ name: 'Valid', lat: 0.01, lon: 0 }),
        spot({ name: 'Null', lat: null, lon: null }),
      ],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result.map((r) => r.name)).toEqual(['Valid']);
  });
});

describe('findMeetingSpots — deduplication (<100m)', () => {
  it('collapses two spots within 100m of each other to one (first wins)', async () => {
    // ~55m apart (0.0005 deg lat) -> duplicate.
    resolveFirstThenEmpty({
      results: [
        spot({ name: 'First', lat: 0.01, lon: 0 }),
        spot({ name: 'Near Dup', lat: 0.0105, lon: 0 }),
      ],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('First');
  });

  it('keeps two spots that are just over 100m apart', async () => {
    // ~111m apart (0.001 deg lat) -> distinct.
    const d = haversineDistance(0.01, 0, 0.011, 0);
    expect(d).toBeGreaterThan(100); // sanity-check the fixture geometry
    resolveFirstThenEmpty({
      results: [
        spot({ name: 'A', lat: 0.01, lon: 0 }),
        spot({ name: 'B', lat: 0.011, lon: 0 }),
      ],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result.map((r) => r.name).sort()).toEqual(['A', 'B']);
  });

  it('dedups across results from different queries', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch
      .mockResolvedValueOnce({ results: [spot({ name: 'Q1', lat: 0.01, lon: 0 })] })
      .mockResolvedValueOnce({ results: [spot({ name: 'Q2-dup', lat: 0.0103, lon: 0 })] })
      .mockResolvedValue({ results: [] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Q1');
  });
});

describe('findMeetingSpots — scoring & ranking', () => {
  it('applies a safety boost when the name matches a keyword', async () => {
    // Identical distance for both; "Police" boosts +50.
    resolveFirstThenEmpty({
      results: [
        spot({ name: 'Police Station', lat: 0.02, lon: 0 }),
        spot({ name: 'Random Lot', lat: 0.02, lon: 0.01 }),
      ],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].name).toBe('Police Station');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('sums multiple keyword boosts found in a single spot', async () => {
    // "bank" (+25) and "gas" (+15) both appear -> +40 boost.
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({ results: [spot({ name: 'Bank and gas plaza', lat: 0.02, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].score).toBeCloseTo(25 + 15 - dist / 100, 6);
  });

  it('matches keywords inside the tags array', async () => {
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({
      results: [spot({ name: 'Unnamed', tags: ['police'], lat: 0.02, lon: 0 })],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].score).toBeCloseTo(50 - dist / 100, 6);
  });

  it('matches keywords inside the type field', async () => {
    // INVARIANT: "fire_station" matches BOTH the "fire_station" (+40) and the
    // substring "fire" (+40) keys, since matching is `includes`, not equality.
    // So a single fire_station type stacks to +80. This is intentional behavior.
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({
      results: [spot({ name: 'Unnamed', type: 'fire_station', lat: 0.02, lon: 0 })],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].score).toBeCloseTo(40 + 40 - dist / 100, 6);
  });

  it('keyword matching is case-insensitive', async () => {
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({ results: [spot({ name: 'POLICE DEPT', lat: 0.02, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].score).toBeCloseTo(50 - dist / 100, 6);
  });

  it('scores an unmatched spot as -distance/100 (pure distance penalty)', async () => {
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({ results: [spot({ name: 'Empty Lot', lat: 0.02, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].score).toBeCloseTo(-dist / 100, 6);
  });

  it('falls back to an empty name string when name is missing (no crash, scores on type)', async () => {
    // Exercises the `spot.name || ''` fallback (line 86): a spot with no name at
    // all must not throw and should still score off type/tags. Here type carries
    // the "police" keyword so the boost still applies despite the absent name.
    const dist = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    resolveFirstThenEmpty({ results: [{ type: 'police', lat: 0.02, lon: 0 }] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBeUndefined();
    expect(result[0].score).toBeCloseTo(50 - dist / 100, 6);
  });

  it('with equal safety, the closer spot ranks higher', async () => {
    // Both keyword-less; closer one has smaller distance penalty.
    resolveFirstThenEmpty({
      results: [
        spot({ name: 'Far', lat: 0.05, lon: 0 }),
        spot({ name: 'Near', lat: 0.01, lon: 0 }),
      ],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0].name).toBe('Near');
    expect(result[0].distanceFromMidpoint).toBeLessThan(result[1].distanceFromMidpoint);
  });

  it('attaches distanceFromMidpoint computed via real haversine', async () => {
    resolveFirstThenEmpty({ results: [spot({ name: 'Measured', lat: 0.02, lon: 0 })] });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    const expected = haversineDistance(MID.lat, MID.lon, 0.02, 0);
    expect(result[0].distanceFromMidpoint).toBeCloseTo(expected, 6);
  });

  it('preserves the original spot fields via spread', async () => {
    resolveFirstThenEmpty({
      results: [spot({ name: 'Rich', lat: 0.02, lon: 0, address: '1 Main St', type: 'park' })],
    });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result[0]).toMatchObject({ name: 'Rich', address: '1 Main St', type: 'park' });
    expect(result[0]).toHaveProperty('score');
    expect(result[0]).toHaveProperty('distanceFromMidpoint');
  });
});

describe('findMeetingSpots — slice to top 5', () => {
  it('returns at most 5 ranked spots even when more survive dedup', async () => {
    // 8 distinct spots, each >100m from neighbors and from the midpoint.
    const results = Array.from({ length: 8 }, (_, i) =>
      spot({ name: `Spot ${i}`, lat: 0.01 + i * 0.002, lon: 0 })
    );
    resolveFirstThenEmpty({ results });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    expect(result).toHaveLength(5);
  });

  it('the 5 kept spots are the 5 highest-scoring (closest, here unscored)', async () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      spot({ name: `Spot ${i}`, lat: 0.01 + i * 0.002, lon: 0 })
    );
    resolveFirstThenEmpty({ results });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    // With no keyword boosts, score is monotonic in -distance, so the 5
    // closest (Spot 0..4) win and come back nearest-first.
    expect(result.map((r) => r.name)).toEqual(['Spot 0', 'Spot 1', 'Spot 2', 'Spot 3', 'Spot 4']);
  });

  it('results are sorted by score descending', async () => {
    const results = Array.from({ length: 4 }, (_, i) =>
      spot({ name: `Spot ${i}`, lat: 0.01 + i * 0.003, lon: 0 })
    );
    resolveFirstThenEmpty({ results });
    const result = await findMeetingSpots(MID.lat, MID.lon);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

// ---------------------------------------------------------------------------

const BUYER = { lat: 1, lon: 1 };
const SELLER = { lat: 2, lon: 2 };

function meetingSpot(over: Partial<MeetingSpot> = {}): MeetingSpot {
  return {
    name: 'Spot',
    lat: 1.5,
    lon: 1.5,
    distanceFromMidpoint: 0,
    score: 0,
    ...over,
  } as MeetingSpot;
}

function relationship(over: Partial<Record<string, any>> = {}): Record<string, any> {
  return {
    distance: '10 km',
    direction: 'N',
    walking_time: '2h',
    actual_distance_km: 10,
    duration_seconds: 600,
    driving_time: '10 min',
    description: 'drive',
    ...over,
  };
}

describe('enrichWithDriveTimes — happy path', () => {
  it('issues two /relationship POSTs per spot (buyer + seller)', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockResolvedValue(relationship());
    await enrichWithDriveTimes([meetingSpot()], BUYER, SELLER);

    expect(mockedCaminoFetch).toHaveBeenCalledTimes(2);
    for (const call of mockedCaminoFetch.mock.calls) {
      expect(call[0]).toBe('/relationship');
      const opts = call[1] as any;
      expect(opts.method).toBe('POST');
      expect(opts.body.include).toEqual(['distance', 'travel_time']);
      expect(opts.body.end).toEqual({ lat: 1.5, lon: 1.5 });
    }
  });

  it('sends the buyer location as the first call start, seller as the second', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockResolvedValue(relationship());
    await enrichWithDriveTimes([meetingSpot()], BUYER, SELLER);
    const [buyerCall, sellerCall] = mockedCaminoFetch.mock.calls;
    expect((buyerCall[1] as any).body.start).toEqual(BUYER);
    expect((sellerCall[1] as any).body.start).toEqual(SELLER);
  });

  it('maps driving_time and rounds duration_seconds to minutes for both parties', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch
      .mockResolvedValueOnce(relationship({ driving_time: '7 min', duration_seconds: 450 })) // buyer 7.5 -> 8
      .mockResolvedValueOnce(relationship({ driving_time: '20 min', duration_seconds: 1200 })); // seller 20
    const [enriched] = await enrichWithDriveTimes([meetingSpot()], BUYER, SELLER);
    expect(enriched.buyerDriveTime).toBe('7 min');
    expect(enriched.buyerDriveMinutes).toBe(8); // Math.round(450/60)
    expect(enriched.sellerDriveTime).toBe('20 min');
    expect(enriched.sellerDriveMinutes).toBe(20);
  });

  it('leaves drive minutes undefined when duration_seconds is missing/0 (falsy)', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockResolvedValue(relationship({ duration_seconds: 0, driving_time: '0 min' }));
    const [enriched] = await enrichWithDriveTimes([meetingSpot()], BUYER, SELLER);
    expect(enriched.buyerDriveMinutes).toBeUndefined();
    expect(enriched.sellerDriveMinutes).toBeUndefined();
    expect(enriched.buyerDriveTime).toBe('0 min');
  });

  it('preserves the original spot fields while adding drive info', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockResolvedValue(relationship());
    const input = meetingSpot({ name: 'Keep Me', score: 42, distanceFromMidpoint: 123 });
    const [enriched] = await enrichWithDriveTimes([input], BUYER, SELLER);
    expect(enriched).toMatchObject({ name: 'Keep Me', score: 42, distanceFromMidpoint: 123 });
    expect(enriched.buyerDriveMinutes).toBe(10);
  });
});

describe('enrichWithDriveTimes — per-spot error handling', () => {
  it('returns a spot unenriched when its relationship lookups fail', async () => {
    mockedCaminoFetch.mockReset();
    mockedCaminoFetch.mockRejectedValue(new Error('relationship down'));
    const input = meetingSpot({ name: 'Failed' });
    const [enriched] = await enrichWithDriveTimes([input], BUYER, SELLER);
    expect(enriched.name).toBe('Failed');
    expect(enriched.buyerDriveMinutes).toBeUndefined();
    expect(enriched.buyerDriveTime).toBeUndefined();
    // The original object is returned untouched on failure.
    expect(enriched).toEqual(input);
  });

  it('enriches the spots that succeed and skips times for the one that fails', async () => {
    mockedCaminoFetch.mockReset();
    // Spot A: both succeed. Spot B: buyer call rejects (Promise.all -> catch).
    mockedCaminoFetch
      .mockResolvedValueOnce(relationship({ duration_seconds: 300 })) // A buyer
      .mockResolvedValueOnce(relationship({ duration_seconds: 300 })) // A seller
      .mockRejectedValueOnce(new Error('B buyer fail')) // B buyer
      .mockResolvedValueOnce(relationship({ duration_seconds: 600 })); // B seller (ignored)

    const a = meetingSpot({ name: 'A', lat: 1.4, lon: 1.4 });
    const b = meetingSpot({ name: 'B', lat: 1.6, lon: 1.6 });
    const enriched = await enrichWithDriveTimes([a, b], BUYER, SELLER);
    const byName = Object.fromEntries(enriched.map((e) => [e.name, e]));
    expect(byName['A'].buyerDriveMinutes).toBe(5);
    expect(byName['B'].buyerDriveMinutes).toBeUndefined();
  });
});

describe('enrichWithDriveTimes — fairness sort', () => {
  it('ranks spots by the smaller worst-case (max of buyer/seller) drive', async () => {
    mockedCaminoFetch.mockReset();
    // Fair spot: buyer 10, seller 12 -> max 12.
    // Lopsided spot: buyer 1, seller 40 -> max 40.
    mockedCaminoFetch
      .mockResolvedValueOnce(relationship({ duration_seconds: 60 })) // lopsided buyer = 1
      .mockResolvedValueOnce(relationship({ duration_seconds: 2400 })) // lopsided seller = 40
      .mockResolvedValueOnce(relationship({ duration_seconds: 600 })) // fair buyer = 10
      .mockResolvedValueOnce(relationship({ duration_seconds: 720 })); // fair seller = 12

    const lopsided = meetingSpot({ name: 'Lopsided', lat: 1.4, lon: 1.4 });
    const fair = meetingSpot({ name: 'Fair', lat: 1.6, lon: 1.6 });
    const enriched = await enrichWithDriveTimes([lopsided, fair], BUYER, SELLER);
    expect(enriched.map((e) => e.name)).toEqual(['Fair', 'Lopsided']);
  });

  it('sorts spots with missing drive times (Infinity max) to the end', async () => {
    mockedCaminoFetch.mockReset();
    // Good spot resolves; bad spot rejects -> no minutes -> Infinity max.
    mockedCaminoFetch
      .mockRejectedValueOnce(new Error('bad buyer')) // bad spot buyer
      .mockResolvedValueOnce(relationship({ duration_seconds: 600 })) // bad spot seller (ignored)
      .mockResolvedValueOnce(relationship({ duration_seconds: 600 })) // good buyer = 10
      .mockResolvedValueOnce(relationship({ duration_seconds: 600 })); // good seller = 10

    const bad = meetingSpot({ name: 'Bad', lat: 1.4, lon: 1.4 });
    const good = meetingSpot({ name: 'Good', lat: 1.6, lon: 1.6 });
    const enriched = await enrichWithDriveTimes([bad, good], BUYER, SELLER);
    expect(enriched[0].name).toBe('Good');
    expect(enriched[enriched.length - 1].name).toBe('Bad');
  });

  it('returns an empty array for empty input without calling Camino', async () => {
    mockedCaminoFetch.mockReset();
    const enriched = await enrichWithDriveTimes([], BUYER, SELLER);
    expect(enriched).toEqual([]);
    expect(mockedCaminoFetch).not.toHaveBeenCalled();
  });
});
