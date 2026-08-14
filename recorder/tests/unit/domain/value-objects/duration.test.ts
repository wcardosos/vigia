import { describe, expect, it } from 'vitest';
import { Duration } from '../../../../src/domain/value-objects/duration';

describe('Duration', () => {
  it('exposes the number of seconds it was built from', () => {
    expect(Duration.ofSeconds(600).seconds).toBe(600);
  });

  it('accepts a fractional number of seconds', () => {
    expect(Duration.ofSeconds(0.5).seconds).toBe(0.5);
  });

  it.each([
    { displayedValue: '0', seconds: 0 },
    { displayedValue: '-10', seconds: -10 },
    { displayedValue: 'NaN', seconds: Number.NaN },
    { displayedValue: 'Infinity', seconds: Number.POSITIVE_INFINITY },
    { displayedValue: '-Infinity', seconds: Number.NEGATIVE_INFINITY },
  ])('rejects $displayedValue as a number of seconds', ({ seconds }) => {
    expect(() => Duration.ofSeconds(seconds)).toThrowError(RangeError);
  });

  it('names the rejected value in the error message', () => {
    expect(() => Duration.ofSeconds(-10)).toThrowError(/-10/);
  });

  it('is equal to another duration of the same number of seconds', () => {
    expect(Duration.ofSeconds(600).equals(Duration.ofSeconds(600))).toBe(true);
  });

  it('is not equal to a duration of a different number of seconds', () => {
    expect(Duration.ofSeconds(600).equals(Duration.ofSeconds(300))).toBe(false);
  });
});
