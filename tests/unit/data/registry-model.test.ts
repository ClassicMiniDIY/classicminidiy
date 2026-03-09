import { describe, it, expect } from 'vitest';
import { RegistryItemStatus } from '~/data/models/registry';
import type { RegistryItem, RegistryQueueSubmissionResponse } from '~/data/models/registry';

// ---------------------------------------------------------------------------
// RegistryItemStatus
// ---------------------------------------------------------------------------
describe('RegistryItemStatus', () => {
  it('PENDING equals "P"', () => {
    expect(RegistryItemStatus.PENDING).toBe('P');
  });

  it('APPROVED equals "A"', () => {
    expect(RegistryItemStatus.APPROVED).toBe('A');
  });

  it('REJECTED equals "R"', () => {
    expect(RegistryItemStatus.REJECTED).toBe('R');
  });

  it('has exactly 3 members', () => {
    const values = Object.values(RegistryItemStatus);
    expect(values).toHaveLength(3);
  });

  it('members are distinct values', () => {
    const values = Object.values(RegistryItemStatus);
    const unique = new Set(values);
    expect(unique.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Interface structural contracts (compile-time checks via typed assignment)
// ---------------------------------------------------------------------------
describe('RegistryItem interface', () => {
  it('accepts a fully formed RegistryItem object', () => {
    const item: RegistryItem = {
      model: 'Mini 1000',
      bodyNum: 'A-A2S7L-12345A',
      trim: 'De-Luxe',
      submittedBy: 'Test User',
      submittedByEmail: 'test@example.com',
      engineNum: '9F-U-H1234',
      notes: 'Original paint',
      year: 1967,
      uniqueId: 'uuid-abc-123',
      buildDate: '1967-03-15',
      bodyType: '2-door Saloon',
      engineSize: 998,
      color: 'Old English White',
    };
    expect(item.model).toBe('Mini 1000');
    expect(item.year).toBe(1967);
    expect(item.engineSize).toBe(998);
  });

  it('accepts optional status field', () => {
    const item: RegistryItem = {
      model: 'Mini Cooper S',
      bodyNum: 'C-A2S7L-00001A',
      trim: 'Standard',
      submittedBy: 'User',
      submittedByEmail: 'user@example.com',
      engineNum: '9F-SA-H5678',
      notes: '',
      year: 1968,
      uniqueId: 'uuid-def-456',
      buildDate: null,
      bodyType: '2-door Saloon',
      engineSize: 1275,
      color: 'Tartan Red',
      status: RegistryItemStatus.APPROVED,
    };
    expect(item.status).toBe(RegistryItemStatus.APPROVED);
  });

  it('accepts null and array buildDate values', () => {
    const withNull: RegistryItem = {
      model: 'Mini',
      bodyNum: '',
      trim: '',
      submittedBy: '',
      submittedByEmail: '',
      engineNum: '',
      notes: '',
      year: 1970,
      uniqueId: 'uuid-1',
      buildDate: null,
      bodyType: '',
      engineSize: 848,
      color: '',
    };
    expect(withNull.buildDate).toBeNull();

    const withArray: RegistryItem = {
      ...withNull,
      uniqueId: 'uuid-2',
      buildDate: ['1970', '01', '01'],
    };
    expect(Array.isArray(withArray.buildDate)).toBe(true);
  });
});

describe('RegistryQueueSubmissionResponse interface', () => {
  it('accepts a uuid and details object', () => {
    const response: RegistryQueueSubmissionResponse = {
      uuid: 'test-uuid',
      details: {
        model: 'Mini',
        bodyNum: '',
        trim: '',
        submittedBy: '',
        submittedByEmail: '',
        engineNum: '',
        notes: '',
        year: 1970,
        uniqueId: 'uuid-1',
        buildDate: null,
        bodyType: '',
        engineSize: 848,
        color: '',
      },
    };
    expect(response.uuid).toBe('test-uuid');
    expect(response.details.model).toBe('Mini');
  });
});
