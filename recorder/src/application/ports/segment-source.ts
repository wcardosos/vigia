import type { Segment } from '../../domain/entities/segment';

export interface SegmentSource {
  onSegmentClosed(handler: (segment: Segment) => void): void;
}
