import { describe, it, expect } from 'vitest';
import { ColorItemStatus } from '~/data/models/colors';
import type {
  Color,
  ColorQueueItem,
  ColorQueueSubmissionResponse,
  ColorSaveResponse,
  PrettyColor,
  ColorImages,
} from '~/data/models/colors';

// ---------------------------------------------------------------------------
// ColorItemStatus
// ---------------------------------------------------------------------------
describe('ColorItemStatus', () => {
  it('PENDING equals "P"', () => {
    expect(ColorItemStatus.PENDING).toBe('P');
  });

  it('APPROVED equals "A"', () => {
    expect(ColorItemStatus.APPROVED).toBe('A');
  });

  it('REJECTED equals "R"', () => {
    expect(ColorItemStatus.REJECTED).toBe('R');
  });

  it('has exactly 3 members', () => {
    const values = Object.values(ColorItemStatus);
    expect(values).toHaveLength(3);
  });

  it('members are distinct values', () => {
    const values = Object.values(ColorItemStatus);
    const unique = new Set(values);
    expect(unique.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Interface structural contracts (compile-time checks via typed assignment)
// ---------------------------------------------------------------------------
describe('Color interface', () => {
  it('accepts a fully formed Color object', () => {
    const color: Color = {
      primaryColor: '#FFFFFF',
      code: 'BW11',
      imageSwatch: 'https://example.com/swatch.jpg',
      ditzlerPpgCode: 'PPG-1234',
      duluxCode: 'DX-5678',
      name: 'Old English White',
      shortCode: 'OEW',
      years: '1959-1967',
      id: 'abc-123',
      hasSwatch: true,
    };
    expect(color.code).toBe('BW11');
    expect(color.hasSwatch).toBe(true);
  });

  it('accepts optional images field', () => {
    const color: Color = {
      primaryColor: '#000',
      code: 'BK1',
      imageSwatch: '',
      ditzlerPpgCode: '',
      duluxCode: '',
      name: 'Black',
      shortCode: 'BLK',
      years: '1959-2000',
      id: 'xyz',
      hasSwatch: false,
      images: [{ url: 'https://example.com/img.jpg', contributor: 'User1' }],
    };
    expect(Array.isArray(color.images)).toBe(true);
    expect(color.images![0].contributor).toBe('User1');
  });
});

describe('ColorQueueItem interface', () => {
  it('extends Color with submittedBy and submittedByEmail', () => {
    const item: ColorQueueItem = {
      primaryColor: '#FFF',
      code: 'W1',
      imageSwatch: '',
      ditzlerPpgCode: '',
      duluxCode: '',
      name: 'White',
      shortCode: 'W',
      years: '1960',
      id: 'id-1',
      hasSwatch: false,
      submittedBy: 'Test User',
      submittedByEmail: 'test@example.com',
    };
    expect(item.submittedBy).toBe('Test User');
    expect(item.submittedByEmail).toBe('test@example.com');
  });

  it('accepts optional status and originalColorId', () => {
    const item: ColorQueueItem = {
      primaryColor: '#FFF',
      code: 'W1',
      imageSwatch: '',
      ditzlerPpgCode: '',
      duluxCode: '',
      name: 'White',
      shortCode: 'W',
      years: '1960',
      id: 'id-2',
      hasSwatch: false,
      submittedBy: 'User',
      submittedByEmail: 'user@example.com',
      status: ColorItemStatus.PENDING,
      originalColorId: 'original-id',
    };
    expect(item.status).toBe(ColorItemStatus.PENDING);
    expect(item.originalColorId).toBe('original-id');
  });
});
