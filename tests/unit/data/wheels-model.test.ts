import { describe, it, expect } from 'vitest';
import { WheelItemStatus } from '~/data/models/wheels';
import type { IWheelsData, IWheelsDataReviewItem, IWheelToReview } from '~/data/models/wheels';

// ---------------------------------------------------------------------------
// WheelItemStatus
// ---------------------------------------------------------------------------
describe('WheelItemStatus', () => {
  it('PENDING equals "P"', () => {
    expect(WheelItemStatus.PENDING).toBe('P');
  });

  it('APPROVED equals "A"', () => {
    expect(WheelItemStatus.APPROVED).toBe('A');
  });

  it('REJECTED equals "R"', () => {
    expect(WheelItemStatus.REJECTED).toBe('R');
  });

  it('has exactly 3 members', () => {
    const values = Object.values(WheelItemStatus);
    expect(values).toHaveLength(3);
  });

  it('members are distinct values', () => {
    const values = Object.values(WheelItemStatus);
    const unique = new Set(values);
    expect(unique.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Interface structural contracts (compile-time checks via typed assignment)
// ---------------------------------------------------------------------------
describe('IWheelsData interface', () => {
  it('accepts a fully formed wheel data object', () => {
    const wheel: IWheelsData = {
      uuid: 'wheel-uuid-123',
      name: 'Minilite',
      type: 'alloy',
      width: '5.5',
      size: '10',
      offset: '+20',
      notes: 'Reproduction Minilite style',
      userName: 'Test User',
      emailAddress: 'test@example.com',
      referral: 'forum.classicminidiy.com',
    };
    expect(wheel.name).toBe('Minilite');
    expect(wheel.size).toBe('10');
  });

  it('accepts optional fields', () => {
    const wheel: IWheelsData = {
      uuid: 'wheel-uuid-456',
      name: 'Cosmic',
      type: 'alloy',
      width: '5',
      size: '12',
      offset: '+15',
      notes: '',
      userName: 'User',
      emailAddress: 'user@example.com',
      referral: '',
      images: [{ url: 'https://example.com/img.jpg' }],
      newWheel: true,
      manufacturer: 'Cosmic Wheels',
      boltPattern: '4x101.6',
      centerBore: '57.1',
      weight: '4.5',
      status: WheelItemStatus.PENDING,
    };
    expect(wheel.newWheel).toBe(true);
    expect(wheel.manufacturer).toBe('Cosmic Wheels');
    expect(wheel.status).toBe(WheelItemStatus.PENDING);
  });

  it('accepts numeric weight', () => {
    const wheel: IWheelsData = {
      uuid: 'wheel-uuid-789',
      name: 'Steel',
      type: 'steel',
      width: '3.5',
      size: '10',
      offset: '+0',
      notes: '',
      userName: '',
      emailAddress: '',
      referral: '',
      weight: 4,
    };
    expect(typeof wheel.weight).toBe('number');
  });
});

describe('IWheelsDataReviewItem interface', () => {
  it('accepts a review item with oldWheel reference', () => {
    const existingWheel: IWheelsData = {
      uuid: 'old-uuid',
      name: 'Old Wheel',
      type: 'steel',
      width: '3.5',
      size: '10',
      offset: '+0',
      notes: '',
      userName: '',
      emailAddress: '',
      referral: '',
    };
    const reviewItem: IWheelsDataReviewItem = {
      uuid: 'review-uuid',
      name: 'Updated Wheel',
      type: 'alloy',
      width: '5',
      size: '10',
      offset: '+10',
      notes: 'Updated info',
      userName: 'Reviewer',
      emailAddress: 'reviewer@example.com',
      referral: '',
      oldWheel: existingWheel,
    };
    expect(reviewItem.oldWheel?.name).toBe('Old Wheel');
  });
});

describe('IWheelToReview interface', () => {
  it('accepts new and existing wheel references', () => {
    const wheelData: IWheelsData = {
      uuid: 'uuid',
      name: 'Wheel',
      type: 'alloy',
      width: '5',
      size: '12',
      offset: '+15',
      notes: '',
      userName: '',
      emailAddress: '',
      referral: '',
    };
    const review: IWheelToReview = {
      new: wheelData,
      existing: wheelData,
    };
    expect(review.new?.name).toBe('Wheel');
    expect(review.existing?.uuid).toBe('uuid');
  });

  it('accepts an empty object (all fields optional)', () => {
    const review: IWheelToReview = {};
    expect(review.new).toBeUndefined();
    expect(review.existing).toBeUndefined();
  });
});
