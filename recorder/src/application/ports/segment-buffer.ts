import type { Segment } from '../../domain/entities/segment';

export interface SegmentBuffer {
  discard(segment: Segment): Promise<void>;
}
