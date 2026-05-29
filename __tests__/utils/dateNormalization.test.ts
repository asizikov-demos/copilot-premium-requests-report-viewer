import {
  createDateNormalizer,
  detectDateFormat,
  normalizeDateToIso,
} from '@/utils/ingestion/dateNormalization';

describe('dateNormalization', () => {
  describe('detectDateFormat', () => {
    it('detects ISO dates', () => {
      expect(detectDateFormat('2026-03-11')).toBe('iso');
      expect(detectDateFormat('2025-06-30T23:59:59Z')).toBe('iso');
    });

    it('detects US slash dates', () => {
      expect(detectDateFormat('5/29/26')).toBe('us-slash');
      expect(detectDateFormat('12/5/2026')).toBe('us-slash');
    });

    it('returns unknown for unsupported formats', () => {
      expect(detectDateFormat('29.05.2026')).toBe('unknown');
      expect(detectDateFormat('not-a-date')).toBe('unknown');
      expect(detectDateFormat('')).toBe('unknown');
    });
  });

  describe('normalizeDateToIso', () => {
    it('passes ISO dates through as YYYY-MM-DD', () => {
      expect(normalizeDateToIso('2026-03-11')).toBe('2026-03-11');
      expect(normalizeDateToIso('2025-06-30T23:59:59Z')).toBe('2025-06-30');
    });

    it('converts US M/D/YY into ISO', () => {
      expect(normalizeDateToIso('5/29/26')).toBe('2026-05-29');
      expect(normalizeDateToIso('1/1/26')).toBe('2026-01-01');
      expect(normalizeDateToIso('12/5/2026')).toBe('2026-12-05');
    });

    it('rejects out-of-range and malformed values', () => {
      expect(normalizeDateToIso('13/1/26')).toBeNull();
      expect(normalizeDateToIso('1/32/26')).toBeNull();
      expect(normalizeDateToIso('29.05.2026')).toBeNull();
      expect(normalizeDateToIso('garbage')).toBeNull();
    });

    it('never applies local-timezone conversion (string-only math)', () => {
      // A naive `new Date("5/29/26")` would be timezone-dependent; the
      // string parser must always yield the same UTC calendar date.
      expect(normalizeDateToIso('5/29/26')).toBe('2026-05-29');
    });
  });

  describe('createDateNormalizer', () => {
    it('binds to a format and validates each value', () => {
      const us = createDateNormalizer('us-slash');
      expect(us('5/29/26')).toBe('2026-05-29');

      const iso = createDateNormalizer('iso');
      expect(iso('2026-03-11')).toBe('2026-03-11');
    });

    it('returns null for unknown format', () => {
      const unknown = createDateNormalizer('unknown');
      expect(unknown('5/29/26')).toBeNull();
      expect(unknown('2026-03-11')).toBeNull();
    });
  });
});
