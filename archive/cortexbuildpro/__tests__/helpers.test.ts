import { formatCurrency, formatDate, initials, generateId, truncate, debounce } from '@/utils/helpers';

describe('formatCurrency', () => {
  it('formats GBP zero correctly', () => {
    expect(formatCurrency(0)).toBe('£0');
  });

  it('formats large values without decimals', () => {
    expect(formatCurrency(1234567)).toBe('£1,234,567');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date', () => {
    const result = formatDate('2026-05-09T00:00:00.000Z');
    expect(result).toMatch(/May/);
  });
});

describe('initials', () => {
  it('returns up to two initials', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  it('handles single names', () => {
    expect(initials('Adrian')).toBe('A');
  });

  it('is uppercase', () => {
    expect(initials('alice bob')).toBe('AB');
  });
});

describe('generateId', () => {
  it('includes the prefix', () => {
    const id = generateId('task');
    expect(id.startsWith('task_')).toBe(true);
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBe(10);
  });
});

describe('truncate', () => {
  it('does not change short strings', () => {
    expect(truncate('hello')).toBe('hello');
  });

  it('adds ellipsis when truncating', () => {
    expect(truncate('a'.repeat(100), 10)).toBe('a'.repeat(7) + '...');
  });
});

describe('debounce', () => {
  it('delays execution', (done) => {
    let called = 0;
    const fn = debounce(() => { called++; }, 50);
    fn(); fn(); fn();
    expect(called).toBe(0);
    setTimeout(() => {
      expect(called).toBe(1);
      done();
    }, 100);
  });
});
