import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('global mocks are available', () => {
    expect(typeof useRouter).toBe('function');
    expect(typeof useRoute).toBe('function');
    expect(typeof useRuntimeConfig).toBe('function');
    expect(typeof useState).toBe('function');
    expect(typeof navigateTo).toBe('function');
    expect(typeof ref).toBe('function');
    expect(typeof computed).toBe('function');
  });

  it('useState works with state store', () => {
    const count = useState('test-count', () => 0);
    expect(count.value).toBe(0);
    count.value = 5;
    expect(count.value).toBe(5);
  });
});
