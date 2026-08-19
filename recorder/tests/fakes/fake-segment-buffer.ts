import type { SegmentBuffer } from '../../src/application/ports/segment-buffer';
import type { Segment } from '../../src/domain/entities/segment';

export class FakeSegmentBuffer implements SegmentBuffer {
  readonly discardedFileNames: string[] = [];
  private readonly missingFileNames = new Set<string>();

  constructor(private readonly calls: string[] = []) {}

  alreadyRemoved(fileName: string): void {
    this.missingFileNames.add(fileName);
  }

  discard(segment: Segment): Promise<void> {
    this.calls.push(`discard ${segment.fileName}`);

    if (this.missingFileNames.has(segment.fileName)) {
      return Promise.reject(new Error(`ENOENT: no such file ${segment.filePath}`));
    }

    this.discardedFileNames.push(segment.fileName);

    return Promise.resolve();
  }
}
