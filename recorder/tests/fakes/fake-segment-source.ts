import type { SegmentSource } from '../../src/application/ports/segment-source';
import type { Segment } from '../../src/domain/entities/segment';

export class FakeSegmentSource implements SegmentSource {
  private readonly handlers: ((segment: Segment) => void)[] = [];

  onSegmentClosed(handler: (segment: Segment) => void): void {
    this.handlers.push(handler);
  }

  emit(segment: Segment): void {
    for (const handler of this.handlers) {
      handler(segment);
    }
  }
}
