import type { Segment } from '../../domain/entities/segment';
import type { ProcessClosedSegment } from './process-closed-segment';

export class SegmentProcessingQueue {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly processClosedSegment: ProcessClosedSegment) {}

  enqueue(segment: Segment): void {
    this.pending = this.pending
      .then(() => this.processClosedSegment.execute(segment))
      .catch(() => undefined);
  }

  whenDrained(): Promise<void> {
    return this.pending;
  }
}
