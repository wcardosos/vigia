import { rm } from 'node:fs/promises';
import type { SegmentBuffer } from '../../application/ports/segment-buffer';
import type { Segment } from '../../domain/entities/segment';

export class FsSegmentBuffer implements SegmentBuffer {
  async discard(segment: Segment): Promise<void> {
    await rm(segment.filePath);
  }
}
