import { describe, expect, it } from 'vitest';
import { SegmentArchiveError } from '../../../../src/application/errors/segment-archive-error';

describe('SegmentArchiveError', () => {
  it('describes the key and the reason', () => {
    const error = new SegmentArchiveError('cameraA/2026/07/19/143000.ts', 'connection refused');

    expect(error.message).toBe(
      'cannot archive segment: cameraA/2026/07/19/143000.ts — connection refused',
    );
  });

  it('exposes the key', () => {
    const error = new SegmentArchiveError('cameraA/2026/07/19/143000.ts', 'connection refused');

    expect(error.key).toBe('cameraA/2026/07/19/143000.ts');
  });
});
