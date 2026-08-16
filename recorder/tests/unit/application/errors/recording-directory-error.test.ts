import { describe, expect, it } from 'vitest';
import { RecordingDirectoryError } from '../../../../src/application/errors/recording-directory-error';

describe('RecordingDirectoryError', () => {
  it('describes the directory and the reason', () => {
    const error = new RecordingDirectoryError('/var/lib/vigia/cameraA', 'permission denied');

    expect(error.message).toBe(
      'cannot prepare recording directory: /var/lib/vigia/cameraA — permission denied',
    );
  });

  it('exposes the directory', () => {
    const error = new RecordingDirectoryError('/var/lib/vigia/cameraA', 'permission denied');

    expect(error.directory).toBe('/var/lib/vigia/cameraA');
  });
});
