import { SegmentArchiveError } from '../../src/application/errors/segment-archive-error';
import type { SegmentArchive } from '../../src/application/ports/segment-archive';
import type { Segment } from '../../src/domain/entities/segment';
import type { StorageKey } from '../../src/domain/value-objects/storage-key';

export class FakeSegmentArchive implements SegmentArchive {
  readonly startedFileNames: string[] = [];
  readonly archivedKeys = new Map<string, string>();
  private readonly rejectedFileNames = new Set<string>();
  private readonly holds = new Map<string, Promise<void>>();
  private readonly releases = new Map<string, () => void>();

  constructor(private readonly calls: string[] = []) {}

  failFor(fileName: string): void {
    this.rejectedFileNames.add(fileName);
  }

  hold(fileName: string): void {
    this.holds.set(
      fileName,
      new Promise<void>((resolve) => {
        this.releases.set(fileName, resolve);
      }),
    );
  }

  release(fileName: string): void {
    this.releases.get(fileName)?.();
  }

  async archive(segment: Segment, key: StorageKey): Promise<void> {
    this.startedFileNames.push(segment.fileName);
    this.calls.push(`archive ${segment.fileName}`);

    const held = this.holds.get(segment.fileName);
    if (held !== undefined) {
      await held;
    }

    if (this.rejectedFileNames.has(segment.fileName)) {
      throw new SegmentArchiveError(key.value, 'the storage service rejected the upload');
    }

    this.archivedKeys.set(segment.fileName, key.value);
  }
}
