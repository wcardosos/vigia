import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../../../src/application/errors/config-validation-error';

describe('ConfigValidationError', () => {
  it('describes the invalid field and the reason', () => {
    const error = new ConfigValidationError('rtspUrl', 'must start with rtsp://');

    expect(error.message).toBe('invalid camera configuration: rtspUrl — must start with rtsp://');
  });

  it('exposes the field', () => {
    const error = new ConfigValidationError('rtspUrl', 'must start with rtsp://');

    expect(error.field).toBe('rtspUrl');
  });
});
