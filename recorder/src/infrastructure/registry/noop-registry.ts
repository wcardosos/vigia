import type { SegmentRegistry } from '../../application/ports/segment-registry';

export class NoopRegistry implements SegmentRegistry {
  register(): Promise<void> {
    return Promise.resolve();
  }
}
