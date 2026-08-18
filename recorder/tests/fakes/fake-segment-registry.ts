import type { SegmentRegistry } from '../../src/application/ports/segment-registry';
import type { Segment } from '../../src/domain/entities/segment';
import type { StorageKey } from '../../src/domain/value-objects/storage-key';

export class FakeSegmentRegistry implements SegmentRegistry {
  readonly registeredKeys = new Map<string, string>();
  private readonly rejectedFileNames = new Set<string>();

  constructor(private readonly calls: string[] = []) {}

  failFor(fileName: string): void {
    this.rejectedFileNames.add(fileName);
  }

  register(segment: Segment, key: StorageKey): Promise<void> {
    this.calls.push(`register ${segment.fileName}`);

    if (this.rejectedFileNames.has(segment.fileName)) {
      return Promise.reject(new Error(`the registry rejected ${segment.fileName}`));
    }

    this.registeredKeys.set(segment.fileName, key.value);

    return Promise.resolve();
  }
}
