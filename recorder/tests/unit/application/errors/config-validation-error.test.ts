import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../../../src/application/errors/config-validation-error';

describe('ConfigValidationError', () => {
  it('describes the invalid field and the reason', () => {
    const error = new ConfigValidationError('camera', 'rtspUrl', 'must start with rtsp://');

    expect(error.message).toBe('invalid camera configuration: rtspUrl — must start with rtsp://');
  });

  it('names the scope that rejected the field', () => {
    const error = new ConfigValidationError('r2', 'bucket', 'must be a non-empty bucket name');

    expect(error.message).toBe('invalid r2 configuration: bucket — must be a non-empty bucket name');
  });

  it('exposes the field', () => {
    const error = new ConfigValidationError('camera', 'rtspUrl', 'must start with rtsp://');

    expect(error.field).toBe('rtspUrl');
  });

  it('exposes the scope', () => {
    const error = new ConfigValidationError('r2', 'bucket', 'must be a non-empty bucket name');

    expect(error.scope).toBe('r2');
  });
});
