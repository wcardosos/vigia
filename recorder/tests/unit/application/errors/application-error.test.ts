import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../../../../src/application/errors/application-error';

class FakeApplicationError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

describe('ApplicationError', () => {
  it('names the error after the concrete subclass', () => {
    const error = new FakeApplicationError('something went wrong');

    expect(error.name).toBe('FakeApplicationError');
  });

  it('preserves the cause passed through options', () => {
    const originalCause = new Error('underlying failure');

    const error = new FakeApplicationError('something went wrong', { cause: originalCause });

    expect(error.cause).toBe(originalCause);
  });

  it('is catchable as an Error', () => {
    const error = new FakeApplicationError('something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
  });
});
